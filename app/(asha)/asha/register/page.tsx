'use client';

import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import type { Patient } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { PatientRegisterForm } from '@/components/asha/patient-register-form';

/**
 * Register a patient (Req 7.3).
 *
 * On a written row this screen does two things in one step: it opens the
 * Assisted_Session for the new patient and lands on intake. Registration is
 * never the goal — someone is standing there waiting — so the flow does not
 * stop to congratulate itself and does not send the ASHA back to a picker to
 * find the patient she just typed in.
 */
export default function AshaRegisterPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const setAssistedSubjectId = useAppStore((s) => s.setAssistedSubjectId);

  function onRegistered(patient: Patient) {
    setAssistedSubjectId(patient.id);
    router.push('/asha/intake');
  }

  return (
    <>
      <Plate state="action" className="p-4" as="section">
        <div className="flex items-start gap-3">
          <UserPlus aria-hidden="true" className="mt-1 size-6 shrink-0 text-action" />
          <div className="min-w-0">
            <h1>
              <BiLabel
                k="patient.register.title"
                className="text-headline leading-tight font-extrabold text-ink"
              />
            </h1>
            <p
              lang={locale}
              className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted"
            >
              {t('patient.register.save')}
            </p>
          </div>
        </div>
      </Plate>

      <PatientRegisterForm onRegistered={onRegistered} />
    </>
  );
}
