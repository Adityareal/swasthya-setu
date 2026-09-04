'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DoctorPanel } from '@/components/doctor/doctor-panel';
import { PlateSkeleton } from '@/components/doctor/field';

/**
 * Doctor_Panel patient detail (Req 4, 14, 15, 16, 17.1).
 *
 * The patient is addressed by `?id=` rather than by a path segment, and that is
 * a packaging decision with a clinical consequence. `output: 'export'` requires
 * `generateStaticParams()` for a `[id]` segment, which can only prerender the
 * ids that exist at BUILD time. Patients are created at RUNTIME by the ASHA
 * registration flow, so a prerendered param list would 404 for exactly the
 * patients a live demo creates. A query parameter is read by the client at
 * navigation time and has no such build-time dependency.
 *
 * Behaviour is otherwise unchanged: still one panel addressed by URL rather than
 * by store state, so a deep link into a specific patient still works, and the
 * panel still requests its own summary on mount because a deep link never made
 * the queue click that would have warmed the cache.
 */
function DoctorPatientView() {
  const id = useSearchParams().get('id') ?? '';

  /* An absent id reaches DoctorPanel as '', which resolves to no patient and
     renders the panel's own not-found plate with its way back to the queue. One
     error surface rather than two. */
  return <DoctorPanel patientId={id} />;
}

export default function DoctorPatientPage() {
  /* `useSearchParams()` suspends during prerender, so the export needs a
     boundary here or the build fails. The fallback mirrors the panel's own
     loading state so the two are indistinguishable in sequence. */
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="flex flex-col gap-4">
          <PlateSkeleton lines={3} />
          <PlateSkeleton lines={4} />
          <PlateSkeleton lines={3} />
        </div>
      }
    >
      <DoctorPatientView />
    </Suspense>
  );
}
