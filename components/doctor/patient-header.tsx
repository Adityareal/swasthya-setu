'use client';

import type { Patient } from '@/lib/types';
import { useT, type MessageKey } from '@/lib/i18n';
import { BiText } from '@/components/system/bi-label';

/**
 * The Doctor_Panel header. Identity first, and the preferred language with it —
 * a doctor who does not know the patient reads Hindi only is about to hand over
 * a plan the patient cannot follow.
 */

const LANGUAGE_LABEL: Record<Patient['preferredLanguage'], MessageKey> = {
  'en-IN': 'app.language.en',
  'hi-IN': 'app.language.hi',
};

export function PatientHeader({ patient }: { patient: Patient }) {
  const { t, locale } = useT();

  const facts: Array<{ label: MessageKey; value: string }> = [
    ...(patient.age !== null
      ? [{ label: 'intake.age' as MessageKey, value: String(patient.age) }]
      : []),
    ...(patient.gender
      ? [{ label: 'intake.gender' as MessageKey, value: patient.gender }]
      : []),
    ...(patient.village
      ? [{ label: 'intake.village' as MessageKey, value: patient.village }]
      : []),
    {
      label: 'patient.register.language',
      value: t(LANGUAGE_LABEL[patient.preferredLanguage]),
    },
  ];

  return (
    <section className="plate p-4" data-state="action">
      <p
        lang={locale}
        className="text-caption font-semibold text-ink-muted uppercase"
      >
        {t('doctor.panel')}
      </p>

      <BiText
        primary={patient.fullName}
        {...(patient.village ? { secondary: patient.village } : {})}
        className="mt-1 text-headline leading-tight font-extrabold text-ink"
      />

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {facts.map(({ label, value }) => (
          <div key={label} className="flex min-w-20 flex-col">
            <dt
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t(label)}
            </dt>
            <dd className="text-body font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
