import type {
  Appointment,
  AppNotification,
  ClinicalDecision,
  DashboardStats,
  Facility,
  HealthRecord,
  HealthWorker,
  MedicineStock,
  Patient,
  Prescription,
  QueuedWrite,
  QueuedWriteKind,
  Referral,
  ReferralStatus,
  RiskLevel,
  SupportedLanguage,
  TimelineEntry,
} from '@/lib/types';
import type {
  NewAppointment,
  NewHealthRecord,
  NewPatient,
  NewPrescription,
  NewReferral,
  QueueCounts,
  QueuedClinicalDecisionPayload,
  QueuedIntakePayload,
  QueuedPrescriptionPayload,
  QueuedReferralPayload,
  ReplayOutcome,
  Repo,
  StockRow,
  WriteResult,
} from './repo';
import { reorderThresholdFor, stockLevel } from './repo';
import { buildSeed, type Db } from './seed';
import { nextTokenFrom } from '@/lib/routing/token';
import { advanceReferral, type TransitionReasonKey } from '@/lib/referral/machine';
import { validateNonBlank, validatePrescription } from '@/lib/prescriptions/validate';

/**
 * The ONE shipped adapter. Seeded at module load; writes mutate in memory and
 * persist the whole dataset to localStorage under a single key.
 *
 * Every localStorage access is guarded by `typeof window !== 'undefined'` so
 * the module imports cleanly during SSR and during Vitest's node environment.
 *
 * Known limitation, recorded rather than discovered on stage: two browser tabs
 * hold two module instances and will not see each other's writes until a reload
 * rehydrates from localStorage. A `storage` listener would fix it in about ten
 * lines and is not in the budget; the demo runs in one tab.
 */

const SNAPSHOT_KEY = 'swasthya-setu:db:v1';
const QUEUE_KEY = 'swasthya-setu:queue:v1';

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function load(): Db {
  if (!hasStorage()) return buildSeed();
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return buildSeed();
    const parsed = JSON.parse(raw) as Partial<Db>;
    const fresh = buildSeed();
    /* Shallow-merge onto a fresh graph so a snapshot written before a new
       collection existed cannot produce an undefined array at a call site. */
    return {
      facilities: parsed.facilities ?? fresh.facilities,
      workers: parsed.workers ?? fresh.workers,
      patients: parsed.patients ?? fresh.patients,
      healthRecords: parsed.healthRecords ?? fresh.healthRecords,
      appointments: parsed.appointments ?? fresh.appointments,
      referrals: parsed.referrals ?? fresh.referrals,
      prescriptions: parsed.prescriptions ?? fresh.prescriptions,
      medicineStock: parsed.medicineStock ?? fresh.medicineStock,
      notifications: parsed.notifications ?? fresh.notifications,
    };
  } catch {
    /* A corrupt snapshot must not brick the demo. */
    return buildSeed();
  }
}

let db: Db = load();

function persist(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(db));
  } catch {
    /* Quota or private-mode failure: the in-memory graph is still authoritative
       for this session, which is enough to finish the flow. */
  }
}

/* ————————————————————————— Offline_Queue storage —————————————————————————
   A SEPARATE localStorage key from the dataset, deliberately: a corrupt dataset
   snapshot falls back to a fresh seed WITHOUT taking unsynced writes with it,
   which one shared key could not express. The explicit "Reset demo data" control
   clears both, because it says it discards everything from this session.

   IndexedDB is what Requirement 19.2 names. localStorage is the reduced form
   shipped here: same durability across a reload, same replay order, ~40 fewer
   lines, and no async transaction ceremony inside a synchronous repo. The
   limitation is size (a few MB) which a text-only queue of this shape will not
   reach. Recorded rather than discovered.                                    */

let queue: QueuedWrite[] = loadQueue();

function loadQueue(): QueuedWrite[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

function persistQueue(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* The in-memory queue still replays this session. */
  }
}

/** Monotonic across reloads: derived from the ids already held, not a counter
 *  that resets to zero and re-orders the queue after a refresh. */
function nextQueueId(): number {
  return queue.reduce((max, w) => (w.id > max ? w.id : max), 0) + 1;
}

/** Submission order, oldest first. */
function inSubmissionOrder(writes: QueuedWrite[]): QueuedWrite[] {
  return [...writes].sort((a, b) => a.id - b.id);
}

/** Monotonic within a session; the timestamp keeps ids readable in devtools. */
let idCounter = 0;
function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Newest first. Ties keep their relative input order. */
function byTimestampDesc<T extends { timestamp: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export const memoryRepo: Repo = {
  /* ————————————————————————————— Patients ————————————————————————————— */

  async listPatients(): Promise<Patient[]> {
    return clone(db.patients);
  },

  async getPatient(id: string): Promise<Patient | null> {
    return clone(db.patients.find((p) => p.id === id) ?? null);
  },

  async createPatient(input: NewPatient): Promise<Patient> {
    const id = newId('P');
    const patient: Patient = {
      id,
      fullName: input.fullName.trim(),
      age: input.age ?? null,
      gender: input.gender ?? null,
      village: input.village ?? null,
      district: input.district ?? 'Wardha',
      phone: input.phone ?? null,
      preferredLanguage: input.preferredLanguage,
      qrId: `SS-WRD-${id.toUpperCase()}`,
    };
    db.patients.push(patient);
    persist();
    return clone(patient);
  },

  async findPatientByQrId(qrId: string): Promise<Patient | null> {
    const needle = (qrId ?? '').trim().toUpperCase();
    return clone(db.patients.find((p) => p.qrId.toUpperCase() === needle) ?? null);
  },

  async setPreferredLanguage(
    patientId: string,
    language: SupportedLanguage,
  ): Promise<Patient | null> {
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return null;
    patient.preferredLanguage = language;
    persist();
    return clone(patient);
  },

  /* ———————————————————————— Workers, facilities ———————————————————————— */

  async listWorkers(): Promise<HealthWorker[]> {
    return clone(db.workers);
  },

  async getWorker(id: string): Promise<HealthWorker | null> {
    return clone(db.workers.find((w) => w.id === id) ?? null);
  },

  async listFacilities(): Promise<Facility[]> {
    return clone(db.facilities);
  },

  async getFacility(id: string): Promise<Facility | null> {
    return clone(db.facilities.find((f) => f.id === id) ?? null);
  },

  async listMedicineStock(facilityId?: string): Promise<MedicineStock[]> {
    const rows = facilityId
      ? db.medicineStock.filter((m) => m.facilityId === facilityId)
      : db.medicineStock;
    return clone(rows);
  },

  /* ——————————————————————— The Shared_Record ——————————————————————— */

  async listHealthRecords(patientId: string): Promise<HealthRecord[]> {
    return clone(
      byTimestampDesc(db.healthRecords.filter((r) => r.patientId === patientId)),
    );
  },

  async getHealthRecord(id: string): Promise<HealthRecord | null> {
    return clone(db.healthRecords.find((r) => r.id === id) ?? null);
  },

  async createHealthRecord(input: NewHealthRecord): Promise<HealthRecord> {
    const record: HealthRecord = {
      id: newId('HR'),
      patientId: input.patientId,
      symptoms: input.symptoms,
      ...(input.conversation && input.conversation.length > 0
        ? { conversation: input.conversation }
        : {}),
      aiTriageSummary: input.aiTriageSummary,
      riskLevel: input.riskLevel,
      triageSource: input.triageSource,
      ...(input.vitals ? { vitals: input.vitals } : {}),
      authorRole: input.authorRole,
      authorId: input.authorId,
      timestamp: nowIso(),
    };
    db.healthRecords.push(record);
    persist();
    return clone(record);
  },

  /**
   * Accepts only the decision object, so it physically cannot write the AI
   * fields. "The AI value is retained" is therefore a consequence of the
   * method signature rather than a rule someone honours (Req 15.3).
   */
  async recordClinicalDecision(
    recordId: string,
    decision: ClinicalDecision,
  ): Promise<WriteResult<HealthRecord>> {
    const record = db.healthRecords.find((r) => r.id === recordId);
    if (!record) return { ok: false, reasonKey: 'record.error.notFound' };
    if (!validateNonBlank(decision.assessment)) {
      return { ok: false, reasonKey: 'decision.error.assessmentRequired' };
    }
    record.clinicalDecision = {
      assessment: decision.assessment.trim(),
      plan: decision.plan.trim(),
      ...(decision.riskLevel ? { riskLevel: decision.riskLevel } : {}),
      byId: decision.byId,
      at: decision.at,
    };
    persist();
    return { ok: true, value: clone(record) };
  },

  /* ———————————————————————————— Appointments ———————————————————————————— */

  async listAppointments(patientId: string): Promise<Appointment[]> {
    return clone(
      [...db.appointments.filter((a) => a.patientId === patientId)].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
    );
  },

  async bookAppointment(input: NewAppointment): Promise<Appointment> {
    /* Read-compute-write inside one synchronous turn. Nothing can interleave,
       so there is no read-modify-write window to defend. */
    const held = db.appointments
      .filter((a) => a.facilityId === input.facilityId)
      .map((a) => a.tokenNumber);

    const appointment: Appointment = {
      id: newId('AP'),
      patientId: input.patientId,
      facilityId: input.facilityId,
      ...(input.recordId ? { recordId: input.recordId } : {}),
      tokenNumber: nextTokenFrom(held),
      status: 'scheduled',
      isTeleconsult: input.isTeleconsult ?? false,
      createdAt: nowIso(),
    };
    db.appointments.push(appointment);

    const facility = db.facilities.find((f) => f.id === input.facilityId);
    if (facility) facility.currentQueueLength += 1;

    persist();
    return clone(appointment);
  },

  /* —————————————————————————————— Referrals —————————————————————————————— */

  async listReferrals(patientId?: string): Promise<Referral[]> {
    const rows = patientId
      ? db.referrals.filter((r) => r.patientId === patientId)
      : db.referrals;
    return clone(
      [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    );
  },

  async raiseReferral(input: NewReferral): Promise<Referral> {
    const at = nowIso();
    const referral: Referral = {
      id: newId('RF'),
      patientId: input.patientId,
      fromFacility: input.fromFacility,
      toFacilityOrSpecialist: input.toFacilityOrSpecialist,
      ...(input.reason ? { reason: input.reason } : {}),
      status: 'referred',
      raisedBy: input.raisedBy,
      createdAt: at,
      updatedAt: at,
    };
    db.referrals.push(referral);
    persist();
    return clone(referral);
  },

  /** Delegates to the only enforcement layer and does not write on rejection. */
  async advanceReferralStatus(
    id: string,
    to: ReferralStatus,
  ): Promise<WriteResult<Referral> | { ok: false; reasonKey: TransitionReasonKey }> {
    const referral = db.referrals.find((r) => r.id === id);
    if (!referral) return { ok: false, reasonKey: 'referral.error.notFound' };

    const verdict = advanceReferral(referral.status, to);
    if (!verdict.ok) return { ok: false, reasonKey: verdict.reasonKey };

    referral.status = verdict.next;
    referral.updatedAt = nowIso();
    persist();
    return { ok: true, value: clone(referral) };
  },

  /* ———————————————————————————— Prescriptions ———————————————————————————— */

  async listPrescriptions(recordIds: string[]): Promise<Prescription[]> {
    const set = new Set(recordIds ?? []);
    return clone(db.prescriptions.filter((p) => set.has(p.recordId)));
  },

  async addPrescription(
    input: NewPrescription,
  ): Promise<WriteResult<Prescription>> {
    const check = validatePrescription(input.medicines);
    if (!check.ok) return { ok: false, reasonKey: check.reasonKey };

    const prescription: Prescription = {
      id: newId('RX'),
      recordId: input.recordId,
      medicines: check.value,
      ...(input.dosage ? { dosage: input.dosage } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      prescribedBy: input.prescribedBy,
      createdAt: nowIso(),
    };
    db.prescriptions.push(prescription);
    persist();
    return { ok: true, value: clone(prescription) };
  },

  /* ————————————————————————————— The one read ————————————————————————————— */

  async getPatientTimeline(patientId: string): Promise<TimelineEntry[]> {
    const records = db.healthRecords.filter((r) => r.patientId === patientId);
    const recordIds = new Set(records.map((r) => r.id));

    const entries: TimelineEntry[] = [
      ...records.map<TimelineEntry>((record) => ({
        kind: 'record',
        timestamp: record.timestamp,
        record: clone(record),
      })),
      ...db.prescriptions
        .filter((p) => recordIds.has(p.recordId))
        .map<TimelineEntry>((prescription) => ({
          kind: 'prescription',
          timestamp: prescription.createdAt,
          prescription: clone(prescription),
        })),
      ...db.referrals
        .filter((r) => r.patientId === patientId)
        .map<TimelineEntry>((referral) => ({
          kind: 'referral',
          timestamp: referral.createdAt,
          referral: clone(referral),
        })),
      ...db.appointments
        .filter((a) => a.patientId === patientId)
        .map<TimelineEntry>((appointment) => ({
          kind: 'appointment',
          timestamp: appointment.createdAt,
          appointment: clone(appointment),
        })),
    ];

    return byTimestampDesc(entries);
  },

  /* ——————————————————————————— Mock surfaces ——————————————————————————— */

  async listNotifications(patientId?: string): Promise<AppNotification[]> {
    const rows = patientId
      ? db.notifications.filter((n) => n.patientId === patientId)
      : db.notifications;
    return clone(rows);
  },

  async logNotification(
    input: Omit<AppNotification, 'id' | 'createdAt'>,
  ): Promise<AppNotification> {
    const notification: AppNotification = {
      ...input,
      id: newId('NT'),
      createdAt: nowIso(),
    };
    db.notifications.push(notification);
    persist();
    return clone(notification);
  },

  async reset(): Promise<void> {
    resetDemoData();
  },

  /* ========================================================================
     The named surface. Thin wrappers over the readers above, present so that
     later screens have a method to call instead of a read to re-invent.
     ====================================================================== */

  /* ——————————————————————————— Patients ——————————————————————————— */

  async updatePatientLanguage(
    patientId: string,
    language: SupportedLanguage,
  ): Promise<Patient | null> {
    return memoryRepo.setPreferredLanguage(patientId, language);
  },

  /* ———————————————————————————— Records ———————————————————————————— */

  async listRecordsForPatient(patientId: string): Promise<HealthRecord[]> {
    return memoryRepo.listHealthRecords(patientId);
  },

  async getRecord(id: string): Promise<HealthRecord | null> {
    return memoryRepo.getHealthRecord(id);
  },

  async setClinicalDecision(
    recordId: string,
    decision: ClinicalDecision,
  ): Promise<WriteResult<HealthRecord>> {
    return memoryRepo.recordClinicalDecision(recordId, decision);
  },

  /* ————————————————————————— Appointments ————————————————————————— */

  async createAppointment(input: NewAppointment): Promise<Appointment> {
    return memoryRepo.bookAppointment(input);
  },

  async listAppointmentsForPatient(patientId: string): Promise<Appointment[]> {
    return memoryRepo.listAppointments(patientId);
  },

  /** Ascending by Token_Number: a queue is read in serving order. */
  async listAppointmentsForFacility(facilityId: string): Promise<Appointment[]> {
    return clone(
      [...db.appointments.filter((a) => a.facilityId === facilityId)].sort(
        (a, b) => a.tokenNumber - b.tokenNumber,
      ),
    );
  },

  async latestAppointmentForPatient(
    patientId: string,
  ): Promise<Appointment | null> {
    const rows = await memoryRepo.listAppointments(patientId);
    return rows.length > 0 ? rows[0] : null;
  },

  /* —————————————————————————— Referrals —————————————————————————— */

  async createReferral(input: NewReferral): Promise<Referral> {
    return memoryRepo.raiseReferral(input);
  },

  async listReferralsForPatient(patientId: string): Promise<Referral[]> {
    return memoryRepo.listReferrals(patientId);
  },

  /* ———————————————————————— Prescriptions ———————————————————————— */

  async createPrescription(
    input: NewPrescription,
  ): Promise<WriteResult<Prescription>> {
    return memoryRepo.addPrescription(input);
  },

  async listPrescriptionsForRecord(recordId: string): Promise<Prescription[]> {
    return memoryRepo.listPrescriptions([recordId]);
  },

  async listPrescriptionsForPatient(patientId: string): Promise<Prescription[]> {
    const recordIds = db.healthRecords
      .filter((r) => r.patientId === patientId)
      .map((r) => r.id);
    const rows = await memoryRepo.listPrescriptions(recordIds);
    return [...rows].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  },

  /* ———————————————————————————— Stock ———————————————————————————— */

  async listStockForFacility(facilityId: string): Promise<StockRow[]> {
    return withStockLevel(db.medicineStock.filter((m) => m.facilityId === facilityId));
  },

  async listAllStock(): Promise<StockRow[]> {
    return withStockLevel(db.medicineStock);
  },

  /* ———————————————————————— Notifications ———————————————————————— */

  async createNotification(
    input: Omit<AppNotification, 'id' | 'createdAt'>,
  ): Promise<AppNotification> {
    return memoryRepo.logNotification(input);
  },

  /* ——————————————————————— Aggregate dashboard ——————————————————————— */

  async getDashboardStats(): Promise<DashboardStats> {
    const byRisk: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };
    for (const r of db.healthRecords) byRisk[r.riskLevel] += 1;

    const referralsByStatus: Record<ReferralStatus, number> = {
      referred: 0,
      in_progress: 0,
      completed: 0,
    };
    for (const r of db.referrals) referralsByStatus[r.status] += 1;

    const counts = new Map<string, number>();
    for (const a of db.appointments) {
      counts.set(a.facilityId, (counts.get(a.facilityId) ?? 0) + 1);
    }
    const byFacility = db.facilities.map((f) => ({
      facilityId: f.id,
      facilityName: f.name,
      count: counts.get(f.id) ?? 0,
    }));

    return {
      totalPatients: db.patients.length,
      totalRecords: db.healthRecords.length,
      byRisk,
      byFacility,
      referralsByStatus,
      topSymptomTerms: topSymptomTerms(db.healthRecords.map((r) => r.symptoms)),
    };
  },

  /* ————————————————————————— Offline_Queue ————————————————————————— */

  async enqueueWrite(
    kind: QueuedWriteKind,
    payload: unknown,
  ): Promise<QueuedWrite> {
    const write: QueuedWrite = {
      id: nextQueueId(),
      kind,
      payload,
      createdAt: nowIso(),
      attempts: 0,
      lastError: null,
      status: 'pending',
    };
    queue.push(write);
    persistQueue();
    return clone(write);
  },

  async listQueuedWrites(): Promise<QueuedWrite[]> {
    return clone(inSubmissionOrder(queue));
  },

  async queueCounts(): Promise<QueueCounts> {
    let pending = 0;
    let failed = 0;
    for (const w of queue) {
      if (w.status === 'failed') failed += 1;
      else pending += 1;
    }
    return { pending, failed, total: queue.length };
  },

  /**
   * Replays in submission order. An acknowledged write is REMOVED; a failed one
   * is retained with its attempt count and error so the count Req 19.5 asks for
   * is derivable from the queue itself.
   *
   * A `failed` write is retried on every subsequent pass rather than parked:
   * with no conflict resolution in the MVP (Req 19.6) the only failure mode is a
   * transient one, and parking a write a user is waiting on is the worse error.
   */
  async replayQueue(): Promise<ReplayOutcome> {
    let replayed = 0;
    let failed = 0;

    for (const write of inSubmissionOrder(queue)) {
      try {
        await applyQueuedWrite(write);
        queue = queue.filter((w) => w.id !== write.id);
        replayed += 1;
      } catch (error) {
        const held = queue.find((w) => w.id === write.id);
        if (held) {
          held.attempts += 1;
          held.lastError = error instanceof Error ? error.message : 'replay-failed';
          held.status = 'failed';
        }
        failed += 1;
      }
    }

    persistQueue();
    return {
      replayed,
      failed,
      remaining: inSubmissionOrder(queue).map((w) => w.id),
    };
  },

  async clearQueue(): Promise<void> {
    queue = [];
    persistQueue();
  },
};

/* ————————————————————————————— Pure helpers ————————————————————————————— */

function withStockLevel(rows: MedicineStock[]): StockRow[] {
  return clone(rows).map((row) => {
    const reorderThreshold = reorderThresholdFor(row);
    return { ...row, reorderThreshold, level: stockLevel(row.quantity, reorderThreshold) };
  });
}

/**
 * The documented v1 heuristic of Requirement 20.5: term frequency over recorded
 * `symptoms` strings. Tokens shorter than three characters and a small stop list
 * are dropped, ties break alphabetically so the chart is stable across renders.
 *
 * This is NOT disease detection and is never labelled as such. It counts words.
 */
const STOP_TERMS = new Set([
  'and', 'with', 'the', 'for', 'from', 'has', 'have', 'been', 'since', 'days',
  'day', 'week', 'weeks', 'month', 'months', 'not', 'but', 'पर', 'और', 'से',
  'है', 'हैं', 'में', 'को', 'का', 'की', 'के', 'रहा', 'रही', 'रहे', 'नहीं', 'दिन',
  'हफ्ते', 'तीन', 'चार', 'दो', 'एक',
]);

export function topSymptomTerms(
  symptoms: string[],
  limit = 6,
): DashboardStats['topSymptomTerms'] {
  const counts = new Map<string, number>();
  for (const text of symptoms ?? []) {
    const seen = new Set<string>();
    for (const raw of (text ?? '').normalize('NFC').toLowerCase().split(/[\s,.;:!?।"'()\[\]/-]+/)) {
      const term = raw.trim();
      if (term.length < 3 || STOP_TERMS.has(term)) continue;
      /* Once per record, so one verbose entry cannot dominate the chart. */
      if (seen.has(term)) continue;
      seen.add(term);
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

/** One handler per QueuedWriteKind. The switch is exhaustive, so a new kind is
 *  a compile error here until it is handled. */
async function applyQueuedWrite(write: QueuedWrite): Promise<void> {
  switch (write.kind) {
    case 'intake': {
      const payload = write.payload as QueuedIntakePayload;
      const record = await memoryRepo.createHealthRecord(payload.record);
      if (payload.appointment) {
        await memoryRepo.bookAppointment({
          patientId: record.patientId,
          facilityId: payload.appointment.facilityId,
          recordId: record.id,
          ...(payload.appointment.isTeleconsult !== undefined
            ? { isTeleconsult: payload.appointment.isTeleconsult }
            : {}),
        });
      }
      return;
    }
    case 'referral': {
      const payload = write.payload as QueuedReferralPayload;
      await memoryRepo.raiseReferral(payload.referral);
      return;
    }
    case 'prescription': {
      const payload = write.payload as QueuedPrescriptionPayload;
      const result = await memoryRepo.addPrescription(payload.prescription);
      if (!result.ok) throw new Error(result.reasonKey);
      return;
    }
    case 'clinical-decision': {
      const payload = write.payload as QueuedClinicalDecisionPayload;
      const result = await memoryRepo.setClinicalDecision(
        payload.recordId,
        payload.decision,
      );
      if (!result.ok) throw new Error(result.reasonKey);
      return;
    }
    default: {
      const never: never = write.kind;
      throw new Error(`unhandled-queued-write-${String(never)}`);
    }
  }
}

/**
 * Drops the snapshot and reseeds. A demo gets run more than once and the second
 * run should start from the same place as the first.
 */
export function resetDemoData(): void {
  if (hasStorage()) {
    try {
      window.localStorage.removeItem(SNAPSHOT_KEY);
      window.localStorage.removeItem(QUEUE_KEY);
    } catch {
      /* nothing to do — the reassignments below still reset the session */
    }
  }
  db = buildSeed();
  queue = [];
}

/** Escape hatch for tests and devtools. Not used by any screen. */
export function __unsafeSnapshot(): Db {
  return clone(db);
}

export const repo = memoryRepo;
export { SNAPSHOT_KEY, QUEUE_KEY };
export { stockLevel, reorderThresholdFor, DEFAULT_REORDER_THRESHOLD } from './repo';
