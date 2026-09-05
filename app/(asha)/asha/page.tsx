'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, Users } from 'lucide-react';
import type { Facility, HealthWorker, Patient } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useT, type MessageKey } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { Plate } from '@/components/system/plate';
import { BiLabel, BiText } from '@/components/system/bi-label';
import { AdvisoryNote } from '@/components/system/advisory-note';
import { Button } from '@/components/ui/button';
import { buildWorklist, type WorklistRow as Row } from '@/components/asha/worklist';
import { WorklistRow } from '@/components/asha/worklist-row';
import { BookAppointmentDialog } from '@/components/asha/book-appointment-dialog';
import { PatientHistoryDialog } from '@/components/asha/patient-history-dialog';

/**
 * The ASHA worklist — her home (Req 7, 12.6).
 *
 * Ordered by who needs seeing first, not alphabetically: a patient with a recent
 * `high` record is lifted to the top by `buildWorklist`, and the row says why.
 *
 * Each row offers the four things she does with a patient, and the first is the
 * point of the screen: **Assist** sets the Assisted_Session subject and lands on
 * the intake form with that patient already named (Req 7.1). Booking is the
 * separate explicit path of Req 12.6 — a token without a new triage — and it
 * opens in place, because she is already looking at the patient she means. The
 * card is the one action that navigates away, because printing is its own task.
 */

const TYPE_KEY: Record<Facility['type'], MessageKey> = {
  phc: 'appointment.type.phc',
  chc: 'appointment.type.chc',
  district_hospital: 'appointment.type.district_hospital',
};

export default function AshaHomePage() {
  const router = useRouter();
  const { t, locale } = useT();
  const workerId = useAppStore((s) => s.workerId);
  const setAssistedSubjectId = useAppStore((s) => s.setAssistedSubjectId);

  const [worker, setWorker] = useState<HealthWorker | null>(null);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);

  const [bookFor, setBookFor] = useState<Patient | null>(null);
  const [historyFor, setHistoryFor] = useState<Patient | null>(null);

  /* Her own posting. Read once — it does not change inside a session. */
  useEffect(() => {
    if (!workerId) return;
    let live = true;
    void repo.getWorker(workerId).then(async (found) => {
      if (!live) return;
      setWorker(found);
      if (found?.facilityId) {
        const home = await repo.getFacility(found.facilityId);
        if (live) setFacility(home);
      }
    });
    return () => {
      live = false;
    };
  }, [workerId]);

  const loadFacilities = useCallback(async () => {
    setFacilities(await repo.listFacilities());
  }, []);

  useEffect(() => {
    void loadFacilities();
  }, [loadFacilities]);

  /**
   * The worklist. Every patient's newest record comes from the same
   * patient-scoped read the other two roles use, so the risk rail on a row is
   * the risk the doctor and the patient see (Req 4.6).
   */
  const loadWorklist = useCallback(async () => {
    const patients = await repo.listPatients();
    const records = await Promise.all(
      patients.map((patient) => repo.listHealthRecords(patient.id)),
    );
    setRows(
      buildWorklist(
        patients.map((patient, index) => ({ patient, records: records[index] })),
      ),
    );
  }, []);

  useEffect(() => {
    void loadWorklist();
  }, [loadWorklist]);

  /* Req 7.1 — the Assisted_Session opens here, and intake finds its subject
     already named rather than asking her to pick the patient a second time. */
  function assist(patient: Patient) {
    setAssistedSubjectId(patient.id);
    router.push('/asha/intake');
  }

  /* Req 18.1 — the printable card. Same `?id=` address the scanner lands on, so
     there is one route for "this patient's card" rather than two. Without this
     entry the only way in was to scan the card you were trying to print. */
  function openCard(patient: Patient) {
    router.push(`/asha/patient?id=${encodeURIComponent(patient.id)}`);
  }

  return (
    <>
      {/* ——— Who she is and where she is posted ——— */}
      <Plate state="action" className="p-4" as="section">
        <BiLabel
          k="role.asha"
          className="text-caption font-semibold text-ink-muted uppercase"
        />
        {worker ? (
          <BiText
            primary={worker.fullName}
            className="mt-1 text-headline leading-tight font-extrabold text-ink"
          />
        ) : (
          <div className="skeleton-plate mt-1 h-8 w-48" aria-hidden="true" />
        )}
        {facility && (
          <p className="mt-1 text-caption font-semibold text-ink-muted">
            {facility.name} · {t(TYPE_KEY[facility.type])} · {facility.locationLabel}
          </p>
        )}
      </Plate>

      {/* ——— The primary action: a patient who is not on the list yet ——— */}
      <Button asChild size="field">
        <Link href="/asha/register">
          <UserPlus aria-hidden="true" />
          <BiLabel k="intake.picker.new" secondaryClassName="text-action-fg/75" />
        </Link>
      </Button>

      {/* ——— The list ——— */}
      <Plate className="p-4" as="section">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2">
            <Users aria-hidden="true" className="size-6 shrink-0 text-action" />
            <BiLabel k="nav.patients" className="text-title font-semibold text-ink" />
          </h2>
          {rows && (
            <span className="tabular text-title font-extrabold text-ink">
              {rows.length}
            </span>
          )}
        </div>
        {/* One advisory for the whole list — every row renders a Risk_Level with
            `showAdvisory={false}` (Req 10.1). */}
        <AdvisoryNote className="mt-2" />
      </Plate>

      {rows === null ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <div className="skeleton-plate h-40" />
          <div className="skeleton-plate h-40" />
          <div className="skeleton-plate h-40" />
        </div>
      ) : rows.length === 0 ? (
        <Plate state="neutral" className="p-4" as="section">
          <BiLabel k="common.empty" className="text-title font-semibold text-ink" />
          <p
            lang={locale}
            className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted"
          >
            {t('empty.asha.worklist')}
          </p>
        </Plate>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <WorklistRow
              key={row.patient.id}
              row={row}
              onAssist={() => assist(row.patient)}
              onHistory={() => setHistoryFor(row.patient)}
              onBook={() => setBookFor(row.patient)}
              onCard={() => openCard(row.patient)}
            />
          ))}
        </ul>
      )}

      <BookAppointmentDialog
        patient={bookFor}
        facilities={facilities}
        open={bookFor !== null}
        onOpenChange={(open) => {
          if (!open) setBookFor(null);
        }}
        onBooked={() => {
          /* The appointment lands on the same Shared_Record the patient reads,
             so the only thing to do here is re-read (Req 4.2, 7.4). */
          void loadWorklist();
          void loadFacilities();
        }}
      />

      <PatientHistoryDialog
        patient={historyFor}
        facilities={facilities}
        open={historyFor !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryFor(null);
        }}
      />
    </>
  );
}
