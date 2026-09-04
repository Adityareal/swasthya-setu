'use client';

import { useState } from 'react';
import type { Referral, ReferralStatus } from '@/lib/types';
import { groupByStatus, REFERRAL_COLUMNS } from '@/lib/referral/group';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { ReferralCard } from './referral-card';
import { REFERRAL_STATE, REFERRAL_STATUS_KEY } from './status';

/**
 * Referral_Tracker — the closed-loop board (Req 17).
 *
 * Built as a component rather than as a page so both worker roles render the
 * same board from the same three columns; the route only supplies the rows and
 * the write.
 *
 * LAYOUT: the columns STACK VERTICALLY at 360px and only sit side by side above
 * 768px. Requirement 22.3 states no horizontal scrolling in any primary flow
 * and grants no exception, so the earlier horizontal scroll-snap treatment is
 * gone. A vertical stack also matches how the board is actually used on a phone:
 * one column at a time, thumb-scrolled.
 *
 * The three columns come from `groupByStatus`, which always returns all three
 * keys — so an EMPTY column still renders (Req 17.2). The empty `completed`
 * column is the visual proof the loop exists before anything has closed
 * through it.
 */

export type AdvanceOutcome = { ok: true } | { ok: false; reasonKey: string };

export function ReferralBoard({
  referrals,
  patientNames,
  advance,
  onAdvanced,
  loading = false,
}: {
  referrals: Referral[];
  /** `patients.id` → full name. Absent names fall back to the id. */
  patientNames?: Record<string, string>;
  /**
   * The write. Injected so the board is role-agnostic, and so the ONLY
   * enforcement layer stays where it is: this function is expected to delegate
   * to `repo.advanceReferralStatus`, which refuses an illegal transition before
   * touching the row.
   */
  advance: (id: string, to: ReferralStatus) => Promise<AdvanceOutcome>;
  /** Called after an accepted write so the caller can re-read the repo. */
  onAdvanced?: () => void;
  loading?: boolean;
}) {
  const { t } = useT();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejection, setRejection] = useState<{
    id: string;
    reasonKey: string;
  } | null>(null);

  const board = groupByStatus(referrals);

  async function handleAdvance(referral: Referral, to: ReferralStatus) {
    if (busyId) return;
    setBusyId(referral.id);
    setRejection(null);

    const outcome = await advance(referral.id, to);
    setBusyId(null);

    if (outcome.ok) {
      /* No local mutation of the row: the repo is authoritative and the caller
         re-reads it. That is what keeps this board and the patient's own view
         of the same referral in step (Req 4.2). */
      onAdvanced?.();
      return;
    }
    setRejection({ id: referral.id, reasonKey: outcome.reasonKey });
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3 md:items-start">
      {REFERRAL_COLUMNS.map((status) => {
        const column = board[status];
        const headingId = `referral-column-${status}`;

        return (
          <section
            key={status}
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-2"
          >
            <Plate state={REFERRAL_STATE[status]} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id={headingId} className="min-w-0">
                  <BiLabel
                    k={REFERRAL_STATUS_KEY[status]}
                    className="text-title font-semibold text-ink"
                  />
                </h3>
                <span
                  aria-hidden="true"
                  className="tabular text-title font-extrabold text-ink"
                >
                  {loading ? '–' : column.length}
                </span>
              </div>
            </Plate>

            {loading ? (
              /* Plate-shaped skeleton, never a spinner over content. */
              <div className="skeleton-plate h-32" aria-hidden="true" />
            ) : column.length === 0 ? (
              <Plate className="p-3">
                <p className="text-caption font-semibold text-ink-muted">
                  {t('empty.referral.board')}
                </p>
              </Plate>
            ) : (
              <ul className="flex min-w-0 flex-col gap-2">
                {column.map((referral) => (
                  <ReferralCard
                    key={referral.id}
                    referral={referral}
                    {...(patientNames?.[referral.patientId]
                      ? { patientName: patientNames[referral.patientId] }
                      : {})}
                    busy={busyId === referral.id}
                    {...(rejection?.id === referral.id
                      ? { rejectionReasonKey: rejection.reasonKey }
                      : {})}
                    onAdvance={(row, to) => void handleAdvance(row, to)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <p className="sr-only" role="status">
        {loading ? t('common.loading') : t('referral.title')}
      </p>
    </div>
  );
}
