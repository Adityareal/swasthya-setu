import type { ReferralStatus } from '@/lib/types';

/**
 * Referral state machine — pure, no database, no imports beyond types.
 *
 * `advanceReferral()` IS THE ONLY ENFORCEMENT LAYER. The previous design
 * claimed three — the UI, this function, and a Postgres `before update`
 * trigger — and two of those went with the database. One layer is sufficient
 * here for a specific reason: the repo is the only writer and the check sits
 * inside it rather than in a caller that could be bypassed. It would NOT be
 * sufficient with multiple clients, which is exactly what the trigger existed
 * for.
 */
export const REFERRAL_TRANSITIONS = {
  referred: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
} as const satisfies Record<ReferralStatus, readonly ReferralStatus[]>;

export type TransitionReasonKey =
  | 'referral.error.same'
  | 'referral.error.terminal'
  | 'referral.error.illegal';

export type TransitionResult =
  | { ok: true; next: ReferralStatus }
  | { ok: false; reasonKey: TransitionReasonKey };

/**
 * Accepts exactly `referred → in_progress` and `in_progress → completed`.
 * Every other ordered pair is rejected with a **message key**, not a sentence,
 * so the reason is localisable (Req 17.4 requires displaying it) and the tests
 * assert on stable identifiers rather than on copy that will change.
 */
export function advanceReferral(
  from: ReferralStatus,
  to: ReferralStatus,
): TransitionResult {
  if (from === 'completed') {
    return { ok: false, reasonKey: 'referral.error.terminal' };
  }
  if (from === to) {
    return { ok: false, reasonKey: 'referral.error.same' };
  }
  const allowed: readonly ReferralStatus[] = REFERRAL_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return { ok: false, reasonKey: 'referral.error.illegal' };
  }
  return { ok: true, next: to };
}

/**
 * Drives the board: each card renders exactly one advance button, labelled with
 * the only legal next state, and `completed` cards render none. So illegal
 * transitions are unreachable through the UI.
 */
export function nextStatus(from: ReferralStatus): ReferralStatus | null {
  const allowed: readonly ReferralStatus[] = REFERRAL_TRANSITIONS[from];
  return allowed.length > 0 ? allowed[0] : null;
}
