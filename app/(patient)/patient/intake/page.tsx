'use client';

import { useEffect, useState } from 'react';
import type { Patient } from '@/lib/types';
import { useAppStore, useIntakeSubjectId } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import {
  completeIntake,
  type IntakeConfirmation,
} from '@/lib/intake/complete-intake';
import { SymptomChat, type ChatOutcome } from '@/components/triage/symptom-chat';
import { IntakeConfirmationView } from '@/components/intake/intake-confirmation';
import { Plate, TitledPlate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';

/**
 * Patient self-service intake (Req 6).
 *
 * The subject is the Patient_User's own id, resolved through
 * `getIntakeSubjectId()` — the single place subject resolution happens — so the
 * Patient_Picker is not hidden by a conditional here, it is simply absent
 * (Req 5.4).
 *
 * No Vitals form: a patient measuring their own blood pressure is not the
 * scenario. Larger type, fewer controls, one decision per screen. The Continue
 * behaviour is `completeIntake`, the SAME function the ASHA path calls.
 */
export default function PatientIntakePage() {
  const { t, locale } = useT();
  const patientId = useIntakeSubjectId();
  const setLastTriage = useAppStore((s) => s.setLastTriage);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [outcome, setOutcome] = useState<ChatOutcome | null>(null);
  const [confirmation, setConfirmation] = useState<IntakeConfirmation | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    void repo.getPatient(patientId).then(setPatient);
  }, [patientId]);

  async function onComplete(result: ChatOutcome) {
    if (!patientId || saving) return;
    setOutcome(result);
    setSaving(true);
    setErrorKey(null);

    /* Survives a remount without re-running the assessment. */
    setLastTriage({
      risk_level: result.risk,
      summary: result.summary,
      recommended_next_step: result.recommendedNextStep,
      source: result.source,
      red_flags: result.redFlags,
      matched: [],
    });

    const written = await completeIntake({
      patientId,
      outcome: result,
      authorRole: 'patient',
      authorId: patientId,
    });

    if (written.ok) setConfirmation(written.value);
    else setErrorKey(written.reasonKey);
    setSaving(false);
  }

  if (!patientId) {
    return <TitledPlate title={t('common.loading')} state="neutral" />;
  }

  if (confirmation && outcome) {
    return (
      <IntakeConfirmationView
        confirmation={confirmation}
        risk={outcome.risk}
        source={outcome.source}
        summary={outcome.summary}
        recommendedNextStep={outcome.recommendedNextStep}
        homeHref="/patient"
      />
    );
  }

  return (
    <>
      <Plate state="action" className="p-4" as="section">
        <BiLabel k="chat.title" className="text-headline font-extrabold text-ink" />
        {patient && (
          <p lang={locale} className="mt-1 text-caption font-semibold text-ink-muted">
            {t('intake.subject')}: {patient.fullName}
          </p>
        )}
      </Plate>

      {saving && <TitledPlate title={t('common.saving')} state="neutral" />}

      {errorKey && (
        <Plate state="error" className="p-4" as="section">
          <p lang={locale} className="text-field font-semibold text-ink">
            {t('common.error')}
          </p>
          <p lang={locale} className="mt-1 text-caption font-semibold text-ink-muted">
            {errorKey}
          </p>
        </Plate>
      )}

      {/* Kept mounted while saving. Unmounting it would discard the conversation
          the moment a write failed, which is the one moment it is needed. Double
          submission is already blocked in `onComplete`. */}
      <SymptomChat
        {...(patient ? { patient: { age: patient.age, gender: patient.gender } } : {})}
        onComplete={(result) => void onComplete(result)}
      />
    </>
  );
}
