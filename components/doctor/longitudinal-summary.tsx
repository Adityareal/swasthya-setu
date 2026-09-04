'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { SummaryResponse } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { AdvisoryNote } from '@/components/system/advisory-note';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { PlateSkeleton } from './field';
import { loadSummary, peekSummary } from './summary-cache';

/**
 * Longitudinal_Summary (Req 14.2, 14.3, 10.1).
 *
 * The request fires ON MOUNT when the cache is cold. The queue row's click is a
 * WARM-UP, never the only trigger: a doctor arriving by deep link, a bookmark,
 * or a page reload has clicked no row, and a screen whose central plate only
 * fills in when you came the scenic route is broken.
 *
 * `<AdvisoryNote>` is rendered from inside this component, not beside it at the
 * call site, so a caller cannot put a synthesised summary on screen without it.
 *
 * The degraded path is the normal path MINUS ONE PLATE. It is never a blank
 * screen and never an empty container: the caller renders the full visit
 * history unconditionally, this component renders the notice, and there is
 * exactly ONE manual Retry. No timer, no automatic re-request, no loop — the
 * cache holds the failure precisely so that a remount does not re-ask.
 */
export function LongitudinalSummary({ patientId }: { patientId: string }) {
  const { t, locale } = useT();

  /* Initialised to null rather than to the cache: reading a client-only cache
     during the first render would make the hydration output differ from the
     server's. The cache is consulted in the effect instead, which costs one
     frame and buys a screen that never mismatches. */
  const [response, setResponse] = useState<SummaryResponse | null>(null);
  const [pending, setPending] = useState(false);

  const run = useCallback(
    (force: boolean) => {
      let live = true;
      setPending(true);
      void loadSummary(patientId, { force }).then((next) => {
        if (!live) return;
        setResponse(next);
        setPending(false);
      });
      return () => {
        live = false;
      };
    },
    [patientId],
  );

  useEffect(() => {
    const warm = peekSummary(patientId);
    if (warm) {
      setResponse(warm);
      return;
    }
    return run(false);
  }, [patientId, run]);

  /* ——— Loading: a plate-shaped skeleton, never a spinner over content ——— */
  if (!response || pending) {
    return (
      <section aria-busy="true" className="flex flex-col gap-2">
        <p
          lang={locale}
          className="text-caption font-semibold text-ink-muted uppercase"
        >
          {t('doctor.summary.loading')}
        </p>
        <PlateSkeleton lines={4} />
      </section>
    );
  }

  /* Nothing to synthesise is not a failure. An error rail and a Retry button
     here would be a false alarm, and pressing Retry cannot invent a history. */
  if (response.reason === 'empty-history') {
    return (
      <section className="plate flex flex-col gap-2 p-4" data-state="neutral">
        <BiLabel
          k="doctor.summary.title"
          className="text-title font-semibold text-ink"
        />
        <p lang={locale} className="max-w-[70ch] text-body font-semibold text-ink">
          {t('timeline.empty')}
        </p>
      </section>
    );
  }

  /* ——— Req 14.3 — unavailable. One notice, one Retry. ——— */
  if (response.unavailable || response.summary === null) {
    return (
      <section className="plate flex flex-col gap-3 p-4" data-state="error">
        <BiLabel
          k="doctor.summary.title"
          className="text-title font-semibold text-ink"
        />
        <p lang={locale} className="max-w-[70ch] text-body font-semibold text-ink">
          {t('doctor.summary.unavailable')}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => run(true)}
          className="w-fit"
        >
          <RefreshCw aria-hidden="true" />
          <span lang={locale}>{t('doctor.summary.retry')}</span>
        </Button>
      </section>
    );
  }

  return (
    <section className="plate flex flex-col gap-3 p-4" data-state="action">
      <BiLabel
        k="doctor.summary.title"
        className="text-title font-semibold text-ink"
      />

      {/* Measure capped at 65–75ch, which is where prose stays readable. */}
      <p lang={locale} className="max-w-[70ch] text-body text-ink">
        {response.summary}
      </p>

      {/* The template path is a restatement of stored rows, not inference, and
          it says so rather than passing itself off as a model output. */}
      {response.source === 'template' && (
        <p
          lang={locale}
          className="w-fit rounded-chip border-2 border-line bg-sunk px-2 py-0.5 text-caption font-semibold text-ink"
        >
          {t('advisory.source.template')}
        </p>
      )}

      <AdvisoryNote />
    </section>
  );
}
