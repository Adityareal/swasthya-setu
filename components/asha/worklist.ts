import type { HealthRecord, Patient, RiskLevel } from '@/lib/types';

/**
 * The ASHA worklist ordering.
 *
 * A worklist that lists patients alphabetically is an address book. The one
 * question this screen answers is "who do I see first", so a patient carrying a
 * recent `high` record is lifted to the top regardless of name, and everyone
 * else falls back to how urgent and how fresh their newest record is.
 *
 * Pure, and separated from the screen so the ordering can be read and reasoned
 * about without a browser.
 */

/** "Recent" is bounded: a `high` record from last winter is history, not a task. */
export const RECENT_WINDOW_DAYS = 14;

const RECENT_WINDOW_MS = RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const RISK_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

export interface WorklistRow {
  patient: Patient;
  /** Newest record, or null for a patient with no visits yet. */
  latest: HealthRecord | null;
  /** Timestamp of the newest `high` record inside the recent window, if any. */
  recentHighAt: string | null;
  recordCount: number;
}

export interface WorklistInput {
  patient: Patient;
  /** As returned by `repo.listHealthRecords` — newest first. */
  records: HealthRecord[];
}

function parsed(iso: string | null | undefined): number {
  if (!iso) return Number.NaN;
  return Date.parse(iso);
}

export function buildWorklistRow(
  { patient, records }: WorklistInput,
  now: number = Date.now(),
): WorklistRow {
  const sorted = [...records].sort((a, b) => parsed(b.timestamp) - parsed(a.timestamp));
  const recentHigh = sorted.find((record) => {
    if (record.riskLevel !== 'high') return false;
    const at = parsed(record.timestamp);
    return Number.isFinite(at) && now - at <= RECENT_WINDOW_MS;
  });

  return {
    patient,
    latest: sorted[0] ?? null,
    recentHighAt: recentHigh ? recentHigh.timestamp : null,
    recordCount: sorted.length,
  };
}

/**
 * Recent `high` first (newest of those first), then by the newest record's risk,
 * then by how fresh that record is, then by name so the order is total and the
 * list never reshuffles between renders.
 */
export function compareWorklistRows(a: WorklistRow, b: WorklistRow): number {
  if (a.recentHighAt && b.recentHighAt) {
    const byRecency = parsed(b.recentHighAt) - parsed(a.recentHighAt);
    if (byRecency !== 0) return byRecency;
  } else if (a.recentHighAt) {
    return -1;
  } else if (b.recentHighAt) {
    return 1;
  }

  const rankA = a.latest ? RISK_RANK[a.latest.riskLevel] : 3;
  const rankB = b.latest ? RISK_RANK[b.latest.riskLevel] : 3;
  if (rankA !== rankB) return rankA - rankB;

  const freshA = parsed(a.latest?.timestamp);
  const freshB = parsed(b.latest?.timestamp);
  const bothDated = Number.isFinite(freshA) && Number.isFinite(freshB);
  if (bothDated && freshA !== freshB) return freshB - freshA;

  return a.patient.fullName.localeCompare(b.patient.fullName);
}

export function buildWorklist(
  input: WorklistInput[],
  now: number = Date.now(),
): WorklistRow[] {
  return input.map((entry) => buildWorklistRow(entry, now)).sort(compareWorklistRows);
}
