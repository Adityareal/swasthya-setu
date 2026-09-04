import { PatientQueue } from '@/components/doctor/patient-queue';

/**
 * The doctor's queue. A server component shell over one client list, because
 * everything that needs state — the repo reads, the summary warm-up — is in the
 * list and nothing above it is.
 *
 * `/doctor` IS the patient list. A separate patient-index route would be the
 * same screen at a second URL. The detail screen is `/doctor/patient/?id=…`.
 */
export default function DoctorHomePage() {
  return <PatientQueue />;
}
