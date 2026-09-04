import { NextResponse } from 'next/server';
import type {
  ChatStep,
  ChatStepResponse,
  ChatTurn,
  SupportedLanguage,
} from '@/lib/types';
import { fallbackTriage } from '@/lib/triage/fallback';
import { extractText } from '@/lib/triage/parse';
import {
  MAX_QUESTIONS,
  countAssistantQuestions,
  nextAction,
  transcriptOf,
} from '@/lib/triage/chat-reducer';
import { floorRisk, parseChatStep } from '@/lib/triage/chat-schema';
import {
  GEMINI_TIMEOUT_MS,
  generateContent,
  type GeminiContent,
} from '@/lib/gemini';

export const runtime = 'nodejs';

/**
 * The multi-turn symptom chat. It does NOT replace `/api/triage` — it FEEDS the
 * same pipeline, terminating in the same structured assessment a single-shot
 * submission produces, so the health record, the routing and the token are
 * unchanged downstream.
 *
 * ALWAYS HTTP 200 on a well-formed body. No key, a timeout, an HTTP error, an
 * empty body, unparseable JSON, an out-of-enum risk level, or a fourth question
 * where an assessment was mandatory — every one of those is a
 * `source: 'fallback'` payload, never a 5xx. There is one shape on the wire and
 * the client has one branch to write (Req 9.3, 22.5).
 *
 * The three convergence rules live in `lib/triage/chat-reducer.ts`. The prompt
 * below asks for them; the reducer enforces them. Both, deliberately.
 */

const SYSTEM_INSTRUCTION = `You are a triage support assistant for community health workers and patients in rural India.
You are having a short spoken-style conversation to work out how urgently care is needed.

ABSOLUTE RULES
- NEVER name a disease, condition or diagnosis. Describe urgency, severity, and what to watch for.
- Write EVERY user-facing string in the language of the LOCALE field, at a reading level suitable
  for a person with limited literacy. Maximum two short sentences per string.
- Ask ONE question at a time, and only a question that could CHANGE the risk level:
  duration, severity, progression, or an associated red-flag symptom. Never ask two things at once.
  Never ask something already answered in the conversation.
- Every question MUST carry 2 to 4 \`quickReplies\`. Each one is a COMPLETE tappable answer in the
  user's language — "3 din se" not "duration" — so a person who cannot type can still answer.
  Keep each under 6 words.
- A quickReply that DENIES a symptom must not repeat that symptom's name. Write "nahi, aisa kuch
  nahi hai", never "nahi, seene mein dard nahi hai". The deterministic keyword classifier that
  guards this conversation does not model negation, so an echoed symptom name in a denial reads as
  the symptom being present.
- Classify risk_level using this rubric ONLY:
    high   — possible airway, breathing, circulation, neurological, obstetric, or
             severe-bleeding emergency; or symptoms that could deteriorate within hours.
    medium — persistent, worsening, or systemic symptoms needing clinician review in
             1-2 days, but no immediate threat.
    low    — self-limiting minor complaints manageable at a primary health centre.
- When the conversation is too vague to classify, choose medium. NEVER guess low.
- Output JSON matching the provided schema. No prose outside the JSON.`;

/** Appended when the model may still ask. Tells it exactly how much budget is
 *  left, because "be brief" is advice and "you have 1 question left" is a fact. */
function askSuffix(asked: number): string {
  const remaining = Math.max(0, MAX_QUESTIONS - asked);
  return `

CONVERSATION STATE
- You have asked ${asked} question(s). You may ask at most ${remaining} more.
- If you already have enough to classify urgency, return kind:"assessment" NOW. Ending early is good.
- Otherwise return kind:"question".`;
}

/** Appended when an assessment is mandatory. */
const FORCE_SUFFIX = `

CONVERSATION STATE
- The question budget is spent, or an urgent warning sign was already described.
- You MUST return kind:"assessment". Do NOT ask another question.
- Classify from what the person has already said. An incomplete picture reads as medium or high,
  never low.`;

/* Two schemas rather than one permissive schema. When an assessment is
   mandatory, `required` names every assessment field and `kind` has a
   single-member enum, so the branch is closed on the wire and not only in the
   prompt. */

const QUESTION_OR_ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['question', 'assessment'] },
    question: { type: 'string' },
    quickReplies: { type: 'array', items: { type: 'string' } },
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: { type: 'string' },
    recommended_next_step: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
  },
  required: ['kind'],
  propertyOrdering: [
    'kind',
    'question',
    'quickReplies',
    'risk_level',
    'summary',
    'recommended_next_step',
    'red_flags',
  ],
} as const;

const ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['assessment'] },
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: { type: 'string' },
    recommended_next_step: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
  },
  required: ['kind', 'risk_level', 'summary', 'recommended_next_step'],
  propertyOrdering: [
    'kind',
    'risk_level',
    'summary',
    'recommended_next_step',
    'red_flags',
  ],
} as const;

interface ChatBody {
  turns?: unknown;
  locale?: unknown;
  patient?: unknown;
  forceAssessment?: unknown;
}

function asLocale(value: unknown): SupportedLanguage {
  return value === 'en-IN' ? 'en-IN' : 'hi-IN';
}

/** Narrow the wire body to `ChatTurn[]`, dropping anything malformed rather than
 *  rejecting the whole request over one bad element. */
function asTurns(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  const out: ChatTurn[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue;
    const turn = item as Record<string, unknown>;
    const role = turn.role;
    const text = turn.text;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof text !== 'string' || text.trim() === '') continue;
    out.push({
      role,
      text,
      at: typeof turn.at === 'string' ? turn.at : new Date(0).toISOString(),
    });
  }
  return out;
}

function patientLine(value: unknown): string {
  if (typeof value !== 'object' || value === null) return 'not stated';
  const patient = value as Record<string, unknown>;
  const parts = [
    typeof patient.age === 'number' && Number.isFinite(patient.age)
      ? `age ${patient.age}`
      : null,
    typeof patient.gender === 'string' && patient.gender.trim() !== ''
      ? patient.gender.trim()
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'not stated';
}

/**
 * The conversation as Gemini wants it: `user` / `model` alternation, text parts
 * only (Req 22.4). The request context is PREFIXED onto the first user turn
 * rather than injected as an extra turn, so the alternation stays clean and no
 * synthetic turn can be mistaken for something the patient said.
 */
function buildContents(
  turns: ChatTurn[],
  locale: SupportedLanguage,
  patient: unknown,
): GeminiContent[] {
  const header = [
    `LOCALE: ${locale}`,
    `PATIENT: ${patientLine(patient)}`,
    'The person now describes:',
  ].join('\n');

  return turns.map((turn, i) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === 0 ? `${header}\n${turn.text}` : turn.text }],
  }));
}

/** Rule 3 of the Convergence_Contract, in one place. */
function fallbackStep(
  turns: ChatTurn[],
  locale: SupportedLanguage,
): ChatStep {
  const result = fallbackTriage(transcriptOf(turns), locale);
  return {
    kind: 'assessment',
    risk_level: result.risk_level,
    summary: result.summary,
    recommended_next_step: result.recommended_next_step,
    ...(result.matched.length > 0 ? { red_flags: result.matched } : {}),
  };
}

function ok(step: ChatStep, source: 'gemini' | 'fallback', extra?: Record<string, unknown>) {
  return NextResponse.json({ step, source, ...extra } satisfies ChatStepResponse &
    Record<string, unknown>);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const turns = asTurns(body.turns);
  const locale = asLocale(body.locale);

  /* A conversation with nothing in it is a malformed request, not a failure to
     assess: there is no transcript to fall back to. This is the ONLY 400 past
     the JSON parse. */
  if (turns.length === 0 || transcriptOf(turns).trim() === '') {
    return NextResponse.json({ error: 'turns-required' }, { status: 400 });
  }

  /* The reducer decides, not the caller. `forceAssessment` from the client can
     only ADD a constraint; it can never relax one, so a client that forgets to
     send it still gets a converging conversation. */
  const action = nextAction(turns, locale);
  const mustAssess = body.forceAssessment === true || action.kind === 'assess';
  const redFlagged = action.kind === 'assess' && action.reason === 'red-flag';
  const reason =
    action.kind === 'assess' ? action.reason : mustAssess ? 'turn-cap' : 'model';

  const apiKey = process.env.GEMINI_API_KEY;

  /* No key configured is the first branch, not a failure: no network attempt, no
     AbortController, no timer. The conversation ends in milliseconds with a
     visibly labelled keyword-based assessment. */
  if (!apiKey) {
    return ok(fallbackStep(turns, locale), 'fallback', {
      fallbackReason: 'no-key',
      reason,
    });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort('chat-timeout'), GEMINI_TIMEOUT_MS);

  try {
    const raw = await generateContent({
      apiKey,
      systemInstruction:
        SYSTEM_INSTRUCTION +
        (mustAssess ? FORCE_SUFFIX : askSuffix(countAssistantQuestions(turns))),
      contents: buildContents(turns, locale, body.patient),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: mustAssess
          ? ASSESSMENT_SCHEMA
          : QUESTION_OR_ASSESSMENT_SCHEMA,
        temperature: 0.3,
        /* Two short sentences plus four chips fits comfortably; the headroom is
           for Devanagari, which costs more tokens per glyph than Latin. */
        maxOutputTokens: 900,
      },
      signal: ac.signal,
    });

    const parsed = parseChatStep(extractText(raw), {
      requireAssessment: mustAssess,
    });
    if (!parsed.ok) throw new Error(`gemini-unparseable-${parsed.reason}`);

    /* The keyword table supplies a FLOOR, never a ceiling. When the transcript
       reads `high` deterministically, the model provides the wording and cannot
       talk the urgency down. Under-triage is the asymmetric error. */
    const step: ChatStep =
      redFlagged && parsed.value.kind === 'assessment'
        ? { ...parsed.value, risk_level: floorRisk(parsed.value.risk_level, 'high') }
        : parsed.value;

    return ok(step, 'gemini', { reason });
  } catch (error) {
    /* The abort path and the error path converge here, so there is exactly one
       place that can fall back. */
    return ok(fallbackStep(turns, locale), 'fallback', {
      fallbackReason: error instanceof Error ? error.message : 'gemini-unknown',
      reason,
    });
  } finally {
    clearTimeout(timer);
  }
}
