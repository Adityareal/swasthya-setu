'use client';

import type { Vitals } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';

/**
 * Stored Vitals, displayed with the entry that carries them (Req 8.6).
 *
 * Values are rendered VERBATIM — no rounding, no unit conversion, no
 * re-derivation. A blood pressure is the one part of this record that has no
 * ambiguity in it, and every transformation is a chance to introduce one.
 */

const ROWS: Array<{
  field: keyof Vitals;
  label: MessageKey;
  unit?: MessageKey;
}> = [
  { field: 'bloodPressure', label: 'vitals.bloodPressure' },
  { field: 'pulse', label: 'vitals.pulse', unit: 'vitals.pulse.unit' },
  {
    field: 'temperature',
    label: 'vitals.temperature',
    unit: 'vitals.temperature.unit',
  },
  { field: 'spo2', label: 'vitals.spo2', unit: 'vitals.spo2.unit' },
  { field: 'weight', label: 'vitals.weight', unit: 'vitals.weight.unit' },
];

export function VitalsReadout({
  vitals,
  className,
}: {
  vitals?: Vitals;
  className?: string;
}) {
  const { t, locale } = useT();

  const present = ROWS.filter(({ field }) => {
    const value = vitals?.[field];
    return value !== undefined && value !== null && `${value}`.trim() !== '';
  });

  if (present.length === 0) {
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
    <dl className={cn('flex flex-wrap gap-x-6 gap-y-2', className)}>
      {present.map(({ field, label, unit }) => (
        <div key={field} className="flex min-w-24 flex-col">
          <dt
            lang={locale}
            className="text-caption font-semibold text-ink-muted uppercase"
          >
            {t(label)}
          </dt>
          <dd className="tabular text-body font-semibold text-ink">
            {String(vitals?.[field])}
            {unit && (
              <span className="ml-1 text-caption font-semibold text-ink-muted">
                {t(unit)}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
