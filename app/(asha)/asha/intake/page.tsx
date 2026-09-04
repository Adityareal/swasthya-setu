'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import type { Patient } from '@/lib/types';
import { useAppStore, useIntakeSubjectId } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import {
  EMPTY_VITALS_DRAFT,
  parseVitals,
  type VitalsDraft,
  type VitalsErrors,
  type VitalsField,
} from '@/lib/intake/vitals';
import {
  completeIntake,
  type IntakeConfirmation,
} from '@/lib/intake/complete-intake';
import { SymptomChat, type ChatOutcome } from '@/components/triage/symptom-chat';
import { IntakeConfirmationView } from '@/components/intake/intake-confirmation';
import { VitalsForm } from '@/components/intake/vitals-form';
import { Plate, TitledPlate } from '@/components/system/plate';
import { BiLabel, BiText } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';

/**
 * Assisted intake (Req 7, 8).
 *
 * The subject is `assistedSubjectId`, deliberately NOT persisted across reloads:
 * a stale subject after a refresh is a wrong-patient write, which is the worst
 * defect this product could ship. So the Patient_Picker sits above the form and
 * reappears whenever there is no subject (Req 5.2), and the symptom control does
 * not render at all until one is chosen (Req 5.3) — absence rather than a
 * disabled attribute, because a disabled chat is a chat someone tries to type
 * into.
 *
 * Continue calls `completeIntake`, the SAME function the patient path calls. The
 * only differences on this screen are the subject, the Vitals form, and the
 * author role.
 */
export default function AshaIntakePage() {
  const { t, locale } = useT();
  const subjectId = useIntakeSubjectId();
  const workerId = useAppStore((s) => s.workerId);
  const setAssistedSubjectId = useAppStore((s) => s.setAssistedSubjectId);
  const setLastTriage = useAppStore((s) => s.setLastTriage);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [subject, setSubject] = useState<Patient | null>(null);
  const [draft, setDraft] = useState<VitalsDraft>(EMPTY_VITALS_DRAFT);
  const [vitalsErrors, setVitalsErrors] = useState<VitalsErrors>({});
  const [outcome, setOutcome] = useState<ChatOutcome | null>(null);
  const [confirmation, setConfirmation] = useState<IntakeConfirmation | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    void repo.listPatients().then(setPatients);
  }, []);

  useEffect(() => {
    if (!subjectId) {
      setSubject(null);
      return;
    }
    void repo.getPatient(subjectId).then(setSubject);
  }, [subjectId]);

  /* Req 8.5 — re-validating on every keystroke keeps the accepted values in the
     draft while the message shows, so nothing typed is ever discarded. */
  function onVitalsChange(field: VitalsField, value: string) {
    const next = { ...draft, [field]: value };
    const parsed = parseVitals(next);
    setDraft(next);
    setVitalsErrors(parsed.errors);
    /* Clear the summary error as soon as the form is valid again, so the plate
       does not outlive the problem it describes. */
    if (parsed.ok && errorKey === 'vitals.error.numeric') setErrorKey(null);
  }

  async function onComplete(result: ChatOutcome) {
    if (!subjectId || saving) return;

    const parsed = parseVitals(draft);
    setVitalsErrors(parsed.errors);
    /* A bad Vitals value must not lose the conversation, so the assessment is
       held and the chat is not restarted. */
    if (!parsed.ok) {
      setOutcome(result);
      setErrorKey('vitals.error.numeric');
      return;
    }

    setOutcome(result);
    setSaving(true);
    setErrorKey(null);

    setLastTriage({
      risk_level: result.risk,
      summary: result.summary,
      recommended_next_step: result.recommendedNextStep,
      source: result.source,
      red_flags: result.redFlags,
      matched: [],
    });

    const written = await completeIntake({
      patientId: subjectId,
      outcome: result,
      /* Absent vitals must not block the intake (Req 8.4): `undefined` here is a
         complete, valid submission. */
      ...(parsed.vitals ? { vitals: parsed.vitals } : {}),
      authorRole: 'asha',
      authorId: workerId ?? '',
    });

    if (written.ok) setConfirmation(written.value);
    else setErrorKey(written.reasonKey);
    setSaving(false);
  }

  if (confirmation && outcome) {
    return (
      <IntakeConfirmationView
        confirmation={confirmation}
        risk={outcome.risk}
        source={outcome.source}
        summary={outcome.summary}
        recommendedNextStep={outcome.recommendedNextStep}
        homeHref="/asha"
      />
    );
  }

  /* ——— No subject: the Patient_Picker IS the screen (Req 5.2, 5.3) ——— */
  if (!subjectId || !subject) {
    return (
      <>
        <Plate state="action" className="p-4" as="section">
          <BiLabel
            k="patient.select"
            className="text-headline font-extrabold text-ink"
          />
          <p lang={locale} className="mt-1 text-caption font-semibold text-ink-muted">
            {t('intake.picker.empty')}
          </p>
        </Plate>

        <ul className="flex flex-col gap-2">
          {patients.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => setAssistedSubjectId(candidate.id)}
                className="plate flex min-h-touch-lg w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
              >
                <span className="text-title font-semibold text-ink">
                  {candidate.fullName}
                </span>
                <span className="text-caption font-semibold text-ink-muted">
                  {[
                    candidate.age !== null ? `${t('intake.age')} ${candidate.age}` : null,
                    candidate.gender,
                    candidate.village,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <Button asChild variant="outline" size="field">
          <Link href="/asha/register">
            <UserPlus aria-hidden="true" />
            <BiLabel k="intake.picker.new" />
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      {/* The subject's name, prominently — Req 7.1. An Assisted_Session that
          does not name its subject is how a wrong-patient write happens. */}
      <Plate state="action" className="p-4" as="section">
        <BiLabel
          k="patient.selected"
          className="text-caption font-semibold text-ink-muted uppercase"
        />
        <BiText
          primary={subject.fullName}
          {...(subject.village ? { secondary: subject.village } : {})}
          className="mt-1 text-display leading-tight font-extrabold text-ink"
        />
        <button
          type="button"
          onClick={() => setAssistedSubjectId(null)}
          className="mt-2 min-h-touch text-caption font-semibold text-action underline underline-offset-4"
        >
          {t('patient.select')}
        </button>
      </Plate>

      <VitalsForm
        draft={draft}
        errors={vitalsErrors}
        onChange={onVitalsChange}
        disabled={saving}
      />

      {saving && <TitledPlate title={t('common.saving')} state="neutral" />}

      {errorKey && (
        <Plate state="error" className="p-4" as="section">
          <p lang={locale} className="text-field font-semibold text-ink">
            {t('common.error')}
          </p>
          <p lang={locale} className="mt-1 text-caption font-semibold text-ink-muted">
            {errorKey === 'vitals.error.numeric'
              ? t('vitals.error.numeric')
              : errorKey}
          </p>
        </Plate>
      )}

      {/* Kept mounted while saving. A rejected Vitals value must not cost the
          ASHA the conversation, so the assessment stays on screen and Continue
          is pressed again after the field is fixed. */}
      <SymptomChat
        patient={{ age: subject.age, gender: subject.gender }}
        /* Req 11.2 — the guidance is for the patient, so it runs in the
           patient's own language even when the ASHA's device is set to the other
           locale. The surrounding labels stay in the operator's locale. */
        locale={subject.preferredLanguage}
        onComplete={(result) => void onComplete(result)}
      />
    </>
  );
}
