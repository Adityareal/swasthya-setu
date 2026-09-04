'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';
import type { Appointment, HealthRecord, Patient, Referral } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { Button } from '@/components/ui/button';
import { BiLabel, BiText } from '@/components/system/bi-label';
import { TokenChit } from '@/components/system/token-chit';
import { LanguageChoice } from '@/components/patient/language-choice';
import { ClinicalGuidance } from '@/components/patient/guidance';
import { ReferralCard } from '@/components/patient/referral-progress';
import { PatientHomeSkeleton } from '@/components/patient/skeletons';
import { buildDirectory, EMPTY_DIRECTORY, type Directory } from '@/components/patient/directory';
import { APPOINTMENT_STATUS_KEY } from '@/components/patient/timeline-model';

/**
 * Patient home — "where do I go, what has happened, what do I do next"
 * (Req 13.1, 13.2, 13.6).
 *
 * The subject is `patientSelfId`, and EVERY read below takes it as its only
 * argument (Req 13.4). There is deliberately no `listAllRecords()` on the repo,
 * so this screen cannot widen its scope even by accident — the absence is the
 * control, and it is not worked around here.
 *
 * Four concepts, one plate each, always stacked, in the order a patient needs
 * them: language first because it gates comprehension of everything below it,
 * then the appointment, then the referrals, then the guidance, then exactly one
 * primary action. Nothing on this screen is below the 18px field floor except
 * metadata captions.
 */
export default function PatientHomePage() {
  const { t, locale } = useT();
  const patientId = useAppStore((s) => s.patientSelfId);
  const setLocale = useAppStore((s) => s.setLocale);

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [latestRecord, setLatestRecord] = useState<HealthRecord | null>(null);
  const [directory, setDirectory] = useState<Directory>(EMPTY_DIRECTORY);

  /* Req 6.3 — a later session opens in the stored `preferred_language`. Applied
     once per mount and never again, so it cannot fight a choice the patient
     makes while the screen is open. */
  const languageAdopted = useRef(false);

  useEffect(() => {
    let live = true;

    async function loadAll() {
      const [self, latestAppointment, referralRows, timeline, facilityRows, workerRows] =
        await Promise.all([
          repo.getPatient(patientId),
          repo.latestAppointmentForPatient(patientId),
          repo.listReferralsForPatient(patientId),
          repo.getPatientTimeline(patientId),
          repo.listFacilities(),
          repo.listWorkers(),
        ]);
      if (!live) return;

      setPatient(self);
      setAppointment(latestAppointment);
      setReferrals(referralRows);
      setDirectory(buildDirectory(facilityRows, workerRows));

      /* The newest visit, taken off the front of the one merged read rather than
         from a second query. The timeline is already newest-first. */
      const newest = timeline.find((entry) => entry.kind === 'record');
      setLatestRecord(newest?.kind === 'record' ? newest.record : null);

      if (self && !languageAdopted.current) {
        languageAdopted.current = true;
        if (self.preferredLanguage !== useAppStore.getState().locale) {
          setLocale(self.preferredLanguage);
        }
      }

      setLoading(false);
    }

    void loadAll();
    return () => {
      live = false;
    };
  }, [patientId, setLocale]);

  if (loading) return <PatientHomeSkeleton />;

  const facility = appointment ? directory.facility(appointment.facilityId) : null;

  return (
    <>
      <header>
        {/* The bilingual stack IS the heading — the second locale is
            `aria-hidden` inside `<BiLabel>`, so this announces once. */}
        <h1 className="text-headline font-extrabold text-ink">
          <BiLabel k="patient.title" />
        </h1>
        {patient && (
          <BiText
            primary={patient.fullName}
            {...(patient.village ? { secondary: `${patient.village}, ${patient.district}` } : {})}
            className="mt-1 text-title font-semibold text-ink"
            secondaryClassName="text-ink-muted"
          />
        )}
      </header>

      {/* ——— a) Language. First, because it gates everything below it. ——— */}
      <LanguageChoice patientId={patientId} />

      {/* ——— b) The next appointment: the largest thing on the page. ——— */}
      <section aria-labelledby="patient-appointment" className="flex flex-col gap-2">
        <h2 id="patient-appointment" className="text-title font-semibold text-ink">
          <BiLabel k="appointment.next" />
        </h2>

        {appointment && facility ? (
          <>
            <TokenChit facility={facility} tokenNumber={appointment.tokenNumber} />
            <p lang={locale} className="text-caption font-semibold text-ink-muted">
              {t(APPOINTMENT_STATUS_KEY[appointment.status])}
            </p>
          </>
        ) : appointment ? (
          /* The facility row is gone but the token is real: show the number
             rather than an id, and never an empty plate. */
          <div className="plate flex items-end justify-between gap-3 p-4" data-state="action">
            <BiLabel k="appointment.token" className="text-title font-semibold text-ink" />
            <span className="tabular text-token leading-none font-extrabold text-action">
              {appointment.tokenNumber}
            </span>
          </div>
        ) : (
          /* Req 13.6 — the empty state names the next action, and the action
             itself is the one button at the foot of the screen. */
          <p
            lang={locale}
            className="plate p-4 text-field font-semibold text-ink"
            data-state="neutral"
          >
            {t('empty.patient.appointment')}
          </p>
        )}
      </section>

      {/* ——— c) Referral status, as a progress reading (Req 13.2). ——— */}
      <section aria-labelledby="patient-referrals" className="flex flex-col gap-2">
        <h2 id="patient-referrals" className="text-title font-semibold text-ink">
          <BiLabel k="patient.myReferrals" />
        </h2>

        {referrals.length > 0 ? (
          referrals.map((referral) => (
            <ReferralCard key={referral.id} referral={referral} />
          ))
        ) : (
          <p
            lang={locale}
            className="plate p-4 text-field font-semibold text-ink"
            data-state="neutral"
          >
            {t('empty.patient.referral')}
          </p>
        )}
      </section>

      {/* ——— d) The latest guidance: the doctor's decision above the AI
              suggestion, both distinctly labelled (Req 10.4–10.6, 15.7). ——— */}
      <section aria-labelledby="patient-guidance" className="flex flex-col gap-2">
        <h2 id="patient-guidance" className="text-title font-semibold text-ink">
          <BiLabel k="triage.result.title" />
        </h2>

        {latestRecord ? (
          <ClinicalGuidance
            record={latestRecord}
            doctorName={directory.workerName(latestRecord.clinicalDecision?.byId)}
          />
        ) : (
          <p
            lang={locale}
            className="plate p-4 text-field font-semibold text-ink"
            data-state="neutral"
          >
            {t('empty.patient.record')}
          </p>
        )}
      </section>

      {/* ——— e) ONE primary action. The record and the language toggle are
              already reachable from the shell, so this screen offers exactly one
              thing to do: describe a new complaint. ——— */}
      <Button asChild size="field">
        <Link href="/patient/intake">
          <MessageSquarePlus aria-hidden="true" />
          <BiLabel k="nav.intake" secondaryClassName="text-action-fg/75" />
        </Link>
      </Button>
    </>
  );
}
