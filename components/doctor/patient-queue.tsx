'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { AdvisoryNote } from '@/components/system/advisory-note';
import { BiLabel } from '@/components/system/bi-label';
import { RiskBadge } from '@/components/system/risk-badge';
import { Button } from '@/components/ui/button';
import { PlateSkeleton } from './field';
import { complaintSnippet, orderQueue, type QueueRow } from './queue-order';
import { prefetchSummary } from './summary-cache';
import { formatDate } from './format';

/**
 * The doctor's queue. `/doctor` IS the list — a separate patient-index route
 * would be the same screen at a second URL. Rows link to
 * `/doctor/patient/?id=…`, a query parameter rather than a path segment so the
 * static export does not have to know every patient id at build time.
 *
 * Two things carry this screen:
 *
 * 1. **Order.** `orderQueue` sorts risk descending, then recency, so a `high`
 *    patient is never rendered below a `low` one. That is the one property here
 *    with a clinical consequence, which is why it lives in a pure function with
 *    a test rather than in a `.sort()` inside the JSX.
 *
 * 2. **Warm-up.** Pressing a row starts the Longitudinal_Summary request before
 *    the route transition begins, and the cache is a module singleton, so the
 *    panel finds it resolved on mount. `onPointerDown` fires before navigation;
 *    `onClick` covers keyboard activation. Both are fire-and-forget — nothing
 *    waits on them, so a cold network costs nothing here.
 */
export function PatientQueue() {
  const { t, locale } = useT();
  const [rows, setRows] = useState<QueueRow[] | null>(null);

  useEffect(() => {
    let live = true;

    void (async () => {
      const patients = await repo.listPatients();
      const built = await Promise.all(
        patients.map(async (patient): Promise<QueueRow> => {
          const records = await repo.listRecordsForPatient(patient.id);
          const latest = records[0] ?? null;
          return {
            patient,
            latest,
            decided: latest?.clinicalDecision !== undefined,
          };
        }),
      );
      if (live) setRows(orderQueue(built));
    })();

    return () => {
      live = false;
    };
  }, []);

  if (rows === null) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <PlateSkeleton lines={2} />
        <PlateSkeleton lines={2} />
        <PlateSkeleton lines={2} />
      </div>
    );
  }

  return (
    <>
      <section className="plate p-4" data-state="action">
        <BiLabel
          k="doctor.queue"
          className="text-headline leading-tight font-extrabold text-ink"
        />
        {/* One advisory for the whole list, which is what lets each row's badge
            opt out of repeating it (Req 10.1, 10.2). */}
        <AdvisoryNote className="mt-2" />
      </section>

      {rows.length === 0 ? (
        <section className="plate p-4" data-state="neutral">
          <p lang={locale} className="max-w-[70ch] text-field font-semibold text-ink">
            {t('empty.doctor.patients')}
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/doctor/referrals">
              <BiLabel k="nav.board" />
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ patient, latest, decided }) => (
            <li key={patient.id}>
              <Link
                href={`/doctor/patient/?id=${encodeURIComponent(patient.id)}`}
                onPointerDown={() => prefetchSummary(patient.id)}
                onClick={() => prefetchSummary(patient.id)}
                className="plate flex min-h-touch-lg flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                data-state={latest ? latest.riskLevel : 'neutral'}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-title leading-tight font-semibold text-ink">
                    {patient.fullName}
                  </span>

                  <span className="text-caption font-semibold text-ink-muted">
                    {[
                      patient.age !== null ? `${t('intake.age')} ${patient.age}` : null,
                      patient.gender,
                      patient.village,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>

                  {latest ? (
                    <>
                      <span lang={locale} className="text-body text-ink">
                        {complaintSnippet(latest.symptoms)}
                      </span>
                      <span className="text-caption font-semibold text-ink-muted">
                        {formatDate(latest.timestamp, locale)}
                      </span>
                      <span
                        lang={locale}
                        className="w-fit rounded-chip border-2 border-line bg-sunk px-2 py-0.5 text-caption font-semibold text-ink"
                      >
                        {decided ? t('decision.recorded') : t('decision.none')}
                      </span>
                    </>
                  ) : (
                    <span lang={locale} className="text-body text-ink-muted">
                      {t('empty.patient.record')}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {latest && (
                    <RiskBadge
                      risk={latest.riskLevel}
                      triageSource={latest.triageSource}
                      showAdvisory={false}
                    />
                  )}
                  <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-ink" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
