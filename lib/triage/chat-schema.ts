import type {
  ChatFailureReason,
  ChatStep,
  ChatStepResponse,
  RiskLevel,
  TriageSource,
} from '@/lib/types';

/**
 * Parse, validate and narrow one model turn into a `ChatStep`.
 *
 * Its own pure module for the same reason `lib/triage/parse.ts` is: the
 * unparseable branch is the branch that decides whether the demo survives a bad
 * response, and it has to be testable without a network. Feed it truncated JSON,
 * a fenced block, an out-of-enum `risk_level`, a missing `kind`.
 */

export type ChatParseFailure =
  | 'empty'
  | 'not-json'
  | 'shape'
  | 'enum'
  | 'kind'
  /** A question arrived where an assessment was mandatory. */
  | 'expected-assessment';

export type ChatParseResult =
  | { ok: true; value: ChatStep }
  | { ok: false; reason: ChatParseFailure };

const RISK_LEVELS: readonly string[] = ['low', 'medium', 'high'];

/** Two to four chips. More than four stops being a set of choices and starts
 *  being a list to read. */
export const MAX_QUICK_REPLIES = 4;

/** Strip a ```json fence if the model wrapped its output in one. */
function unfence(raw: string): string {
  const trimmed = (raw ?? '').trim();
  const fence = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

function nonBlankString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Quick replies are cleaned, never rejected.
 *
 * A question with zero usable chips is still a perfectly good question, and the
 * composer is always present, so failing the whole step over a missing chip
 * would push a usable question into the fallback path to protect a convenience.
 * Trim, drop blanks, de-duplicate, cap at four.
 */
function cleanQuickReplies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = nonBlankString(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_QUICK_REPLIES) break;
  }
  return out;
}

export interface ParseChatStepOptions {
  /**
   * When true, a `kind: 'question'` body is REJECTED rather than accepted. This
   * is how rule 1 of the Convergence_Contract is enforced against a model that
   * asks a fourth question anyway: the caller forces an assessment locally
   * instead of extending the conversation.
   */
  requireAssessment?: boolean;
}

export function parseChatStep(
  raw: string,
  options: ParseChatStepOptions = {},
): ChatParseResult {
  const text = unfence(raw);
  if (text === '') return { ok: false, reason: 'empty' };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'shape' };
  }

  const obj = data as Record<string, unknown>;
  const kind = obj.kind;

  /* An absent `kind` is recoverable: the payload's own fields say which branch
     it is. A model that returns a well-formed assessment and forgets the
     discriminator should not cost the user their answer. */
  const resolvedKind =
    kind === 'question' || kind === 'assessment'
      ? kind
      : typeof obj.question === 'string'
        ? 'question'
        : typeof obj.risk_level === 'string'
          ? 'assessment'
          : null;

  if (resolvedKind === null) return { ok: false, reason: 'kind' };

  if (resolvedKind === 'question') {
    if (options.requireAssessment) {
      return { ok: false, reason: 'expected-assessment' };
    }
    const question = nonBlankString(obj.question);
    if (!question) return { ok: false, reason: 'shape' };
    return {
      ok: true,
      value: {
        kind: 'question',
        question,
        quickReplies: cleanQuickReplies(obj.quickReplies),
      },
    };
  }

  const summary = nonBlankString(obj.summary);
  const nextStep = nonBlankString(obj.recommended_next_step);
  if (!summary || !nextStep) return { ok: false, reason: 'shape' };

  const risk = obj.risk_level;
  if (typeof risk !== 'string') return { ok: false, reason: 'shape' };
  if (!RISK_LEVELS.includes(risk)) return { ok: false, reason: 'enum' };

  const redFlags = Array.isArray(obj.red_flags)
    ? obj.red_flags.filter((f): f is string => typeof f === 'string' && f.trim() !== '')
    : [];

  return {
    ok: true,
    value: {
      kind: 'assessment',
      risk_level: risk as RiskLevel,
      summary,
      recommended_next_step: nextStep,
      ...(redFlags.length > 0 ? { red_flags: redFlags } : {}),
    },
  };
}

const FAILURE_REASONS: readonly ChatFailureReason[] = [
  'timeout',
  'error',
  'unparseable',
  'no-key',
];

/**
 * Narrow an untrusted `/api/triage/chat` body into `ChatStepResponse`.
 *
 * The point of this function is that a failure can NEVER be read as an
 * assessment. Everything that is not a recognisable success — a missing step, a
 * step that will not parse, a body that is not an object — becomes
 * `{ ok: false }`, and the client's error plate handles it. Nothing here
 * fabricates a `risk_level`.
 *
 * `ok` is checked for `=== false` rather than for truthiness, so a body from an
 * older deployment that predates the discriminant is still read as the success
 * it was: the step's own shape is what has to validate, not the flag.
 */
export function readChatResponse(payload: unknown): ChatStepResponse {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'error' };
  }

  const body = payload as Record<string, unknown>;

  if (body.ok === false) {
    const reason = body.reason;
    return {
      ok: false,
      reason:
        typeof reason === 'string' && FAILURE_REASONS.includes(reason as ChatFailureReason)
          ? (reason as ChatFailureReason)
          : 'error',
    };
  }

  /* A success is only a success if the step itself validates. Re-running the
     same parser the route ran means a body that was mangled in transit lands in
     the error state instead of rendering half an assessment. */
  const parsed = parseChatStep(JSON.stringify(body.step ?? ''));
  if (!parsed.ok) return { ok: false, reason: 'unparseable' };

  return {
    ok: true,
    step: parsed.value,
    source: body.source === 'fallback' ? 'fallback' : ('gemini' as TriageSource),
    ...(body.endReason === 'red-flag' ||
    body.endReason === 'turn-cap' ||
    body.endReason === 'model'
      ? { endReason: body.endReason }
      : {}),
  };
}

/** `low < medium < high`, so a floor can be applied with a comparison. */
const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

/**
 * Raise a model's risk level to a floor, never lower it.
 *
 * Used when the deterministic classifier read `high` from the transcript: the
 * model supplies the wording, the keyword table supplies the floor, and the
 * asymmetric error in triage — under-triage — is the one that gets closed off.
 */
export function floorRisk(model: RiskLevel, floor: RiskLevel): RiskLevel {
  return RISK_ORDER[model] >= RISK_ORDER[floor] ? model : floor;
}
