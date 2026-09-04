import type {
  Appointment,
  Facility,
  HealthRecord,
  Role,
  Vitals,
} from '@/lib/types';
import { repo } from '@/lib/data/memory-repo';
import type { NewHealthRecord } from '@/lib/data/repo';
import { resolveVillageCoords } from '@/lib/data/seed';
import { selectFacility } from '@/lib/routing/select-facility';
import { isEffectivelyOnline } from '@/lib/offline/simulate';
import { notifyQueueChanged } from '@/lib/offline/replay';
import type { ChatOutcome } from '@/components/triage/symptom-chat';

/**
 * ONE completion path for BOTH intake screens.
 *
 * The patient path and the ASHA path differ in exactly three ways: who the
 * subject is, whether a Vitals form is shown, and how large the type runs. What
 * happens when Continue is pressed is identical, so it lives here once. Two
 * copies of this function would drift, and the thing that drifts first is which
 * fields get written — which is the one thing Requirement 15.3 says must not.
 *
 * Sequence, in order, because each step consumes the one before:
 *
 *   1. `createHealthRecord` — AI fields written ONCE, never overwritten later by
 *      a Doctor_User's decision (Req 15.3). `authorRole` distinguishes the two
 *      callers (Req 4.3) and is the only place they diverge.
 *   2. `selectFacility` over the patient's village coordinate (Req 12.1).
 *   3. `createAppointment` — the repo computes the Token_Number with
 *      `nextTokenFrom` over the tokens already held at that facility, inside one
 *      synchronous turn. Doing it here instead would put a read and a write on
 *      either side of an `await` and reintroduce the race that placement avoids.
 *   4. An `appointment` notification row, so the mocked SMS/IVR surface has real
 *      content instead of a hardcoded card (Req 20).
 *
 * ————————————————————————— The offline branch —————————————————————————
 *
 * When connectivity is gone the flow does NOT stop and does NOT lose the visit
 * (Req 19.2, 22.1). Three of the four steps survive intact, and it is worth being
 * precise about which one does not:
 *
 *   • Triage already happened. `fallbackTriage` runs client-side in the chat the
 *     moment the Gemini call fails (Req 22.5), so a Risk_Level exists before this
 *     function is called and nothing here has to guess one.
 *
 *   • Routing still works. `selectFacility` is a pure function and the facility
 *     list is cached, so the Routing_Engine decision — which tier, which facility,
 *     how far — is fully resolvable offline. The patient is told where to go.
 *
 *   • The write is DEFERRED, not performed. `repo.enqueueWrite('intake', …)`
 *     holds the record and the chosen facility until replay.
 *
 *   • A TOKEN CANNOT BE ALLOCATED. This is the one genuine reduction and it is
 *     not a bug: `nextTokenFrom` computes the next token from the tokens ALREADY
 *     HELD at that facility, and that set lives in the store. Offline we cannot
 *     read it, so any number shown here would be invented — and an invented token
 *     is worse than no token, because the patient arrives, presents it, and finds
 *     it belongs to someone else. So the token slot reads "Token pending —
 *     assigned on sync" and the real number is allocated by the replay handler,
 *     which books the appointment against the live queue at that facility.
 *
 * No notification row is logged on the offline path either, for the same reason:
 * the mocked SMS payload carries a token number, and there is not one yet.
 */

export interface CompleteIntakeInput {
  patientId: string;
  outcome: ChatOutcome;
  vitals?: Vitals;
  authorRole: Extract<Role, 'patient' | 'asha'>;
  authorId: string;
  /**
   * Optional cached facility list. The shipped in-process adapter is local, so
   * `repo.listFacilities()` already answers offline and no caller needs this. A
   * network-backed adapter would pass the list cached in the store instead.
   */
  facilities?: Facility[];
  /** Overrides the connectivity read. Exists so the branch is testable. */
  online?: boolean;
}

/** The write landed in the store, so a Token_Number exists. */
export interface IntakeConfirmationWritten {
  sync: 'written';
  record: HealthRecord;
  facility: Facility;
  appointment: Appointment;
  distanceKm: number;
}

/**
 * The write is held in the Offline_Queue. `appointment` is `null` rather than a
 * placeholder object, so a caller cannot read a token that does not exist — the
 * type refuses it instead of returning a zero.
 */
export interface IntakeConfirmationQueued {
  sync: 'queued';
  /** The payload as submitted. Nothing was written, so there is no id yet. */
  record: NewHealthRecord;
  facility: Facility;
  appointment: null;
  distanceKm: number;
  /** The `QueuedWrite.id` holding this visit, for the queue inspector. */
  queuedWriteId: number;
}

/**
 * Discriminated on `sync`, so the confirmation screen renders either a real
 * `<TokenChit>` or the pending variant, and the compiler decides which.
 */
export type IntakeConfirmation =
  | IntakeConfirmationWritten
  | IntakeConfirmationQueued;

export type CompleteIntakeResult =
  | { ok: true; value: IntakeConfirmation }
  /** No eligible facility in any tier. Surfaced as an error plate rather than
   *  written as a half-complete appointment. */
  | { ok: false; reasonKey: 'appointment.none' | 'record.error.notFound' };

export async function completeIntake(
  input: CompleteIntakeInput,
): Promise<CompleteIntakeResult> {
  const patient = await repo.getPatient(input.patientId);
  if (!patient) return { ok: false, reasonKey: 'record.error.notFound' };

  const draft: NewHealthRecord = {
    patientId: input.patientId,
    symptoms: input.outcome.transcript,
    conversation: input.outcome.turns,
    aiTriageSummary: input.outcome.summary,
    riskLevel: input.outcome.risk,
    triageSource: input.outcome.source,
    ...(input.vitals ? { vitals: input.vitals } : {}),
    authorRole: input.authorRole,
    authorId: input.authorId,
  };

  /* A patient has no assigned facility, so the village name supplies the
     coordinate. No device geolocation: a permission prompt in the first thirty
     seconds of a health app is a poor trade for a number the village already
     gives us. */
  const origin = resolveVillageCoords(patient.village);
  const facilities = input.facilities ?? (await repo.listFacilities());
  const selection = selectFacility(input.outcome.risk, origin, facilities);
  if (!selection) return { ok: false, reasonKey: 'appointment.none' };

  const online = input.online ?? isEffectivelyOnline();

  /* ——— Offline: defer the write, keep the routing decision. ——— */
  if (!online) {
    const queued = await repo.enqueueWrite('intake', {
      record: draft,
      appointment: { facilityId: selection.facility.id },
    });
    notifyQueueChanged();

    return {
      ok: true,
      value: {
        sync: 'queued',
        record: draft,
        facility: selection.facility,
        appointment: null,
        distanceKm: selection.distanceKm,
        queuedWriteId: queued.id,
      },
    };
  }

  /* ——— Online: the original path, unchanged. ——— */
  const record = await repo.createHealthRecord(draft);

  const appointment = await repo.createAppointment({
    patientId: input.patientId,
    facilityId: selection.facility.id,
    recordId: record.id,
  });

  await repo.createNotification({
    patientId: input.patientId,
    type: input.outcome.risk === 'high' ? 'emergency' : 'appointment',
    channel: 'sms',
    payload: {
      facility: selection.facility.name,
      facilityType: selection.facility.type,
      tokenNumber: appointment.tokenNumber,
      riskLevel: input.outcome.risk,
    },
  });

  return {
    ok: true,
    value: {
      sync: 'written',
      record,
      /* Re-read: `createAppointment` incremented the queue length, and the
         confirmation should show the queue the patient is actually joining. */
      facility:
        (await repo.getFacility(selection.facility.id)) ?? selection.facility,
      appointment,
      distanceKm: selection.distanceKm,
    },
  };
}
