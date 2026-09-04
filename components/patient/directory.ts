import type { Facility, HealthWorker, Role } from '@/lib/types';

/**
 * Name resolution for the patient workspace.
 *
 * The stored rows carry ids — `facilityId`, `prescribedBy`, `raisedBy`,
 * `clinicalDecision.byId` — and a patient must never be shown one. This is the
 * single place ids become names, built once per screen from the two `repo` reads
 * that supply them, and passed down. No component reaches for the repo to
 * resolve a label.
 *
 * Every lookup is total and returns `null` rather than throwing: a referral
 * raised by nobody (`raisedBy: null`) is valid data, and a screen that crashes
 * on it would be a worse outcome than one that omits the author line.
 */
export interface Directory {
  facility(id: string): Facility | null;
  workerName(id: string | null | undefined): string | null;
  workerRole(id: string | null | undefined): Role | null;
}

export const EMPTY_DIRECTORY: Directory = {
  facility: () => null,
  workerName: () => null,
  workerRole: () => null,
};

export function buildDirectory(
  facilities: Facility[],
  workers: HealthWorker[],
): Directory {
  const facilityById = new Map(facilities.map((f) => [f.id, f]));
  const workerById = new Map(workers.map((w) => [w.id, w]));

  return {
    facility: (id) => facilityById.get(id) ?? null,
    workerName: (id) => (id ? (workerById.get(id)?.fullName ?? null) : null),
    workerRole: (id) => (id ? (workerById.get(id)?.role ?? null) : null),
  };
}
