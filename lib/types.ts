/**
 * Swasthya Setu — the entity set, declared once.
 *
 * These types are the substrate. There is no database: the memory repo holds
 * these objects and every type maps one-to-one onto the table it describes if
 * a network-backed adapter is ever built.
 */

/* ——————————————————————————————— Unions ——————————————————————————————— */

export type RiskLevel = 'low' | 'medium' | 'high';
export type ReferralStatus = 'referred' | 'in_progress' | 'completed';
export type FacilityType = 'phc' | 'chc' | 'district_hospital';

/** Active_Role, `health_workers.role`, and `health_records.authorRole` are the
 *  same union, so the three uses cannot drift apart. */
export type Role = 'patient' | 'asha' | 'doctor';

/** Requirement 22.2's "exclude every other locale" made structural: a third
 *  locale is a type error at every call site. */
export type SupportedLanguage = 'en-IN' | 'hi-IN';

export type AppointmentStatus =
  | 'scheduled'
  | 'checked_in'
  | 'completed'
  | 'cancelled';

export type TriageSource = 'gemini' | 'fallback';

export type NotificationType =
  | 'appointment'
  | 'emergency'
  | 'referral'
  | 'teleconsult';
export type NotificationChannel = 'sms' | 'ivr' | 'push' | 'in_app';

/** Decimal degrees, parsed out of `Facility.location`. */
export interface LatLng {
  lat: number;
  lng: number;
}

/* ——————————————————————————————— Entities ——————————————————————————————— */

export interface Facility {
  id: string;
  name: string;
  /** Machine-readable `"lat,lng"` in decimal degrees, e.g. `'20.7453,78.6022'`. */
  location: string;
  /** Display string, kept separate from the coordinates. */
  locationLabel: string;
  type: FacilityType;
  currentQueueLength: number;
}

export interface HealthWorker {
  id: string;
  fullName: string;
  /** A Patient_User is not a worker. */
  role: Extract<Role, 'asha' | 'doctor'>;
  facilityId: string | null;
}

export interface Patient {
  id: string;
  fullName: string;
  age: number | null;
  gender: string | null;
  village: string | null;
  district: string;
  phone: string | null;
  preferredLanguage: SupportedLanguage;
  /** Unique. The QR payload is this bare string, never a URL (Req 18.4). */
  qrId: string;
}

/**
 * Vitals — every field optional (Req 8.3). An intake carrying no measurement
 * at all still produces a health record and still completes (Req 8.4).
 *
 * `bloodPressure` is the one string: "150/96" is two numbers wearing one
 * label, and the form validates its shape rather than its numeric-ness.
 */
export interface Vitals {
  bloodPressure?: string;
  pulse?: number;
  temperature?: number;
  spo2?: number;
  weight?: number;
}

/**
 * Clinical_Decision — the doctor's judgement, stored in its own object so it
 * physically cannot overwrite `aiTriageSummary` or `riskLevel` (Req 15.3).
 * `riskLevel` here may legitimately differ from the record's triage
 * `riskLevel`; both are then rendered side by side (Req 15.5).
 */
export interface ClinicalDecision {
  assessment: string;
  plan: string;
  riskLevel?: RiskLevel;
  /** `health_workers.id` of the deciding Doctor_User. */
  byId: string;
  /** ISO 8601. */
  at: string;
}

/** The Shared_Record spine. Exactly one thread per `patientId` (Req 4.1). */
export interface HealthRecord {
  id: string;
  patientId: string;

  symptoms: string;

  /**
   * The multi-turn intake conversation the assessment was reached through, when
   * intake ran as a chat. The doctor sees HOW the risk level was arrived at, not
   * only the conclusion. Absent on records created by single-shot intake.
   */
  conversation?: ChatTurn[];

  /* ——— AI suggestion. Written once at intake, never overwritten. ——— */
  aiTriageSummary: string | null;
  riskLevel: RiskLevel;
  triageSource: TriageSource;

  vitals?: Vitals;

  /* ——— Record_Author (Req 4.3). Required, so an unattributed record is
         unconstructable. ——— */
  authorRole: Role;
  /** `patients.id` for a Patient_User, `health_workers.id` otherwise. */
  authorId: string;

  /** ISO 8601. */
  timestamp: string;

  /** Absent until a Doctor_User records one. Stored separately from, and
   *  never in place of, the AI fields above (Req 15.3). */
  clinicalDecision?: ClinicalDecision;
}

export interface Appointment {
  id: string;
  patientId: string;
  facilityId: string;
  recordId?: string;
  /** > 0, unique per `facilityId`. */
  tokenNumber: number;
  status: AppointmentStatus;
  isTeleconsult?: boolean;
  createdAt: string;
}

export interface Referral {
  id: string;
  patientId: string;
  fromFacility: string;
  toFacilityOrSpecialist: string;
  reason?: string;
  status: ReferralStatus;
  raisedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  recordId: string;
  /** Non-blank (Req 16.2). */
  medicines: string;
  dosage?: string;
  notes?: string;
  prescribedBy: string | null;
  createdAt: string;
}

export interface MedicineStock {
  id: string;
  facilityId: string;
  medicine: string;
  quantity: number;
}

export interface AppNotification {
  id: string;
  patientId: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  payload: Record<string, unknown>;
  createdAt: string;
}

/* ——————————————————————————————— Timeline ——————————————————————————————— */

/**
 * TimelineEntry — the merged thread. Four entity types describe a patient's
 * history and they are stored separately for good reasons, but nobody
 * experiences care as four lists. Every variant carries a `timestamp` so the
 * merge is a single sort over one field.
 */
export type TimelineEntry =
  | { kind: 'record'; timestamp: string; record: HealthRecord }
  | { kind: 'prescription'; timestamp: string; prescription: Prescription }
  | { kind: 'referral'; timestamp: string; referral: Referral }
  | { kind: 'appointment'; timestamp: string; appointment: Appointment };

export type TimelineKind = TimelineEntry['kind'];

/* ————————————————————————— Triage wire shapes ————————————————————————— */

/** What `/api/triage` returns, and what `fallbackTriage()` returns. */
export interface TriageResult {
  risk_level: RiskLevel;
  summary: string;
  recommended_next_step: string;
  source: TriageSource;
  red_flags?: string[];
  /** Which keywords fired. Surfaced in the UI so a human can see the reason,
   *  and asserted in tests. Empty on the Gemini path. */
  matched: string[];
}

/** What `/api/summary` returns. */
export interface SummaryResponse {
  summary: string | null;
  unavailable: boolean;
  source: 'gemini' | 'template';
  reason?: 'timeout' | 'error' | 'unparseable' | 'empty-history' | 'no-key';
}

/* ————————————————————— Multi-turn symptom chat ————————————————————— */

/**
 * The chat does not replace the Triage_Engine, it FEEDS it. A conversation
 * terminates in the same structured shape a single-shot submission produces, so
 * everything downstream — the health record, the routing, the token — is
 * unchanged.
 */

export type ChatRole = 'user' | 'assistant';

export interface ChatTurn {
  role: ChatRole;
  text: string;
  /** ISO 8601. Passed in by the caller, never read from a clock inside the
   *  reducer, which is what keeps the reducer pure and testable. */
  at: string;
}

/**
 * One step of the conversation. `question` continues it, `assessment` ends it.
 *
 * INVARIANT: only a `question` is ever appended to `ChatTurn[]`. An
 * `assessment` is terminal and is rendered from the step, never stored as a
 * turn — which is what lets `countAssistantQuestions` simply count assistant
 * turns instead of trying to classify them.
 */
export type ChatStep =
  | { kind: 'question'; question: string; quickReplies: string[] }
  | {
      kind: 'assessment';
      risk_level: RiskLevel;
      summary: string;
      recommended_next_step: string;
      red_flags?: string[];
    };

/** What `/api/triage/chat` returns. HTTP 200 on every well-formed body. */
export interface ChatStepResponse {
  step: ChatStep;
  source: TriageSource;
}

/* ————————————————————————— Offline write queue ————————————————————————— */

/**
 * The four write kinds the Offline_Queue can hold. Deliberately a closed union:
 * a replay handler exists for each one, so adding a kind is a compile error
 * until the handler is written (Req 19.2, 19.4).
 */
export type QueuedWriteKind =
  | 'intake'
  | 'referral'
  | 'prescription'
  | 'clinical-decision';

/**
 * A single deferred write. `id` is a monotonic integer, not a uuid, because
 * Requirement 19.4 requires replay in SUBMISSION ORDER and an ordered integer
 * makes that a sort rather than a convention.
 *
 * `status` has no `'synced'` member: an acknowledged write is REMOVED from the
 * queue, so "the queue holds unsynced writes" is a property of the collection
 * rather than a filter every reader has to remember (Req 19.3).
 */
export interface QueuedWrite {
  id: number;
  kind: QueuedWriteKind;
  payload: unknown;
  /** ISO 8601. */
  createdAt: string;
  attempts: number;
  lastError: string | null;
  status: 'pending' | 'failed';
}

/* —————————————————————————— Aggregate dashboard —————————————————————————— */

/**
 * The government aggregate dashboard, computed from seeded rows and labelled a
 * Mock_Feature (Req 20.4). Every field is a count over rows that already exist:
 * there is no model here and the type says so.
 */
export interface DashboardStats {
  totalPatients: number;
  totalRecords: number;
  byRisk: Record<RiskLevel, number>;
  byFacility: Array<{ facilityId: string; facilityName: string; count: number }>;
  referralsByStatus: Record<ReferralStatus, number>;
  /** The documented v1 heuristic of Req 20.5: term frequency over recorded
   *  `symptoms` strings. Not a trained model, and never presented as one. */
  topSymptomTerms: Array<{ term: string; count: number }>;
}

/* ——————————————————————————— Medicine stock ——————————————————————————— */

/**
 * Three states rather than a raw quantity, because "42 units" answers a
 * question nobody asked and "low" answers the one they did.
 */
export type StockLevel = 'in_stock' | 'low' | 'out';
