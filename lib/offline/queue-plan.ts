import type { QueuedWrite } from '@/lib/types';
import type { QueueCounts } from '@/lib/data/repo';

/**
 * The Offline_Queue's RULES, with no I/O anywhere in the file.
 *
 * `lib/data/*` owns storage — `enqueueWrite`, `listQueuedWrites`, `replayQueue`.
 * This module owns the decisions that storage should not be allowed to imply:
 * what order a replay runs in, what a queue looks like after a pass, and what
 * the badge says. All three are pure functions over a `QueuedWrite[]`, so all
 * three are testable without a browser, a network, or a clock.
 *
 * The separation is load-bearing. A rule that lives inside the adapter is a rule
 * that gets re-derived by the next adapter; a rule that lives here is a rule the
 * test suite pins once.
 */

/** A per-write replay verdict, as reported by whatever actually attempted it. */
export interface ReplayVerdict {
  id: number;
  ok: boolean;
  /** Present only on failure. Recorded verbatim onto the retained write. */
  error?: string | null;
}

export interface FoldedReplay {
  /** The queue as it stands after the pass, in submission order. */
  writes: QueuedWrite[];
  /** Acknowledged and therefore removed. */
  replayed: number;
  /** Retained with `status: 'failed'`. */
  failed: number;
  /**
   * The id the run stopped at, or null if it ran to the end. Non-null means
   * head-of-line blocking engaged and the ids after it were never attempted.
   */
  stoppedAtId: number | null;
  counts: QueueCounts;
}

/** Ascending by id, without mutating the input. */
function inSubmissionOrder(writes: readonly QueuedWrite[]): QueuedWrite[] {
  return [...writes].sort((a, b) => a.id - b.id);
}

/**
 * The replay order: ids in STRICTLY ascending order.
 *
 * `enqueueWrite` assigns a monotonic integer id, so ascending id IS submission
 * order (Req 19.4) — the ordering guarantee is a sort over a number rather than
 * a convention about insertion. `createdAt` is deliberately not the sort key: two
 * writes submitted inside the same millisecond would tie, and an ISO string
 * compare would then decide the order of a patient's record by nothing at all.
 */
export function planReplay(writes: readonly QueuedWrite[]): number[] {
  return inSubmissionOrder(writes).map((w) => w.id);
}

/**
 * The queue state after a replay pass, given a verdict per attempted id.
 *
 * - An ACKNOWLEDGED write is REMOVED. There is no `'synced'` status to filter
 *   on, so "the queue holds unsynced writes" stays a property of the collection.
 * - A FAILED write is RETAINED with `attempts` incremented, `lastError` set, and
 *   `status: 'failed'` (Req 19.5). Nothing a user submitted is ever dropped
 *   because a network call did not come back.
 * - A write with no verdict was never attempted and is retained untouched.
 *
 * HEAD-OF-LINE BLOCKING — the tradeoff, stated:
 *
 *   The run STOPS at the first failure instead of skipping past it. Skipping
 *   would look better on the badge (one stuck write instead of a stalled queue)
 *   but it breaks the only guarantee the queue offers. Writes for one patient are
 *   causally ordered: a clinical decision references the record it was made
 *   against, a prescription references the record it belongs to. Apply write 4
 *   while write 2 is still held and the store can end up with a decision whose
 *   record does not exist yet, or an appointment for a visit that is not there.
 *   A stalled queue is visible and recoverable; a queue applied out of order is
 *   neither. So: stop, retain, show the failure, offer a retry.
 */
export function foldReplay(
  writes: readonly QueuedWrite[],
  outcomes: readonly ReplayVerdict[],
): FoldedReplay {
  const verdictById = new Map<number, ReplayVerdict>();
  for (const outcome of outcomes) verdictById.set(outcome.id, outcome);

  const ordered = inSubmissionOrder(writes);
  const next: QueuedWrite[] = [];

  let replayed = 0;
  let failed = 0;
  let stoppedAtId: number | null = null;

  for (const write of ordered) {
    /* Past the first failure nothing is attempted, so nothing is changed. */
    if (stoppedAtId !== null) {
      next.push({ ...write });
      continue;
    }

    const verdict = verdictById.get(write.id);

    /* No verdict: never attempted. Held exactly as it was. */
    if (!verdict) {
      next.push({ ...write });
      continue;
    }

    if (verdict.ok) {
      replayed += 1;
      continue;
    }

    next.push({
      ...write,
      attempts: write.attempts + 1,
      lastError: verdict.error ?? 'replay-failed',
      status: 'failed',
    });
    failed += 1;
    stoppedAtId = write.id;
  }

  return { writes: next, replayed, failed, stoppedAtId, counts: deriveCounts(next) };
}

/**
 * The badge number, DERIVED from queue contents.
 *
 * Never an incremented counter. A counter and a queue are two representations of
 * one fact, and the moment a write is enqueued on a path that forgets to bump the
 * counter — or a replay removes one on a path that forgets to decrement it — the
 * badge starts lying, and a badge that lies about unsent patient data is worse
 * than no badge. Deriving costs one pass over an array that is, by construction,
 * a handful of items long.
 */
export function deriveCounts(writes: readonly QueuedWrite[]): QueueCounts {
  let pending = 0;
  let failed = 0;
  for (const write of writes) {
    if (write.status === 'failed') failed += 1;
    else pending += 1;
  }
  return { pending, failed, total: writes.length };
}
