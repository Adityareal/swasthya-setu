/**
 * QR_Module — the scanner's state machine (Req 18.2, 18.3).
 *
 * PURE. No camera, no `html5-qrcode`, no repo, no clock. The component owns a
 * camera and an async lookup; this owns the question "given what has happened,
 * should the camera be running and what should the screen say" — which is the
 * part that has a wrong answer, and therefore the part worth testing.
 *
 * THE ONE INVARIANT: A MISS DOES NOT STOP THE SCANNER.
 *
 * Requirement 18.3 says an unmatched value SHALL show a not-found message and
 * SHALL keep the scanner available for a retry. The natural implementation —
 * treat "no patient" as an error, tear the camera down, show a plate with a
 * button that starts it again — fails that requirement in the exact situation it
 * was written for. An ASHA scanning a creased card in bad light misses on the
 * first pass routinely. If each miss costs a camera restart, it also costs a
 * permission check, a stream negotiation and roughly a second of black
 * viewfinder, and the third miss is where she gives up and types. So `missed`
 * carries `scannerActive` through untouched: the message appears, the viewfinder
 * never blinks, and she moves the card an inch and it works.
 *
 * `found` is the one outcome that DOES stop the camera, because the screen is
 * about to navigate to a record and a camera that outlives its screen is the
 * worst bug this module could ship.
 *
 * Two fields rather than one enum, deliberately. `phase` is what the user is
 * told; `scannerActive` is whether hardware is running. Collapsing them into one
 * value is what makes "not found" and "stopped" the same state, which is the bug
 * this file exists to make impossible.
 */

export type ScanPhase =
  /** Nothing running and nothing decided — the camera is off. */
  | 'idle'
  /** The camera is live and nothing has been decided yet. */
  | 'scanning'
  /** A `qrId` resolved to a patient (Req 18.2). */
  | 'found'
  /** A value resolved to nothing (Req 18.3). The scanner stays live. */
  | 'not-found';

export interface ScanState {
  phase: ScanPhase;
  /** Whether the camera should be mounted and decoding. */
  scannerActive: boolean;
  /** The last value submitted for resolution, from the camera or the keyboard.
   *  Shown back in the not-found message so the user can see WHAT missed. */
  lastValue: string | null;
  /** Set on `found`, so the caller knows where to navigate. */
  patientId: string | null;
  /** The camera cannot be used at all — denied, absent, or an insecure context.
   *  Manual entry is then the only path, and it must be visible. */
  cameraBlocked: boolean;
  /** A lookup is in flight. `html5-qrcode` re-decodes the same symbol on every
   *  frame, so without this a single card fires a dozen lookups a second. */
  resolving: boolean;
}

export type ScanEvent =
  /** The camera came up. */
  | { type: 'cameraStarted' }
  /** The user stopped the camera, or the screen is leaving. */
  | { type: 'cameraStopped' }
  /** `getUserMedia` failed, was denied, or there is no camera. */
  | { type: 'cameraBlocked' }
  /** A value to resolve — from a decoded frame OR from the manual field. One
   *  event for both, because they must not be able to resolve differently. */
  | { type: 'submit'; value: string }
  | { type: 'resolved'; patientId: string }
  | { type: 'missed' }
  /** Clear a not-found and go back to looking. */
  | { type: 'retry' };

export const INITIAL_SCAN_STATE: ScanState = {
  phase: 'idle',
  scannerActive: false,
  lastValue: null,
  patientId: null,
  cameraBlocked: false,
  resolving: false,
};

/** The phase that means "nothing decided", given whether the camera is up. */
function waitingPhase(scannerActive: boolean): ScanPhase {
  return scannerActive ? 'scanning' : 'idle';
}

export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case 'cameraStarted':
      return {
        ...state,
        phase: 'scanning',
        scannerActive: true,
        cameraBlocked: false,
      };

    case 'cameraStopped':
      /* A deliberate stop. The outcome already on screen is kept — a not-found
         message that vanished because the user closed the camera would leave
         them wondering whether the scan had worked. */
      return {
        ...state,
        scannerActive: false,
        phase: state.phase === 'scanning' ? 'idle' : state.phase,
        resolving: false,
      };

    case 'cameraBlocked':
      /* Not an error state. It is a capability reading whose consequence is that
         manual entry becomes the primary control rather than the fallback. */
      return {
        ...state,
        phase: state.phase === 'scanning' ? 'idle' : state.phase,
        scannerActive: false,
        cameraBlocked: true,
        resolving: false,
      };

    case 'submit': {
      const value = event.value.trim();
      /* An empty manual submit is not an event. Neither is a decode that arrives
         while the previous lookup is still open. */
      if (value === '' || state.resolving) return state;
      /* Nor is the SAME value that just missed. The scanner stays live after a
         miss by design, which means the camera is still pointed at the card that
         failed and re-decodes it ten times a second. Without this, Req 18.3's
         "keep the scanner available" would produce a not-found plate rebuilding
         itself continuously and a lookup storm behind it. A different card
         resolves immediately; the same one waits for `retry`. */
      if (state.phase === 'not-found' && state.lastValue === value) return state;
      return {
        ...state,
        phase: waitingPhase(state.scannerActive),
        lastValue: value,
        patientId: null,
        resolving: true,
      };
    }

    case 'resolved':
      /* Req 18.2. The camera stops here and only here: the screen is navigating
         to a record, and the stream must not outlive it. */
      return {
        ...state,
        phase: 'found',
        scannerActive: false,
        patientId: event.patientId,
        resolving: false,
      };

    case 'missed':
      /* Req 18.3, and the invariant this file exists for: `scannerActive` is
         carried through UNCHANGED. If the camera was live it stays live, so the
         retry is "move the card", not "grant permission again". */
      return {
        ...state,
        phase: 'not-found',
        patientId: null,
        resolving: false,
      };

    case 'retry':
      return {
        ...state,
        phase: waitingPhase(state.scannerActive),
        lastValue: null,
        patientId: null,
        resolving: false,
      };
  }
}

/**
 * Req 18.3 as a predicate the test asserts directly: after a miss, the scanner is
 * exactly as available as it was before the miss.
 */
export function keepsScannerAvailable(before: ScanState, after: ScanState): boolean {
  return before.scannerActive === after.scannerActive;
}

/** Whether the manual field is the guaranteed path right now — no camera running
 *  and no camera coming. Drives its own prominence rather than its presence: the
 *  field is ALWAYS rendered, because a camera can fail at any moment. */
export function manualEntryIsOnlyPath(state: ScanState): boolean {
  return !state.scannerActive;
}
