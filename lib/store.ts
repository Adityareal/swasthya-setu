'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Facility, Role, SupportedLanguage, TriageResult } from '@/lib/types';
import { DEMO_ASHA_ID, DEMO_DOCTOR_ID, DEMO_PATIENT_ID } from '@/lib/data/seed';

/**
 * The repo is authoritative for all patient data. Zustand holds only what the
 * repo should not: who is looking, and what they are looking at.
 */
export interface AppState {
  /** null until a role is chosen on the landing screen. */
  activeRole: Role | null;
  /** The Patient_User's own `patients.id`. Defaults to Kamla. */
  patientSelfId: string;
  /** The Assisted_Session subject. Deliberately NOT persisted — a stale
   *  subject across reloads is a bug source with no upside. */
  assistedSubjectId: string | null;
  /** The signed-in worker for role `asha` or `doctor`. */
  workerId: string | null;

  locale: SupportedLanguage;

  /** Cached facility list, needed for local routing when offline. */
  facilities: Facility[];
  /** The most recent triage result, so the confirmation screen survives a
   *  remount without re-running the assessment. */
  lastTriage: TriageResult | null;

  online: boolean;
  pendingCount: number;

  setActiveRole: (role: Role | null) => void;
  setPatientSelfId: (id: string) => void;
  setAssistedSubjectId: (id: string | null) => void;
  setWorkerId: (id: string | null) => void;
  setLocale: (locale: SupportedLanguage) => void;
  setFacilities: (facilities: Facility[]) => void;
  setLastTriage: (result: TriageResult | null) => void;
  setOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
  clearSession: () => void;
}

/** Selecting a role also binds the seeded identity that role acts as. */
function identityFor(role: Role | null): Pick<AppState, 'workerId'> {
  if (role === 'asha') return { workerId: DEMO_ASHA_ID };
  if (role === 'doctor') return { workerId: DEMO_DOCTOR_ID };
  return { workerId: null };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeRole: null,
      patientSelfId: DEMO_PATIENT_ID,
      assistedSubjectId: null,
      workerId: null,
      locale: 'hi-IN',
      facilities: [],
      lastTriage: null,
      online: true,
      pendingCount: 0,

      setActiveRole: (role) =>
        set({
          activeRole: role,
          ...identityFor(role),
          /* A role change ends any Assisted_Session. */
          assistedSubjectId: role === 'asha' ? null : null,
        }),
      setPatientSelfId: (patientSelfId) => set({ patientSelfId }),
      setAssistedSubjectId: (assistedSubjectId) => set({ assistedSubjectId }),
      setWorkerId: (workerId) => set({ workerId }),
      setLocale: (locale) => set({ locale }),
      setFacilities: (facilities) => set({ facilities }),
      setLastTriage: (lastTriage) => set({ lastTriage }),
      setOnline: (online) => set({ online }),
      setPendingCount: (pendingCount) => set({ pendingCount }),
      clearSession: () =>
        set({
          activeRole: null,
          workerId: null,
          assistedSubjectId: null,
          lastTriage: null,
        }),
    }),
    {
      name: 'swasthya-setu:session:v1',
      /* Guarded for SSR: the store module is imported on the server too. */
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            },
      ),
      /* Only these three survive a reload. */
      partialize: (state) => ({
        activeRole: state.activeRole,
        locale: state.locale,
        patientSelfId: state.patientSelfId,
      }),
    },
  ),
);

/**
 * The SINGLE place subject resolution happens.
 *
 *   role `patient` → `patientSelfId`   (the Patient_Picker is hidden, Req 5.4)
 *   role `asha`    → `assistedSubjectId` (null until a patient is picked, Req 5.3)
 *
 * A Doctor_User reads a patient from the route parameter, not from here, which
 * is why `doctor` resolves to null: the doctor panel is addressed by URL.
 */
export function getIntakeSubjectId(
  state: Pick<AppState, 'activeRole' | 'patientSelfId' | 'assistedSubjectId'>,
): string | null {
  if (state.activeRole === 'patient') return state.patientSelfId;
  if (state.activeRole === 'asha') return state.assistedSubjectId;
  return null;
}

/** Convenience hook over the selector above. */
export function useIntakeSubjectId(): string | null {
  return useAppStore((s) =>
    getIntakeSubjectId({
      activeRole: s.activeRole,
      patientSelfId: s.patientSelfId,
      assistedSubjectId: s.assistedSubjectId,
    }),
  );
}
