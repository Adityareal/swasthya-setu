import type { ChatTurn, SupportedLanguage } from '@/lib/types';
import { fallbackTriage } from './fallback';

/**
 * The Convergence_Contract, as a pure reducer.
 *
 * An open-ended chat rambles. The prompt in `app/api/triage/chat/route.ts` ASKS
 * the model to converge; this file GUARANTEES it. A prompt is a request and a
 * reducer is an invariant, so both exist and the reducer is the one that
 * decides.
 *
 * Three rules:
 *
 *   1. TURN CAP. At most `MAX_QUESTIONS` assistant questions. At the cap the
 *      next request carries `forceAssessment`, and the route must answer with an
 *      assessment. A conversation cannot fail to terminate.
 *
 *   2. RED-FLAG SHORT CIRCUIT. `fallbackTriage()` runs over the user turns on
 *      every step. A `high` reading skips every remaining question. You do not
 *      ask three clarifying questions of someone describing chest pain — and the
 *      demo's chest-pain case therefore converges in one turn, which is both
 *      faster and clinically correct.
 *
 *   3. NEVER DEAD-END. Any model error, timeout or unparseable body resolves to
 *      `fallbackTriage()` over the concatenated user turns. That branch lives in
 *      the route and the component, but it consumes `transcriptOf()` from here,
 *      so there is exactly one definition of "what the patient said".
 *
 * PURE. No `Date.now()`, no `fetch`, no store access. Timestamps arrive on the
 * turns the caller constructs, which is what lets every rule above be asserted
 * in Vitest with no mocks and no network.
 */

/** Three questions is the budget: enough to separate `medium` from `high`, few
 *  enough to finish inside a demo, and few enough that a patient answers all of
 *  them. */
export const MAX_QUESTIONS = 3;

/**
 * Assistant turns ARE questions. `ChatStep` makes an assessment terminal and the
 * component never appends one as a turn, so counting assistant turns needs no
 * classification step — the invariant is upstream, in the type.
 */
export function countAssistantQuestions(turns: ChatTurn[]): number {
  let n = 0;
  for (const turn of turns ?? []) {
    if (turn.role === 'assistant') n += 1;
  }
  return n;
}

/** True once the question budget is spent. */
export function shouldForceAssessment(
  turns: ChatTurn[],
  max: number = MAX_QUESTIONS,
): boolean {
  return countAssistantQuestions(turns) >= max;
}

/**
 * The safety short circuit. Deliberately reads the WHOLE user transcript rather
 * than only the newest message: "it hurts" in turn three is a red flag when turn
 * one said "chest", and a per-message check would miss that.
 *
 * Locale does not affect the classification — `fallbackTriage` matches keywords
 * in Devanagari, Latin transliteration and English regardless — it only affects
 * the summary wording, which this function discards.
 */
export function detectRedFlag(
  turns: ChatTurn[],
  locale: SupportedLanguage = 'hi-IN',
): boolean {
  const transcript = transcriptOf(turns);
  if (transcript.trim() === '') return false;
  return fallbackTriage(transcript, locale).risk_level === 'high';
}

export type NextAction =
  | { kind: 'ask' }
  | { kind: 'assess'; reason: 'red-flag' | 'turn-cap' | 'model' };

/**
 * The decision, in precedence order: safety first, then the budget, then keep
 * asking.
 *
 * `reason: 'model'` is never produced HERE. It is the third way a conversation
 * can end — the model judging it has enough to classify — and it is in the union
 * so that the route and the component can report why an assessment arrived using
 * one vocabulary instead of two.
 */
export function nextAction(
  turns: ChatTurn[],
  locale: SupportedLanguage = 'hi-IN',
  max: number = MAX_QUESTIONS,
): NextAction {
  if (detectRedFlag(turns, locale)) return { kind: 'assess', reason: 'red-flag' };
  if (shouldForceAssessment(turns, max)) {
    return { kind: 'assess', reason: 'turn-cap' };
  }
  return { kind: 'ask' };
}

/** Immutable append. Returns a new array; the input is never touched. */
export function appendTurn(turns: ChatTurn[], turn: ChatTurn): ChatTurn[] {
  return [...(turns ?? []), turn];
}

/**
 * The user's words, in order, and nothing else.
 *
 * This string is what becomes `health_records.symptoms` and what feeds
 * `fallbackTriage`. The assistant's questions are excluded on purpose: leaving
 * them in would put the model's vocabulary — including any keyword it happened
 * to echo — into a field that is supposed to hold what the patient said, and
 * would make the red-flag check fire on the assistant's own phrasing.
 */
export function transcriptOf(turns: ChatTurn[]): string {
  return (turns ?? [])
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.text.trim())
    .filter((text) => text !== '')
    .join('\n');
}

/**
 * The bounded-progress numerator. `1`-based and clamped to `max`, so the label
 * reads "question 3 of up to 3" rather than "question 4 of up to 3" on the turn
 * the cap is reached.
 */
export function questionOrdinal(
  turns: ChatTurn[],
  max: number = MAX_QUESTIONS,
): number {
  return Math.min(countAssistantQuestions(turns) + 1, max);
}
