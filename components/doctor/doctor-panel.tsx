'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type {
  Facility,
  HealthRecord,
  HealthWorker,
  Patient,
  Prescription,
  Referral,
  TimelineEntry,
} from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { AiVsDecision } from './ai-vs-decision';
import { DecisionForm } from './decision-form';
import { PlateSkeleton } from './field';
import { LongitudinalSummary } from './longitudinal-summary';
import { PatientHeader } from './patient-header';
import { PrescriptionForm } from './prescription-form';
import { ReferralForm } from './referral-form';
import { VisitHistory } from './visit-history';

/**
 * Doctor_Panel (Req 4, 8.6, 10.4–10.6, 14, 15, 16, 17.1).
 *
 * The heaviest screen in the product, ordered top to bottom the way the
 * consultation runs:
 *
 *   a) who this is                        — PatientHeader
 *   b) what has happened before           — LongitudinalSummary
 *   c) what the AI thinks / what I decide — AiVsDecision
 *   d) recording my decision              — DecisionForm
 *   e) the treatment                      — PrescriptionForm
 *   f) sending them on                     — ReferralForm
 *   g) the full thread                    — VisitHistory
 *
 * The record under review defaults to the newest and is switchable from the
 * history, because a doctor reviewing a follow-up sometimes needs to record
 * against the visit that raised the question rather than the latest one.
 *
 * Every read goes through `repo`. The panel never touches the seed.
 */

interface PanelData {
  patient: Patient | null;
  records: HealthRecord[];
  timeline: TimelineEntry[];
  prescriptions: Prescription[];
  referrals: Referral[];
  facilities: Facility[];
  workers: HealthWorker[];
}

export function DoctorPanel({ patientId }: { patientId: string }) {
  const { t, locale } = useT();
  const workerId = useAppStore((s) => s.workerId);

  const [data, setData] = useState<PanelData | null>(null);
  const [reviewRecordId, setReviewRecordId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<PanelData> => {
    const [patient, records, timeline, prescriptions, referrals, facilities, workers] =
      await Promise.all([
        repo.getPatient(patientId),
        repo.listRecordsForPatient(patientId),
        repo.getPatientTimeline(patientId),
        repo.listPrescriptionsForPatient(patientId),
        repo.listReferralsForPatient(patientId),
        repo.listFacilities(),
        repo.listWorkers(),
      ]);
    return { patient, records, timeline, prescriptions, referrals, facilities, workers };
  }, [patientId]);

  useEffect(() => {
    let live = true;
    void load().then((next) => {
      if (!live) return;
      setData(next);
      /* Keep the reviewed record across a refresh when it still exists; fall
         back to the newest, which is the visit the doctor came here for. */
      setReviewRecordId((current) =>
        current && next.records.some((r) => r.id === current)
          ? current
          : (next.records[0]?.id ?? null),
      );
    });
    return () => {
      live = false;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const next = await load();
    setData(next);
  }, [load]);

  if (data === null) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <PlateSkeleton lines={3} />
        <PlateSkeleton lines={4} />
        <PlateSkeleton lines={3} />
      </div>
    );
  }

  if (data.patient === null) {
    return (
      <section className="plate flex flex-col gap-3 p-4" data-state="error">
        <p lang={locale} className="text-field font-semibold text-ink">
          {t('common.error')}
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/doctor">
            <ArrowLeft aria-hidden="true" />
            <BiLabel k="nav.patients" />
          </Link>
        </Button>
      </section>
    );
  }

  const reviewed =
    data.records.find((record) => record.id === reviewRecordId) ?? data.records[0] ?? null;

  const doctor = data.workers.find((worker) => worker.id === workerId) ?? null;
  const doctorFacility =
    data.facilities.find((facility) => facility.id === doctor?.facilityId) ?? null;

  const nameFor = (id: string): string | null =>
    data.workers.find((worker) => worker.id === id)?.fullName ?? null;

  /* Destinations already present in the record, offered as one-tap fills so the
     form suggests real referral targets rather than inventing vocabulary. */
  const suggestions = [
    ...new Set(
      data.referrals
        .map((referral) => referral.toFacilityOrSpecialist)
        .concat(
          /* A referral goes UP the tier, so a PHC is never a destination. */
          data.facilities
            .filter((facility) => facility.type !== 'phc')
            .map((facility) => facility.name),
        ),
    ),
  ].slice(0, 4);

  const prescriptionsForReviewed = reviewed
    ? data.prescriptions.filter((rx) => rx.recordId === reviewed.id)
    : [];

  return (
    <>
      <Button asChild variant="outline" className="w-fit">
        <Link href="/doctor">
          <ArrowLeft aria-hidden="true" />
          <BiLabel k="nav.patients" />
        </Link>
      </Button>

      {/* a) */}
      <PatientHeader patient={data.patient} />

      {/* b) Req 14.2 — requested on mount when the cache is cold. The degraded
             path is this plate replaced by a notice; the history below always
             renders, so the screen is never blank. */}
      <LongitudinalSummary patientId={patientId} />

      {reviewed ? (
        <>
          {/* c) Req 10.4, 10.5, 15.4, 15.5 */}
          <AiVsDecision
            record={reviewed}
            decidedByName={
              reviewed.clinicalDecision
                ? nameFor(reviewed.clinicalDecision.byId)
                : null
            }
          />

          {/* d) Req 15.1, 15.2, 15.6. Keyed on the record so switching the
                 visit under review resets the form to that visit's decision
                 instead of carrying the previous one across. */}
          <DecisionForm
            key={`decision-${reviewed.id}`}
            record={reviewed}
            doctorId={workerId ?? ''}
            onSaved={refresh}
          />

          {/* e) Req 16 */}
          <PrescriptionForm
            key={`rx-${reviewed.id}`}
            recordId={reviewed.id}
            doctorId={workerId}
            existing={prescriptionsForReviewed}
            onSaved={refresh}
          />
        </>
      ) : (
        <section className="plate p-4" data-state="action">
          <p lang={locale} className="max-w-[70ch] text-field font-semibold text-ink">
            {t('doctor.noRecords')}
          </p>
        </section>
      )}

      {/* f) Req 17.1 — the board itself lives at /doctor/referrals. */}
      <ReferralForm
        patientId={patientId}
        fromFacility={doctorFacility?.name ?? ''}
        doctorId={workerId}
        existing={data.referrals}
        suggestions={suggestions}
        onSaved={refresh}
      />

      {/* g) Req 14.1, 4.4, 4.5, 8.6 */}
      <VisitHistory
        entries={data.timeline}
        facilities={data.facilities}
        reviewRecordId={reviewed?.id ?? null}
        onReview={setReviewRecordId}
      />
    </>
  );
}
