'use client';

import { useCallback, useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import type { Referral, ReferralStatus } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import {
  ReferralBoard,
  type AdvanceOutcome,
} from '@/components/referral/referral-board';

/**
 * The doctor's Referral_Tracker (Req 17).
 *
 * The route owns the reads and the write; `<ReferralBoard>` owns the three
 * columns. Both live apart so the same board can be mounted for an ASHA_User
 * without copying a column layout.
 *
 * Nothing is cached beyond this component's state and every accepted advance
 * triggers a fresh `listReferrals()`, so the row this board writes is the row
 * the patient's own view reads (Req 4.2).
 */
export default function DoctorReferralsPage() {
  const { t, locale } = useT();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [rows, patients] = await Promise.all([
      repo.listReferrals(),
      repo.listPatients(),
    ]);
    setReferrals(rows);
    setPatientNames(
      Object.fromEntries(patients.map((p) => [p.id, p.fullName])),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * `advanceReferralStatus` delegates to `advanceReferral`, the only
   * enforcement layer — there is no database trigger behind it. An illegal
   * request returns a reason key and writes nothing, and the board renders that
   * reason on the card (Req 17.4).
   */
  async function advance(
    id: string,
    to: ReferralStatus,
  ): Promise<AdvanceOutcome> {
    const result = await repo.advanceReferralStatus(id, to);
    return result.ok ? { ok: true } : { ok: false, reasonKey: result.reasonKey };
  }

  return (
    <>
      <Plate state="action" className="p-4" as="section">
        <div className="flex items-start gap-3">
          <Share2 aria-hidden="true" className="mt-1 size-6 shrink-0 text-action" />
          <div className="min-w-0">
            <h1>
              <BiLabel
                k="referral.title"
                className="text-headline leading-tight font-extrabold text-ink"
              />
            </h1>
            {/* The loop, spelled out: the board's whole claim is that a
                referral ends somewhere. */}
            <p
              lang={locale}
              className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted"
            >
              {t('referral.status.referred')} → {t('referral.status.in_progress')}{' '}
              → {t('referral.status.completed')}
            </p>
          </div>
        </div>
      </Plate>

      <ReferralBoard
        referrals={referrals}
        patientNames={patientNames}
        advance={advance}
        onAdvanced={() => void load()}
        loading={loading}
      />
    </>
  );
}
