'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Building2, Share2 } from 'lucide-react';
import type { DashboardStats, ReferralStatus, RiskLevel } from '@/lib/types';
import { repo } from '@/lib/data/memory-repo';
import { useT, type MessageKey } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { MockPlate } from '@/components/system/mock-plate';
import { BarPlate, type BarRowDatum } from '@/components/dashboard/bar-plate';
import { HotspotPlate } from '@/components/dashboard/hotspot-plate';
import { StatPlate } from '@/components/dashboard/stat-plate';
import { TermListPlate } from '@/components/dashboard/term-list-plate';
import {
  buildHotspots,
  facilityBars,
  referralBars,
  referralThroughput,
  riskBars,
  type HotspotView,
} from '@/components/dashboard/dashboard-view';

/**
 * The District_Dashboard (Req 20.4).
 *
 * Every number on this screen is a COUNT of rows that already exist. There is no
 * model, no forecast and no inference, and the screen is wrapped in a
 * `<MockPlate>` that says so before anyone reads a figure (Req 20.1).
 *
 * One screen, and it stays one screen. A district officer scrolling for the
 * number they came for is a dashboard that failed.
 */

const RISK_KEY: Record<RiskLevel, MessageKey> = {
  high: 'triage.risk.high',
  medium: 'triage.risk.medium',
  low: 'triage.risk.low',
};

/** Risk IS the signal palette's job, so these three bars get the signal fills.
 *  Nothing else on the screen does. */
const RISK_FILL: Record<RiskLevel, string> = {
  high: 'bg-high',
  medium: 'bg-med',
  low: 'bg-low',
};

const REFERRAL_KEY: Record<ReferralStatus, MessageKey> = {
  referred: 'referral.status.referred',
  in_progress: 'referral.status.in_progress',
  completed: 'referral.status.completed',
};

export default function DashboardPage() {
  const { t, tOther, locale } = useT();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotspots, setHotspots] = useState<HotspotView | null>(null);

  useEffect(() => {
    let live = true;

    void (async () => {
      const found = await repo.getDashboardStats();
      if (live) setStats(found);

      /* The hotspot band needs the village a record belongs to, and a record
         carries a patient rather than a village — so the join happens here,
         through the same patient-scoped read every other screen uses. */
      const patients = await repo.listPatients();
      const records = await Promise.all(
        patients.map((patient) => repo.listHealthRecords(patient.id)),
      );
      if (!live) return;
      setHotspots(
        buildHotspots(
          patients.map((patient, index) => ({
            village: patient.village,
            timestamps: records[index].map((record) => record.timestamp),
          })),
        ),
      );
    })();

    return () => {
      live = false;
    };
  }, []);

  const risk = useMemo<BarRowDatum[]>(() => {
    if (!stats) return [];
    return riskBars(stats.byRisk).map((bar) => ({
      ...bar,
      label: t(RISK_KEY[bar.key as RiskLevel]),
      secondary: tOther(RISK_KEY[bar.key as RiskLevel]),
      fill: RISK_FILL[bar.key as RiskLevel],
    }));
  }, [stats, t, tOther]);

  const facilities = useMemo<BarRowDatum[]>(() => {
    if (!stats) return [];
    return facilityBars(stats.byFacility).map((bar) => ({
      ...bar,
      label: bar.facilityName,
    }));
  }, [stats]);

  const referrals = useMemo<BarRowDatum[]>(() => {
    if (!stats) return [];
    return referralBars(stats.referralsByStatus).map((bar) => ({
      ...bar,
      label: t(REFERRAL_KEY[bar.key as ReferralStatus]),
      secondary: tOther(REFERRAL_KEY[bar.key as ReferralStatus]),
    }));
  }, [stats, t, tOther]);

  const throughput = useMemo(
    () =>
      stats
        ? referralThroughput(stats.referralsByStatus)
        : { open: 0, closed: 0, total: 0, closedPercent: 0 },
    [stats],
  );

  return (
    <MockPlate>
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="flex items-center gap-2">
            <Activity aria-hidden="true" className="size-6 shrink-0 text-action" />
            <BiLabel
              k="dashboard.title"
              className="text-headline leading-tight font-extrabold text-ink"
            />
          </h1>
          {/* Req 20.4, 20.5 — the label a judge should not have to hunt for. */}
          <p
            lang={locale}
            className="mt-2 max-w-[70ch] text-caption font-semibold text-ink-muted"
          >
            {t('dashboard.heuristic')}
          </p>
        </header>

        {stats === null ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="skeleton-plate h-24" />
              <div className="skeleton-plate h-24" />
              <div className="skeleton-plate h-24" />
            </div>
            <div className="skeleton-plate h-48" />
            <div className="skeleton-plate h-48" />
            <div className="skeleton-plate h-48" />
          </div>
        ) : (
          <>
            {/* ——— The headline row. One column at 360px. ——— */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatPlate labelKey="dashboard.patients" value={stats.totalPatients} />
              <StatPlate labelKey="dashboard.records" value={stats.totalRecords} />
              <StatPlate
                labelKey="dashboard.referrals"
                value={`${throughput.closed}/${throughput.total}`}
                /* TODO i18n: dashboard.referrals.closedVsOpen */
                caption={`${t('referral.closed')} ${throughput.closed} · open ${throughput.open}`}
              />
            </div>

            <BarPlate titleKey="dashboard.byRisk" bars={risk} />

            <BarPlate
              titleKey="dashboard.byFacility"
              icon={Building2}
              bars={facilities}
            />

            <BarPlate
              titleKey="dashboard.referrals"
              icon={Share2}
              bars={referrals}
              /* TODO i18n: dashboard.referrals.throughput */
              caption={`${throughput.closedPercent}% closed of ${throughput.total} raised.`}
            />

            <TermListPlate terms={stats.topSymptomTerms} />

            {hotspots === null ? (
              <div className="skeleton-plate h-48" aria-hidden="true" />
            ) : (
              <HotspotPlate view={hotspots} />
            )}

            {stats.totalRecords === 0 && (
              <Plate state="neutral" className="p-3" as="section">
                <BiLabel
                  k="dashboard.empty"
                  className="text-title font-semibold text-ink"
                />
              </Plate>
            )}
          </>
        )}
      </div>
    </MockPlate>
  );
}
