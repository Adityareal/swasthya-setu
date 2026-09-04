'use client';

/**
 * The demo's offline switch.
 *
 * `navigator.onLine` is read-only and cannot be forced from script, and airplane
 * mode mid-demo is unreliable — it kills the projector's wifi, it takes two
 * taps in a system UI nobody wants on screen, and on some Android builds the
 * `offline` event never fires. So effective connectivity is:
 *
 *     navigator.onLine && !simulatedOffline
 *
 * Every consumer reads `isEffectivelyOnline()`. Nothing in the product reads
 * `navigator.onLine` directly, which is the point: one definition of "offline",
 * and the presenter can produce it on demand.
 *
 * The flag persists to `sessionStorage`, NOT `localStorage`. A simulated outage
 * that survived a browser restart would greet the next rehearsal as a mystery
 * bug, and the first thing anyone would do is reset the demo data — which would
 * not fix it. Session scope makes the blast radius exactly one tab.
 */

const KEY = 'swasthya-setu:offline-sim:v1';

type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();

/** Read once at module load, then held in memory. */
let simulatedOffline = readPersisted();

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function readPersisted(): boolean {
  if (!hasWindow()) return false;
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    /* Private mode can throw on access, not just on write. Default to online:
       a demo control that fails closed would look like a broken product. */
    return false;
  }
}

function persist(next: boolean): void {
  if (!hasWindow()) return;
  try {
    if (next) window.sessionStorage.setItem(KEY, '1');
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* Non-fatal: the in-memory flag still drives this tab. */
  }
}

/** Whether the presenter has simulated an outage. */
export function isSimulatedOffline(): boolean {
  return simulatedOffline;
}

/**
 * The ONE connectivity predicate. Browser state AND the simulated flag, so a
 * genuinely offline device cannot be talked back online by flipping the switch.
 */
export function isEffectivelyOnline(): boolean {
  if (!hasWindow()) return true;
  return window.navigator.onLine && !simulatedOffline;
}

/** Flips the simulated flag and notifies subscribers. No-op when unchanged. */
export function setSimulatedOffline(next: boolean): void {
  if (next === simulatedOffline) return;
  simulatedOffline = next;
  persist(next);
  emit();
}

export function toggleSimulatedOffline(): boolean {
  setSimulatedOffline(!simulatedOffline);
  return simulatedOffline;
}

function emit(): void {
  const online = isEffectivelyOnline();
  for (const listener of listeners) listener(online);
}

/**
 * Subscribes to EFFECTIVE connectivity: the simulated flag and the browser's own
 * `online`/`offline` events arrive through the same callback, so no consumer has
 * to remember to listen to both.
 *
 * Returns the unsubscribe function. The window listeners are attached per
 * subscriber rather than once at module scope, because module-scope listeners
 * outlive React's cleanup and leak across fast-refresh reloads.
 */
export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);

  if (!hasWindow()) {
    return () => {
      listeners.delete(listener);
    };
  }

  const onBrowserChange = () => listener(isEffectivelyOnline());
  window.addEventListener('online', onBrowserChange);
  window.addEventListener('offline', onBrowserChange);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('online', onBrowserChange);
    window.removeEventListener('offline', onBrowserChange);
  };
}

/** Test and devtools escape hatch. Not called by any screen. */
export function __resetSimulatedOffline(): void {
  simulatedOffline = false;
  persist(false);
  listeners.clear();
}
