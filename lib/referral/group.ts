import type { Referral, ReferralStatus } from '@/lib/types';

export const REFERRAL_COLUMNS: readonly ReferralStatus[] = [
  'referred',
  'in_progress',
  'completed',
];

export type ReferralBoard = Record<ReferralStatus, Referral[]>;

/**
 * Exactly three columns, always. Every referral appears in exactly one column
 * and the union of the columns equals the input — nothing dropped, nothing
 * duplicated. **Empty columns are still present**, because a board that hides
 * its empty states stops being a board (Req 17.2, 17.5).
 */
export function groupByStatus(referrals: Referral[]): ReferralBoard {
  const board: ReferralBoard = {
    referred: [],
    in_progress: [],
    completed: [],
  };
  for (const r of referrals ?? []) {
    board[r.status].push(r);
  }
  return board;
}
