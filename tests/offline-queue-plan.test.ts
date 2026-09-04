import { describe, expect, it } from 'vitest';
import type { QueuedWrite, QueuedWriteKind } from '@/lib/types';
import {
  deriveCounts,
  foldReplay,
  planReplay,
  type ReplayVerdict,
} from '@/lib/offline/queue-plan';

/**
 * Validates: Requirements 19.3, 19.4, 19.5, 22.1
 *
 * Zero mocks. Every function under test is pure over a `QueuedWrite[]`, which is
 * the whole reason the rules were pulled out of the storage adapter.
 */

const KINDS: QueuedWriteKind[] = [
  'intake',
  'referral',
  'prescription',
  'clinical-decision',
];

function write(id: number, over: Partial<QueuedWrite> = {}): QueuedWrite {
  return {
    id,
    kind: KINDS[id % KINDS.length]!,
    payload: { n: id },
    /* Deliberately DESCENDING against id, so any implementation that sorted by
       `createdAt` instead of by id would fail the ordering assertions. */
    createdAt: new Date(2_000_000_000_000 - id * 1000).toISOString(),
    attempts: 0,
    lastError: null,
    status: 'pending',
    ...over,
  };
}

function queueOf(...ids: number[]): QueuedWrite[] {
  return ids.map((id) => write(id));
}

/** Deterministic shuffle, so a failure reproduces. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function isStrictlyAscending(ids: readonly number[]): boolean {
  for (let i = 1; i < ids.length; i += 1) {
    if (ids[i]! <= ids[i - 1]!) return false;
  }
  return true;
}

function allOk(writes: readonly QueuedWrite[]): ReplayVerdict[] {
  return writes.map((w) => ({ id: w.id, ok: true }));
}

/* ————————————————————————————— planReplay ————————————————————————————— */

describe('planReplay', () => {
  it('emits ids in strictly ascending order', () => {
    expect(planReplay(queueOf(1, 2, 3, 4))).toEqual([1, 2, 3, 4]);
    expect(isStrictlyAscending(planReplay(queueOf(9, 3, 7, 1)))).toBe(true);
  });

  it('is order-independent over shuffled input', () => {
    const ids = [1, 2, 3, 5, 8, 13, 21];
    const canonical = planReplay(queueOf(...ids));

    for (let seed = 1; seed <= 25; seed += 1) {
      const scrambled = shuffled(queueOf(...ids), seed);
      expect(planReplay(scrambled)).toEqual(canonical);
    }
  });

  it('does not mutate the input array', () => {
    const writes = queueOf(5, 1, 3);
    const before = writes.map((w) => w.id);
    planReplay(writes);
    expect(writes.map((w) => w.id)).toEqual(before);
  });

  it('returns an empty plan for an empty queue', () => {
    expect(planReplay([])).toEqual([]);
  });
});

/* ————————————————————————————— deriveCounts ———————————————————————————— */

describe('deriveCounts', () => {
  it('always equals the actual contents', () => {
    const writes = [
      write(1),
      write(2, { status: 'failed', attempts: 1, lastError: 'boom' }),
      write(3),
      write(4, { status: 'failed', attempts: 3, lastError: 'boom' }),
      write(5),
    ];

    const counts = deriveCounts(writes);
    expect(counts.total).toBe(writes.length);
    expect(counts.pending).toBe(writes.filter((w) => w.status === 'pending').length);
    expect(counts.failed).toBe(writes.filter((w) => w.status === 'failed').length);
    expect(counts.pending + counts.failed).toBe(counts.total);
  });

  it('is zero on every field for an empty queue', () => {
    expect(deriveCounts([])).toEqual({ pending: 0, failed: 0, total: 0 });
  });
});

/* —————————————————————————————— foldReplay ————————————————————————————— */

describe('foldReplay — all successful', () => {
  it('empties the queue', () => {
    const writes = queueOf(1, 2, 3, 4);
    const folded = foldReplay(writes, allOk(writes));

    expect(folded.writes).toEqual([]);
    expect(folded.replayed).toBe(4);
    expect(folded.failed).toBe(0);
    expect(folded.stoppedAtId).toBeNull();
    expect(folded.counts).toEqual({ pending: 0, failed: 0, total: 0 });
  });

  it('decreases the pending count monotonically, one acknowledgement at a time', () => {
    let held = queueOf(1, 2, 3, 4, 5);
    let previous = deriveCounts(held).pending;
    expect(previous).toBe(5);

    /* Acknowledge the head only, one pass at a time — the shape of a real drain. */
    while (held.length > 0) {
      const head = planReplay(held)[0]!;
      const folded = foldReplay(held, [{ id: head, ok: true }]);

      expect(folded.counts.pending).toBeLessThan(previous);
      expect(folded.counts.pending).toBe(previous - 1);
      expect(folded.writes.some((w) => w.id === head)).toBe(false);

      previous = folded.counts.pending;
      held = folded.writes;
    }

    expect(previous).toBe(0);
  });
});

describe('foldReplay — failure at position k', () => {
  const ids = [10, 20, 30, 40, 50];

  it('retains k as failed with attempts incremented and the error recorded', () => {
    const writes = queueOf(...ids);
    const folded = foldReplay(writes, [
      { id: 10, ok: true },
      { id: 20, ok: true },
      { id: 30, ok: false, error: 'network-timeout' },
      { id: 40, ok: true },
      { id: 50, ok: true },
    ]);

    const blocked = folded.writes.find((w) => w.id === 30);
    expect(blocked).toBeDefined();
    expect(blocked!.status).toBe('failed');
    expect(blocked!.attempts).toBe(1);
    expect(blocked!.lastError).toBe('network-timeout');
  });

  it('leaves every write after k pending', () => {
    const writes = queueOf(...ids);
    const folded = foldReplay(writes, [
      { id: 10, ok: true },
      { id: 20, ok: true },
      { id: 30, ok: false, error: 'network-timeout' },
      { id: 40, ok: true },
      { id: 50, ok: true },
    ]);

    for (const id of [40, 50]) {
      const later = folded.writes.find((w) => w.id === id);
      expect(later).toBeDefined();
      expect(later!.status).toBe('pending');
      expect(later!.attempts).toBe(0);
      expect(later!.lastError).toBeNull();
    }
  });

  it('accumulates attempts across repeated passes over the same head', () => {
    let held = queueOf(...ids);

    for (let pass = 1; pass <= 3; pass += 1) {
      held = foldReplay(held, [{ id: 10, ok: false, error: `pass-${pass}` }]).writes;
      const head = held.find((w) => w.id === 10)!;
      expect(head.attempts).toBe(pass);
      expect(head.lastError).toBe(`pass-${pass}`);
    }
  });

  it('records a default error when the verdict carries none', () => {
    const folded = foldReplay(queueOf(1), [{ id: 1, ok: false }]);
    expect(folded.writes[0]!.lastError).toBe('replay-failed');
  });
});

describe('foldReplay — head-of-line blocking', () => {
  it('stops the run at the first failure', () => {
    const writes = queueOf(1, 2, 3, 4);
    const folded = foldReplay(writes, [
      { id: 1, ok: true },
      { id: 2, ok: false, error: 'boom' },
      /* These verdicts are IGNORED: nothing after the failure is attempted, so a
         reported success for id 3 is not evidence the write was applied. */
      { id: 3, ok: true },
      { id: 4, ok: true },
    ]);

    expect(folded.stoppedAtId).toBe(2);
    expect(folded.replayed).toBe(1);
    expect(folded.failed).toBe(1);
    expect(planReplay(folded.writes)).toEqual([2, 3, 4]);
    expect(folded.counts).toEqual({ pending: 2, failed: 1, total: 3 });
  });

  it('blocks on the LOWEST failing id regardless of verdict ordering', () => {
    const writes = queueOf(1, 2, 3, 4);
    const folded = foldReplay(writes, [
      { id: 4, ok: false, error: 'late' },
      { id: 3, ok: false, error: 'middle' },
      { id: 1, ok: true },
      { id: 2, ok: false, error: 'early' },
    ]);

    expect(folded.stoppedAtId).toBe(2);
    expect(folded.writes.find((w) => w.id === 2)!.lastError).toBe('early');
    /* 3 and 4 were never reached, so their verdicts left no trace. */
    expect(folded.writes.find((w) => w.id === 3)!.status).toBe('pending');
    expect(folded.writes.find((w) => w.id === 4)!.status).toBe('pending');
  });

  it('never loses a write: removed plus retained always equals the input', () => {
    const ids = [2, 4, 6, 8, 10, 12];

    for (let k = 0; k < ids.length; k += 1) {
      const writes = queueOf(...ids);
      const outcomes: ReplayVerdict[] = ids.map((id, i) => ({
        id,
        ok: i !== k,
        ...(i === k ? { error: 'boom' } : {}),
      }));

      const folded = foldReplay(writes, outcomes);
      expect(folded.replayed + folded.writes.length).toBe(ids.length);
      expect(folded.stoppedAtId).toBe(ids[k]);
      expect(folded.replayed).toBe(k);
    }
  });

  it('holds the whole queue when the very first write fails', () => {
    const writes = queueOf(1, 2, 3);
    const folded = foldReplay(writes, [
      { id: 1, ok: false, error: 'boom' },
      { id: 2, ok: true },
      { id: 3, ok: true },
    ]);

    expect(folded.replayed).toBe(0);
    expect(planReplay(folded.writes)).toEqual([1, 2, 3]);
    expect(folded.counts).toEqual({ pending: 2, failed: 1, total: 3 });
  });
});

describe('foldReplay — partial and empty verdict sets', () => {
  it('retains an unattempted write untouched', () => {
    const writes = queueOf(1, 2, 3);
    const folded = foldReplay(writes, [{ id: 1, ok: true }]);

    expect(folded.replayed).toBe(1);
    expect(folded.failed).toBe(0);
    expect(folded.stoppedAtId).toBeNull();
    expect(planReplay(folded.writes)).toEqual([2, 3]);
    expect(folded.counts).toEqual({ pending: 2, failed: 0, total: 2 });
  });

  it('is a no-op with no verdicts at all', () => {
    const writes = queueOf(1, 2, 3);
    const folded = foldReplay(writes, []);

    expect(folded.replayed).toBe(0);
    expect(folded.counts).toEqual(deriveCounts(writes));
    expect(planReplay(folded.writes)).toEqual([1, 2, 3]);
  });

  it('does not mutate the input writes', () => {
    const writes = queueOf(1, 2);
    foldReplay(writes, [{ id: 1, ok: false, error: 'boom' }]);

    expect(writes[0]!.status).toBe('pending');
    expect(writes[0]!.attempts).toBe(0);
    expect(writes[0]!.lastError).toBeNull();
  });

  it('is order-independent over shuffled input for the same verdicts', () => {
    const ids = [3, 1, 4, 1_5, 9, 2, 6];
    const outcomes: ReplayVerdict[] = ids.map((id) => ({ id, ok: id !== 9 }));
    const canonical = foldReplay(queueOf(...ids), outcomes);

    for (let seed = 1; seed <= 15; seed += 1) {
      const folded = foldReplay(shuffled(queueOf(...ids), seed), outcomes);
      expect(planReplay(folded.writes)).toEqual(planReplay(canonical.writes));
      expect(folded.stoppedAtId).toBe(canonical.stoppedAtId);
      expect(folded.counts).toEqual(canonical.counts);
    }
  });
});
