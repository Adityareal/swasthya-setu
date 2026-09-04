'use client';

import { useT, type MessageKey } from '@/lib/i18n';
import {
  VITALS_FIELDS,
  type VitalsDraft,
  type VitalsErrors,
  type VitalsField,
} from '@/lib/intake/vitals';
import { Input } from '@/components/ui/input';
import { BiLabel } from '@/components/system/bi-label';

/**
 * The Vitals form (Req 8.1–8.5).
 *
 * EVERY field is optional and the header says so, once, instead of five
 * "optional" markers. A form where everything is optional and nothing says so
 * reads as a form where everything is required.
 *
 * All five inputs are `type="text"` with `inputMode="decimal"`, not
 * `type="number"`. A number input silently discards non-numeric keystrokes,
 * which would make Requirement 8.5 — show a field-level message for
 * non-numeric input — unreachable through the UI. The validation lives in
 * `parseVitals`, where it can be tested.
 */

const LABEL: Record<VitalsField, MessageKey> = {
  bloodPressure: 'vitals.bloodPressure',
  pulse: 'vitals.pulse',
  temperature: 'vitals.temperature',
  spo2: 'vitals.spo2',
  weight: 'vitals.weight',
};

const UNIT: Partial<Record<VitalsField, MessageKey>> = {
  pulse: 'vitals.pulse.unit',
  temperature: 'vitals.temperature.unit',
  spo2: 'vitals.spo2.unit',
  weight: 'vitals.weight.unit',
};

const PLACEHOLDER: Partial<Record<VitalsField, string>> = {
  pulse: '78',
  temperature: '37.0',
  spo2: '97',
  weight: '54',
};

export function VitalsForm({
  draft,
  errors,
  onChange,
  disabled = false,
}: {
  draft: VitalsDraft;
  errors: VitalsErrors;
  onChange: (field: VitalsField, value: string) => void;
  disabled?: boolean;
}) {
  const { t, locale } = useT();

  return (
    <fieldset className="plate flex flex-col gap-3 p-4" disabled={disabled}>
      <legend className="sr-only">{t('vitals.title')}</legend>

      <div>
        <BiLabel k="vitals.title" className="text-title font-semibold text-ink" />
        <p lang={locale} className="mt-1 text-caption font-semibold text-ink-muted">
          {t('vitals.optional')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VITALS_FIELDS.map((field) => {
          const errorKey = errors[field];
          const id = `vitals-${field}`;
          const unitKey = UNIT[field];

          return (
            <div key={field} className="flex flex-col gap-1">
              <label
                htmlFor={id}
                lang={locale}
                className="text-caption font-semibold text-ink-muted uppercase"
              >
                {t(LABEL[field])}
                {unitKey && (
                  <span className="ml-1 normal-case text-ink-muted">
                    ({t(unitKey)})
                  </span>
                )}
              </label>
              <Input
                id={id}
                name={field}
                type="text"
                inputMode={field === 'bloodPressure' ? 'text' : 'decimal'}
                autoComplete="off"
                className="tabular"
                value={draft[field]}
                aria-invalid={errorKey ? true : undefined}
                aria-describedby={errorKey ? `${id}-error` : undefined}
                placeholder={
                  field === 'bloodPressure'
                    ? t('vitals.bloodPressure.placeholder')
                    : PLACEHOLDER[field]
                }
                onChange={(event) => onChange(field, event.target.value)}
              />
              {errorKey && (
                <p
                  id={`${id}-error`}
                  lang={locale}
                  className="text-caption font-semibold text-high"
                >
                  {t(errorKey)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
