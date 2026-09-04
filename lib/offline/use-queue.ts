'use client';

import { useCallback, useEffect, useState } from 'react';
import type { QueuedWrite } from '@/lib/types';
import type { QueueCounts } from '@/lib/data/repo';
import { useAppStore } from '@/lib/store';
import { deriveCounts } from './queue-plan';
import {
  installReplayTriggers,
  isReplayInFlight,
  readQueue,
  runReplay,
  subscribeQueue,
} from './replay';
import {
  isEffectivelyOnline,
  isSimulatedOffline,
  setSimulatedOffline,
  subscribeConnectivity,
} from './simulate';

const EMPTY_COUNTS: QueueCounts = { pending: 0, failed: 0, total: 0 };

/**
 * Effective connectivity as React state, mirrored into the store so any screen
 * that already reads `useAppStore(s => s.online)` stays correct without knowing
 * this module exists.
 *
 * Starts `true` on purpose. The server renders with no `navigator`, so an initial
 * `false` would hydrate a hazard-striped banner over a page that is perfectly
 * online and then flip it — a flash of false alarm on every cold load. The effect
 * corrects it on the first client tick.
 */
export function useConnectivity(): {
  online: boolean;
  simulated: boolean;
  setSimulated: (next: boolean) => void;
} {
  const [online, setOnlineLocal] = useState(true);
  const [simulated, setSimulatedLocal] = useState(false);
  const setStoreOnline = useAppStore((s) => s.setOnline);

  useEffect(() => {
    const sync = () => {
      const next = isEffectivelyOnline();
      setOnlineLocal(next);
      setSimulatedLocal(isSimulatedOffline());
      setStoreOnline(next);
    };
    sync();
    return subscribeConnectivity(sync);
  }, [setStoreOnline]);

  const setSimulated = useCallback((next: boolean) => {
    setSimulatedOffline(next);
  }, []);

  return { online, simulated, setSimulated };
}

/**
 * Attaches the replay triggers for the lifetime of the tree. Called ONCE, by
 * `AppShell`.
 *
 * Deliberately not folded into `useQueue`: the banner and the pending badge both
 * read the queue, and if reading it also installed triggers there would be two
 * sets of window listeners and two mount-time replay attempts. The in-flight flag
 * would keep that correct, but "correct because a guard catches it" is a worse
 * arrangement than not doing it twice.
 */
export function useReplayTriggers(): void {
  /* No callback needed: `runReplay` already announces the queue change on both
     edges of the pass, so subscribers see "Syncing…" and then the settled counts
     without this hook forwarding anything. */
  useEffect(() => installReplayTriggers(), []);
}

/**
 * The queue as React state: the held writes, the DERIVED counts, whether a pass
 * is running, and a manual retry.
 *
 * Subscribes to queue-change events rather than polling. `pendingCount` in the
 * store is written from `deriveCounts`, never incremented, so the badge cannot
 * drift away from the queue it describes.
 */
export function useQueue(): {
  writes: QueuedWrite[];
  counts: QueueCounts;
  syncing: boolean;
  retry: () => void;
} {
  const [writes, setWrites] = useState<QueuedWrite[]>([]);
  const [counts, setCounts] = useState<QueueCounts>(EMPTY_COUNTS);
  const [syncing, setSyncing] = useState(false);
  const setPendingCount = useAppStore((s) => s.setPendingCount);

  const refresh = useCallback(async () => {
    const held = await readQueue();
    const next = deriveCounts(held);
    setWrites(held);
    setCounts(next);
    setSyncing(isReplayInFlight());
    setPendingCount(next.pending);
  }, [setPendingCount]);

  useEffect(() => {
    void refresh();
    return subscribeQueue(() => void refresh());
  }, [refresh]);

  const retry = useCallback(() => {
    void runReplay();
  }, []);

  return { writes, counts, syncing, retry };
}
