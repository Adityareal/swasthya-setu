'use client';

import { ListOrdered } from 'lucide-react';
import type { DashboardStats } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';

/**
 * The top symptom terms — a ranked LIST, deliberately not a chart.
 *
 * `topSymptomTerms` counts words in recorded `symptoms` strings, once per
 * record. Drawing word frequency as a bar chart would dress a tokenizer up as
 * epidemiology; a numbered list says "these words came up most often", which is
 * exactly and only what the number means.
 */
export function TermListPlate({
  terms,
}: {
  terms: DashboardStats['topSymptomTerms'];
}) {
  const { t, locale } = useT();

  return (
    <Plate className="p-3" as="section">
      <h2 className="flex items-center gap-2">
        <ListOrdered aria-hidden="true" className="size-5 shrink-0 text-action" />
        <BiLabel k="dashboard.hotspots" className="text-title font-semibold text-ink" />
      </h2>

      <p
        lang={locale}
        className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted"
      >
        {t('dashboard.terms.method')}
      </p>

      {terms.length === 0 ? (
        <BiLabel
          k="dashboard.empty"
          className="mt-3 text-caption font-semibold text-ink-muted"
        />
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {terms.map((entry, index) => (
            <li
              key={entry.term}
              className="flex min-w-0 items-baseline justify-between gap-3 border-b-2 border-line-soft pb-1 last:border-b-0 last:pb-0"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span
                  aria-hidden="true"
                  className="tabular shrink-0 text-caption font-extrabold text-ink-muted"
                >
                  {index + 1}
                </span>
                <span
                  lang={locale}
                  className="min-w-0 text-body font-semibold break-words text-ink"
                >
                  {entry.term}
                </span>
              </span>
              <span className="tabular shrink-0 text-body font-extrabold text-ink">
                {entry.count}
                <span className="sr-only">{` ${t('dashboard.records')}`}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Plate>
  );
}
