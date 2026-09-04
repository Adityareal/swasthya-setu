import type { ReferralStatus } from '@/lib/types';
import type { MessageKey } from '@/lib/i18n';
import type { SignalState } from '@/components/system/plate';

/**
 * The two lookups the board and the card share, declared once so a column
 * header and the card beneath it can never disagree about a status.
 */

export const REFERRAL_STATUS_KEY: Record<ReferralStatus, MessageKey> = {
  referred: 'referral.status.referred',
  in_progress: 'referral.status.in_progress',
  completed: 'referral.status.completed',
};

/**
 * Signal Rail state per status. Blue for raised (it is a routing instruction
 * waiting on someone), ochre for in flight, green for closed — a progression
 * the eye reads down the column before it reads a word. The risk palette is
 * not borrowed for decoration: no referral card carries a risk colour, because
 * a referral has no risk level.
 */
export const REFERRAL_STATE: Record<ReferralStatus, SignalState> = {
  referred: 'action',
  in_progress: 'medium',
  completed: 'low',
};
