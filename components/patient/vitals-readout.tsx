'use client';

import { Activity } from 'lucide-react';
import type { Vitals } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { vitalsRows } from './timeline-model';

/**
 * Req 8.6 — the Vitals an ASHA measured, shown to the patient with the entry
 * they belong to.
 *
 * A two-column grid of label-over-value rather than a table: at 360px a table
 * either scrolls sideways or shrinks below the 18px floor, and both are worse
 * than a grid. Values run `tabular` so a column of numbers lines up.
 *
 * Absent fields are absent, not dashes. When nothing was measured the caller
 * gets `vitals.none` — an intake carrying no measurement is a legitimate,
 * complete intake (Req 8.3, 8.4), so this is a normal state and not an error.
 */
export function VitalsReadout({
  vitals,
  className,
}: {
  vitals: Vitals | undefined;
  className?: string;
}) {
  const { t, locale } = useT();
  const rows = vitalsRows(vitals);

  if (rows.length === 0) {
    return (
      <p
        lang={locale}
        className={cn('text-caption font-semibold text-ink-muted', className)}
      >
        {t('vitals.none')}
      </p>
    );
  }

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <h4
        lang={locale}
        className="flex items-center gap-2 text-caption font-semibold text-ink-muted uppercase"
      >
        <Activity aria-hidden="true" className="size-4 shrink-0" />
        {t('vitals.title')}
      </h4>

      <dl className="grid grid-cols-2 gap-2">
        {rows.map(({ field, labelKey, unitKey, value }) => (
          <div
            key={field}
            className="rounded-plate border-2 border-line bg-sunk px-2 py-1"
          >
            <dt
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t(labelKey)}
            </dt>
            <dd className="tabular text-field font-semibold text-ink">
              {value}
              {unitKey && (
                <span lang={locale} className="ml-1 text-caption text-ink-muted">
                  {t(unitKey)}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
