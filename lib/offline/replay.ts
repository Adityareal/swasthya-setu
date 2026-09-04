'use client';

import type { QueuedWrite } from '@/lib/types';
import type { QueueCounts } from '@/lib/data/repo';
import { repo } from '@/lib/data/memory-repo';
import { isEffectivelyOnline, subscribeConnectivity } from './simulate';
import { deriveCounts, planReplay } from './queue-plan';

/**
 * The impure driver. `queue-plan.ts` decides, `repo` stores, this schedules.
 *
 * Three things here are the whole reason the file exists:
 *
 *  1. `replayInFlight` is MODULE scope, not component state. `online` fires on the
 *     window, `visibilitychange` fires on the document, and a Retry button fires
 *     from a click — three sources that routinely arrive within the same tick when
 *     a phone comes out of a pocket back in signal. Two overlapping runs would
 *     each read the same queue and apply every held write twice. A flag inside a
 *     React component would be per-mount, and the banner mounts in every
 *     workspace, so the guard has to outlive the tree.
 *
 *  2. Application is SEQUENTIAL. There is no `Promise.all` on this path and there
 *     must never be one: parallel replay IS the ordering bug. Writes for one
 *     patient are causally ordered, and `Promise.all` over four of them resolves
 *     in completion order, which is arrival order, which is nothing.
 *
 *  3. Triggers are EVENTS, not a poll. `window 'online'`, `visibilitychange`, and
 *     an explicit Retry. A `setInterval` would wake the radio on a phone that is
 *     deliberately conserving it and would still be late, because the interesting
 *     moment is exactly the moment connectivity returns and that moment already
 *     has an event.
 *
 * DELIBERATE REDUCTION — no service worker.
 *
 * There is none, and the omission is a choice rather than an oversight. Durability
 * is already handled: the memory adapter persists both the snapshot and the queue
 * to `localStorage`, so a captured visit survives a reload, a crash, and a closed
 * tab with the network still down. What a service worker would add on top is PWA
 * installability and offline COLD START — loading the app itself with no network —
 * and neither is what Requirement 19 asks for. Against that it brings a cache
 * that serves a stale build until it is convinced otherwise, a registration
 * lifecycle to debug, and a class of "why is my fix not showing up" failure that
 * is very bad to hit an hour before a demo. Requirement 19.6 also excludes offline
 * sign-in, merge-conflict resolution, and any sync management screen; none of
 * those are built either.
 */

export type ReplaySkipReason = 'in-flight' | 'offline' | 'empty';

export type ReplayRunResult =
  | { ran: false; reason: ReplaySkipReason; counts: QueueCounts }
  | {
      ran: true;
      /** How many ids the pass set out to apply, in ascending order. */
      attempted: number;
      replayed: number;
      failed: number;
      /** Head-of-line: non-null means a held write blocked the rest. */
      blockedAtId: number | null;
      counts: QueueCounts;
    };

/* ————————————————————————— Queue change events ————————————————————————— */

type QueueListener = () => void;
const queueListeners = new Set<QueueListener>();

/**
 * Called after anything changes the queue — an enqueue from the intake path, a
 * replay pass here. The banner and the badge subscribe rather than polling, so
 * the displayed count is never a stale render behind the queue.
 */
export function notifyQueueChanged(): void {
  for (const listener of queueListeners) listener();
}

export function subscribeQueue(listener: QueueListener): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

/* ——————————————————————————————— The run ——————————————————————————————— */

let replayInFlight = false;

/** Whether a pass is currently running, for the "Syncing…" caption. */
export function isReplayInFlight(): boolean {
  return replayInFlight;
}

export async function readQueue(): Promise<QueuedWrite[]> {
  return repo.listQueuedWrites();
}

/**
 * One replay pass.
 *
 * `repo.replayQueue()` is the single apply path in the product: it walks the
 * queue in submission order with an `await` per write, removes what the store
 * acknowledges, and retains what fails with its attempt count and error. This
 * driver deliberately does NOT re-implement that loop — the storage side is
 * already written and tested, and a second copy of the dispatch would be a second
 * place a new `QueuedWriteKind` has to be handled.
 *
 * What the driver adds on top is the scheduling contract: never concurrent, never
 * while offline, and no automatic follow-up pass while a failure is still held —
 * that last one is head-of-line blocking at the boundary this file controls. A
 * retained failure means the next pass starts from that same write again, because
 * `planReplay` sorts by id and the failed write still has the lowest one.
 *
 * Honest note on the shipped adapter: the in-process memory adapter attempts every
 * held write in one pass rather than stopping dead at the first failure. It cannot
 * fail transiently — there is no network in it — so the only way a write fails
 * there is an invalid payload, and the ascending-id ordering still holds. The
 * strict stop-at-first-failure rule is encoded and tested in
 * `queue-plan.foldReplay`, which is the contract a network-backed adapter
 * implements against.
 */
export async function runReplay(): Promise<ReplayRunResult> {
  if (replayInFlight) {
    return { ran: false, reason: 'in-flight', counts: deriveCounts(await readQueue()) };
  }

  const before = await readQueue();

  if (before.length === 0) {
    return { ran: false, reason: 'empty', counts: deriveCounts(before) };
  }

  if (!isEffectivelyOnline()) {
    return { ran: false, reason: 'offline', counts: deriveCounts(before) };
  }

  replayInFlight = true;
  notifyQueueChanged();

  try {
    /* The order the pass runs in: ascending ids, one at a time. Taken from
       `queue-plan` rather than assumed from the array, because the ordering rule
       is the tested contract and this file should not re-derive it. */
    const order = planReplay(before);

    const outcome = await repo.replayQueue();
    const after = await readQueue();
    const counts = deriveCounts(after);

    /* Head of the line: the lowest retained id that came back failed. */
    const blockedAtId = planReplay(after).find(
      (id) => after.find((w) => w.id === id)?.status === 'failed',
    );

    return {
      ran: true,
      attempted: order.length,
      replayed: outcome.replayed,
      failed: outcome.failed,
      blockedAtId: blockedAtId ?? null,
      counts,
    };
  } finally {
    replayInFlight = false;
    notifyQueueChanged();
  }
}

/* ———————————————————————————— Trigger wiring ———————————————————————————— */

/**
 * Attaches the three triggers and returns the detach function.
 *
 * `visibilitychange` earns its place separately from `online`: Android suspends
 * background tabs, so a phone that regained signal while the screen was off often
 * delivers no `online` event at all — the tab simply wakes up connected. Without
 * this listener the queue would sit full until the user found the Retry button.
 */
export function installReplayTriggers(
  onSettled?: (result: ReplayRunResult) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let detached = false;

  const attempt = () => {
    if (detached) return;
    if (!isEffectivelyOnline()) return;
    void runReplay().then((result) => {
      if (!detached) onSettled?.(result);
    });
  };

  const onConnectivity = (online: boolean) => {
    if (online) attempt();
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') attempt();
  };

  const unsubscribe = subscribeConnectivity(onConnectivity);
  document.addEventListener('visibilitychange', onVisibility);

  /* One pass on mount: the app may have loaded already-online with a queue left
     over from the previous session, and no event will announce that. */
  attempt();

  return () => {
    detached = true;
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
