import type { RiskLevel } from '@/lib/types';

/**
 * `lib/triage/parse.ts` is its own pure module precisely so the unparseable
 * branch is testable without a network: feed it truncated JSON, a fenced code
 * block, an out-of-enum `risk_level`, and an empty string.
 */

export interface ParsedTriage {
  risk_level: RiskLevel;
  summary: string;
  recommended_next_step: string;
  red_flags: string[];
}

export type ParseResult =
  | { ok: true; value: ParsedTriage }
  | { ok: false; reason: 'empty' | 'not-json' | 'shape' | 'enum' };

const RISK_LEVELS: readonly string[] = ['low', 'medium', 'high'];

/** Strip a ```json fence if the model wrapped its output in one. */
function unfence(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fence ? fence[1].trim() : trimmed;
}

export function parseTriage(raw: string): ParseResult {
  const text = unfence(raw ?? '');
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
  const risk = obj.risk_level;
  const summary = obj.summary;
  const step = obj.recommended_next_step;

  if (typeof summary !== 'string' || summary.trim() === '') {
    return { ok: false, reason: 'shape' };
  }
  if (typeof step !== 'string' || step.trim() === '') {
    return { ok: false, reason: 'shape' };
  }
  if (typeof risk !== 'string') return { ok: false, reason: 'shape' };
  if (!RISK_LEVELS.includes(risk)) return { ok: false, reason: 'enum' };

  const redFlagsRaw = obj.red_flags;
  const red_flags = Array.isArray(redFlagsRaw)
    ? redFlagsRaw.filter((f): f is string => typeof f === 'string')
    : [];

  return {
    ok: true,
    value: {
      risk_level: risk as RiskLevel,
      summary: summary.trim(),
      recommended_next_step: step.trim(),
      red_flags,
    },
  };
}

/** Pull the first text part out of a `generateContent` response body. */
export function extractText(body: unknown): string {
  if (typeof body !== 'object' || body === null) return '';
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';

  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content
    ?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((p) => (typeof (p as { text?: unknown })?.text === 'string' ? (p as { text: string }).text : ''))
    .join('')
    .trim();
}
