import type { HealthRecord, Patient, RiskLevel } from '@/lib/types';
import { truncateAt } from '@/lib/summary/trim';

/**
 * The doctor queue's ordering rule, extracted as a pure function so the one
 * claim that matters clinically — *a `high` patient is never rendered below a
 * `low` one* — is a tested property rather than a `.sort()` buried in JSX.
 */

/** Higher weight sorts first. */
export const RISK_WEIGHT: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export interface QueueRow {
  patient: Patient;
  /** The patient's newest health record, or `null` when they have none. */
  latest: HealthRecord | null;
  /** Whether `latest` already carries a Clinical_Decision (Req 15.4). */
  decided: boolean;
}

function millis(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? -Infinity : parsed;
}

/**
 * Risk descending, then recency descending. A patient with no record at all
 * sorts last: there is nothing to triage, so they cannot outrank someone who
 * has been assessed.
 */
export function compareQueueRows(a: QueueRow, b: QueueRow): number {
  if (!a.latest && !b.latest) return 0;
  if (!a.latest) return 1;
  if (!b.latest) return -1;

  const byRisk = RISK_WEIGHT[b.latest.riskLevel] - RISK_WEIGHT[a.latest.riskLevel];
  if (byRisk !== 0) return byRisk;

  return millis(b.latest.timestamp) - millis(a.latest.timestamp);
}

/** Non-mutating. The result is a permutation of the input. */
export function orderQueue(rows: readonly QueueRow[]): QueueRow[] {
  return [...rows].sort(compareQueueRows);
}

/**
 * A one-line complaint snippet for a queue row. Whitespace is collapsed first
 * because a transcript carrying newlines would otherwise break the row's single
 * line, then `truncateAt` does the word-boundary cut — the same function the
 * summary payload uses, so there is one truncation rule in the product.
 */
export function complaintSnippet(symptoms: string, cap = 96): string {
  const collapsed = (symptoms ?? '').replace(/\s+/g, ' ').trim();
  return truncateAt(collapsed, cap);
}
