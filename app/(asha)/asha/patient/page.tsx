'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, QrCode, Stethoscope } from 'lucide-react';
import type { Facility, Patient } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { Plate } from '@/components/system/plate';
import { BiLabel, BiText } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { PatientHistoryDialog } from '@/components/asha/patient-history-dialog';
import { QrCard } from '@/components/qr/qr-card';

/**
 * The ASHA's patient card, and where a scan lands (Req 18.1, 18.2).
 *
 * ADDRESSED BY `?id=`, NOT BY A PATH SEGMENT. `output: 'export'` requires
 * `generateStaticParams()` for a `[id]` route, which can only prerender ids known
 * at BUILD time — and the ids that matter most here are created at RUNTIME by the
 * registration flow, so a prerendered param list would 404 for exactly the patient
 * a live demo just typed in. Same reasoning, same shape as
 * `app/(doctor)/doctor/patient/page.tsx`; deviating would be a second convention
 * for one problem.
 *
 * IT SITS INSIDE `(asha)`, WHICH IS GUARDED. Requirement 18.4 forbids a public
 * unauthenticated route that returns patient data, so there is no `/p/{qrId}` and
 * no route outside a guarded group that resolves a card. A scan resolves inside
 * the app, behind the guard, and lands here.
 *
 * A SCAN LANDS ON IDENTITY FIRST, RECORD ONE TAP AWAY. That ordering is
 * deliberate rather than a shortcut: the screen a scan opens is the screen that
 * confirms the scan was right. `SS-WRD-KAMLA-7F3A` and `SS-WRD-KAMLA-7F3B` differ
 * by one character, and the next thing the ASHA does is write to this patient's
 * record. Name, village and card number, large and first, is the cheapest possible
 * guard against a wrong-patient write. The record itself opens in the same dialog
 * the worklist uses, so there is one record surface for this role rather than two
 * that can drift.
 */
function AshaPatientView() {
  const router = useRouter();
  const { t, locale } = useT();
  const id = useSearchParams().get('id') ?? '';
  const setAssistedSubjectId = useAppStore((s) => s.setAssistedSubjectId);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void repo.getPatient(id).then((found) => {
      if (!live) return;
      setPatient(found);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    void repo.listFacilities().then(setFacilities);
  }, []);

  if (loading) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <div className="skeleton-plate h-28" aria-hidden="true" />
        <div className="skeleton-plate h-80" aria-hidden="true" />
      </div>
    );
  }

  /* An absent or unknown id lands on one honest plate with a way back, rather
     than on an empty card that looks like a rendering failure. */
  if (!patient) {
    return (
      <>
        <Plate state="error" className="ss-print-hide p-4" as="section">
          <BiLabel k="qr.notFound" className="text-title font-semibold text-ink" />
          {id !== '' && (
            <p className="tabular mt-1 text-caption font-semibold break-all text-ink-muted">
              {id}
            </p>
          )}
        </Plate>
        <Button asChild variant="outline" size="field" className="ss-print-hide">
          <Link href="/asha/scan">
            <QrCode aria-hidden="true" />
            <BiLabel k="qr.scan" />
          </Link>
        </Button>
      </>
    );
  }

  return (
    <>
      {/* ——— Who this is. First, and large — see the header note. ——— */}
      <Plate state="action" className="ss-print-hide p-4" as="section">
        <BiLabel
          k="nav.patients"
          className="text-caption font-semibold text-ink-muted uppercase"
        />
        <BiText
          primary={patient.fullName}
          className="mt-1 text-display leading-tight font-extrabold text-ink"
        />
        <p lang={locale} className="mt-1 text-caption font-semibold text-ink-muted">
          {[
            patient.age !== null ? `${t('intake.age')} ${patient.age}` : null,
            patient.gender,
            patient.village,
            patient.district,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </Plate>

      {/* ——— The card itself: symbol, name, card number, village, district,
              plus the print button (Req 18.1). ——— */}
      <QrCard patient={patient} />

      {/* ——— The two things she does from here. Assist is first because it is
              what a scan was for: open the visit on the right patient. ——— */}
      <div className="ss-print-hide grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="field"
          onClick={() => {
            setAssistedSubjectId(patient.id);
            router.push('/asha/intake');
          }}
        >
          <Stethoscope aria-hidden="true" />
          <BiLabel k="nav.intake" secondaryClassName="text-action-fg/75" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="field"
          onClick={() => setHistoryOpen(true)}
        >
          <ClipboardList aria-hidden="true" />
          <BiLabel k="timeline.title" />
        </Button>
      </div>

      <PatientHistoryDialog
        patient={patient}
        facilities={facilities}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}

export default function AshaPatientPage() {
  /* `useSearchParams()` suspends during prerender, so the static export needs a
     boundary here or the build fails. */
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="flex flex-col gap-4">
          <div className="skeleton-plate h-28" aria-hidden="true" />
          <div className="skeleton-plate h-80" aria-hidden="true" />
        </div>
      }
    >
      <AshaPatientView />
    </Suspense>
  );
}
