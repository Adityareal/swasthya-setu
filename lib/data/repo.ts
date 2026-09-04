import type {
  Appointment,
  AppNotification,
  ChatTurn,
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
  StockLevel,
  SupportedLanguage,
  TimelineEntry,
  TriageSource,
  Vitals,
} from '@/lib/types';
import type { TransitionReasonKey } from '@/lib/referral/machine';

/**
 * The repository seam. There is no database, so this interface is where one
 * would go: one interface, one shipped adapter (`memory-repo.ts`), and a stated
 * note about what a real backend would add.
 *
 * Every method is `async` even though the shipped adapter never awaits
 * anything, so that a network-backed adapter is a drop-in and no call site
 * changes shape.
 *
 * Every patient-scoped read takes a `patientId` and nothing else. There is no
 * `listAllHealthRecords()` here, so a screen cannot accidentally render another
 * patient's data — the absence is the control.
 */

export interface NewPatient {
  fullName: string;
  age?: number | null;
  gender?: string | null;
  village?: string | null;
  district?: string;
  phone?: string | null;
  preferredLanguage: SupportedLanguage;
}

export interface NewHealthRecord {
  patientId: string;
  symptoms: string;
  /** The intake conversation, when intake ran as a multi-turn chat. */
  conversation?: ChatTurn[];
  aiTriageSummary: string | null;
  riskLevel: RiskLevel;
  triageSource: TriageSource;
  vitals?: Vitals;
  /** Record_Author is a required argument, not an optional field, so an
   *  unattributed record is unconstructable (Req 4.3). */
  authorRole: HealthRecord['authorRole'];
  authorId: string;
}

export interface NewAppointment {
  patientId: string;
  facilityId: string;
  recordId?: string;
  isTeleconsult?: boolean;
}

export interface NewReferral {
  patientId: string;
  fromFacility: string;
  toFacilityOrSpecialist: string;
  reason?: string;
  raisedBy: string | null;
}

export interface NewPrescription {
  recordId: string;
  medicines: string;
  dosage?: string;
  notes?: string;
  prescribedBy: string | null;
}

export type WriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reasonKey: string };

/* ——————————————————————————— Medicine stock ——————————————————————————— */

/**
 * `medicine_stock` carries a `quantity` and nothing else, so the threshold lives
 * here rather than on the row. One number, one place, and a facility-specific
 * threshold is a one-line change to `reorderThresholdFor` when it is needed.
 */
export const DEFAULT_REORDER_THRESHOLD = 30;

/**
 * Pure. `out` at zero or below, `low` at or under the threshold, `in_stock`
 * above it. A non-finite or negative quantity reads as `out`, which is the safe
 * direction: a facility told it has stock it does not have sends a patient on a
 * wasted journey.
 */
export function stockLevel(
  quantity: number,
  reorderThreshold: number = DEFAULT_REORDER_THRESHOLD,
): StockLevel {
  if (!Number.isFinite(quantity) || quantity <= 0) return 'out';
  const threshold = Number.isFinite(reorderThreshold)
    ? reorderThreshold
    : DEFAULT_REORDER_THRESHOLD;
  return quantity <= threshold ? 'low' : 'in_stock';
}

/**
 * One threshold for every facility today. The row is taken as an argument
 * anyway, because a per-facility or per-medicine threshold is a real
 * requirement of a real deployment and taking it now means adding it later
 * changes this function and no call site.
 */
export function reorderThresholdFor(row: MedicineStock): number {
  void row;
  return DEFAULT_REORDER_THRESHOLD;
}

/** A stock row with its threshold and derived level attached, so no screen
 *  re-implements the comparison. */
export interface StockRow extends MedicineStock {
  reorderThreshold: number;
  level: StockLevel;
}

/* ——————————————————————————— Offline queue ——————————————————————————— */

/** The payload shapes `replayQueue()` dispatches on, one per QueuedWriteKind. */
export interface QueuedIntakePayload {
  record: NewHealthRecord;
  appointment?: { facilityId: string; isTeleconsult?: boolean };
}
export interface QueuedReferralPayload {
  referral: NewReferral;
}
export interface QueuedPrescriptionPayload {
  prescription: NewPrescription;
}
export interface QueuedClinicalDecisionPayload {
  recordId: string;
  decision: ClinicalDecision;
}

export interface QueueCounts {
  pending: number;
  failed: number;
  total: number;
}

export interface ReplayOutcome {
  replayed: number;
  failed: number;
  /** Ids still held in the queue after the pass. */
  remaining: number[];
}

export interface Repo {
  /* ——— Patients ——— */
  listPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | null>;
  createPatient(input: NewPatient): Promise<Patient>;
  findPatientByQrId(qrId: string): Promise<Patient | null>;
  setPreferredLanguage(
    patientId: string,
    language: SupportedLanguage,
  ): Promise<Patient | null>;

  /* ——— Workers and facilities ——— */
  listWorkers(): Promise<HealthWorker[]>;
  getWorker(id: string): Promise<HealthWorker | null>;
  listFacilities(): Promise<Facility[]>;
  getFacility(id: string): Promise<Facility | null>;
  listMedicineStock(facilityId?: string): Promise<MedicineStock[]>;

  /* ——— The Shared_Record ——— */
  listHealthRecords(patientId: string): Promise<HealthRecord[]>;
  getHealthRecord(id: string): Promise<HealthRecord | null>;
  createHealthRecord(input: NewHealthRecord): Promise<HealthRecord>;
  recordClinicalDecision(
    recordId: string,
    decision: ClinicalDecision,
  ): Promise<WriteResult<HealthRecord>>;

  listAppointments(patientId: string): Promise<Appointment[]>;
  /** Computes the Token_Number via `nextTokenFrom` over the tokens already held
   *  at that facility, then writes — one synchronous turn, one writer. */
  bookAppointment(input: NewAppointment): Promise<Appointment>;

  listReferrals(patientId?: string): Promise<Referral[]>;
  raiseReferral(input: NewReferral): Promise<Referral>;
  /** Delegates to `advanceReferral()`, the only enforcement layer, and does not
   *  write when the transition is rejected (Req 17.4). */
  advanceReferralStatus(
    id: string,
    to: ReferralStatus,
  ): Promise<WriteResult<Referral> | { ok: false; reasonKey: TransitionReasonKey }>;

  listPrescriptions(recordIds: string[]): Promise<Prescription[]>;
  addPrescription(input: NewPrescription): Promise<WriteResult<Prescription>>;

  /**
   * ONE merged reverse-chronological thread across health records,
   * prescriptions, referrals and appointments.
   *
   * All three roles call this same read. That is the product's core claim
   * (Req 4): symptoms, vitals, history, decisions and referrals follow the
   * patient instead of resetting at each facility. Because it is one read,
   * "all three roles see the same record" is a property of the code rather
   * than a claim about three separate screens.
   */
  getPatientTimeline(patientId: string): Promise<TimelineEntry[]>;

  /* ——— Mock_Feature surfaces (Req 20) ——— */
  listNotifications(patientId?: string): Promise<AppNotification[]>;
  logNotification(
    input: Omit<AppNotification, 'id' | 'createdAt'>,
  ): Promise<AppNotification>;

  /* ——— Demo control ——— */
  reset(): Promise<void>;

  /* ========================================================================
     The named surface every later screen calls.

     Below this line the interface is deliberately WIDER than any single
     screen needs. `lib/data/*` is frozen once this wave lands, so a method
     that is missing here is a method a later screen cannot have — the cost of
     an unused method is one wrapper, and the cost of a missing one is a screen
     that hardcodes its own read. The asymmetry decides it.
     ====================================================================== */

  /* ——— Patients ——— */
  updatePatientLanguage(
    patientId: string,
    language: SupportedLanguage,
  ): Promise<Patient | null>;

  /* ——— Records ——— */
  listRecordsForPatient(patientId: string): Promise<HealthRecord[]>;
  getRecord(id: string): Promise<HealthRecord | null>;
  setClinicalDecision(
    recordId: string,
    decision: ClinicalDecision,
  ): Promise<WriteResult<HealthRecord>>;

  /* ——— Appointments ——— */
  createAppointment(input: NewAppointment): Promise<Appointment>;
  listAppointmentsForPatient(patientId: string): Promise<Appointment[]>;
  /** Ascending by Token_Number — this is a queue, and a queue is read in the
   *  order it will be served, not in the order it was written. */
  listAppointmentsForFacility(facilityId: string): Promise<Appointment[]>;
  /** Req 13.1 — the patient workspace shows ONE appointment, the newest. */
  latestAppointmentForPatient(patientId: string): Promise<Appointment | null>;

  /* ——— Referrals ——— */
  createReferral(input: NewReferral): Promise<Referral>;
  listReferralsForPatient(patientId: string): Promise<Referral[]>;

  /* ——— Prescriptions ——— */
  createPrescription(input: NewPrescription): Promise<WriteResult<Prescription>>;
  listPrescriptionsForRecord(recordId: string): Promise<Prescription[]>;
  /** Joins through the patient's records, so no caller has to collect record
   *  ids first. */
  listPrescriptionsForPatient(patientId: string): Promise<Prescription[]>;

  /* ——— Stock (Req 20.5) ——— */
  listStockForFacility(facilityId: string): Promise<StockRow[]>;
  listAllStock(): Promise<StockRow[]>;

  /* ——— Notifications ——— */
  createNotification(
    input: Omit<AppNotification, 'id' | 'createdAt'>,
  ): Promise<AppNotification>;

  /* ——— Aggregate dashboard (Req 20.4) ——— */
  getDashboardStats(): Promise<DashboardStats>;

  /* ——— Offline_Queue (Req 19) ——— */
  enqueueWrite(kind: QueuedWriteKind, payload: unknown): Promise<QueuedWrite>;
  /** Submission order, oldest first — the order Req 19.4 requires for replay. */
  listQueuedWrites(): Promise<QueuedWrite[]>;
  queueCounts(): Promise<QueueCounts>;
  /** Applies each held write in submission order. An acknowledged write is
   *  removed; a failed one is RETAINED with its error (Req 19.5). */
  replayQueue(): Promise<ReplayOutcome>;
  clearQueue(): Promise<void>;
}
