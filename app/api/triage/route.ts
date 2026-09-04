import { NextResponse } from 'next/server';
import type { SupportedLanguage, TriageResult } from '@/lib/types';
import { fallbackTriage } from '@/lib/triage/fallback';
import { extractText, parseTriage } from '@/lib/triage/parse';
import {
  GEMINI_TIMEOUT_MS,
  generateContent,
} from '@/lib/gemini';

export const runtime = 'nodejs';

/**
 * Triage_Engine.
 *
 * ALWAYS HTTP 200 on a well-formed request. A Gemini failure — no key,
 * timeout, HTTP error, empty body, unparseable JSON, out-of-enum risk level —
 * is a `source: 'fallback'` payload, never a 5xx. The intake flow must complete
 * (Req 9.3, 22.5), and the label tells the truth about which path ran (Req 9.4).
 */

const SYSTEM_INSTRUCTION = `You are a triage support assistant for community health workers in rural India.
You do not diagnose. You classify urgency and restate the complaint in plain language.

Rules:
- Never name a disease or condition. Describe severity, urgency, and what to watch for.
- Write \`summary\` and \`recommended_next_step\` in the language of the LOCALE field, at a
  reading level suitable for a person with limited literacy. Two short sentences maximum.
- Classify risk_level using this rubric ONLY:
    high   — possible airway, breathing, circulation, neurological, obstetric, or
             severe-bleeding emergency; or symptoms that could deteriorate within hours.
    medium — persistent, worsening, or systemic symptoms needing clinician review in
             1-2 days, but no immediate threat.
    low    — self-limiting minor complaints manageable at a primary health centre.
- When the transcript is too vague to classify, choose medium. Never guess low.
- Output JSON matching the provided schema. No prose outside the JSON.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    summary: { type: 'string' },
    recommended_next_step: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
  },
  required: ['risk_level', 'summary', 'recommended_next_step'],
  propertyOrdering: [
    'risk_level',
    'summary',
    'recommended_next_step',
    'red_flags',
  ],
} as const;

interface TriageBody {
  transcript?: unknown;
  locale?: unknown;
  age?: unknown;
  gender?: unknown;
}

function asLocale(value: unknown): SupportedLanguage {
  return value === 'en-IN' ? 'en-IN' : 'hi-IN';
}

function buildUserText(
  transcript: string,
  locale: SupportedLanguage,
  age: unknown,
  gender: unknown,
): string {
  const patient = [
    typeof age === 'number' && Number.isFinite(age) ? `age ${age}` : null,
    typeof gender === 'string' && gender.trim() !== '' ? gender.trim() : null,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `LOCALE: ${locale}`,
    `PATIENT: ${patient === '' ? 'not stated' : patient}`,
    `TRANSCRIPT: """${transcript}"""`,
  ].join('\n');
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: TriageBody;
  try {
    body = (await request.json()) as TriageBody;
  } catch {
    return NextResponse.json(
      { error: 'invalid-json' },
      { status: 400 },
    );
  }

  const transcript =
    typeof body.transcript === 'string' ? body.transcript : '';
  const locale = asLocale(body.locale);

  if (transcript.trim() === '') {
    return NextResponse.json({ error: 'transcript-required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  /* No key configured is the first branch, not a failure: no network attempt,
     no AbortController, no timer. The intake completes in milliseconds with a
     visibly labelled keyword-based assessment. */
  if (!apiKey) {
    return NextResponse.json(fallbackTriage(transcript, locale) satisfies TriageResult);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort('triage-timeout'), GEMINI_TIMEOUT_MS);

  try {
    const raw = await generateContent({
      apiKey,
      systemInstruction: SYSTEM_INSTRUCTION,
      userText: buildUserText(transcript, locale, body.age, body.gender),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 400,
      },
      signal: ac.signal,
    });

    const parsed = parseTriage(extractText(raw));
    if (!parsed.ok) throw new Error(`gemini-unparseable-${parsed.reason}`);

    const result: TriageResult = {
      risk_level: parsed.value.risk_level,
      summary: parsed.value.summary,
      recommended_next_step: parsed.value.recommended_next_step,
      red_flags: parsed.value.red_flags,
      source: 'gemini',
      matched: [],
    };
    return NextResponse.json(result);
  } catch (error) {
    /* The abort path and the error path converge here, so there is exactly one
       place that can fall back. */
    const reason = error instanceof Error ? error.message : 'gemini-unknown';
    const result = fallbackTriage(transcript, locale);
    return NextResponse.json(
      { ...result, fallbackReason: reason } satisfies TriageResult & {
        fallbackReason: string;
      },
    );
  } finally {
    clearTimeout(timer);
  }
}
