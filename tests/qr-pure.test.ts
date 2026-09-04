import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/lib/data/seed';
import {
  isOpaquePayload,
  looksLikeUrl,
  normaliseScannedValue,
  qrPayload,
} from '@/lib/qr/encode';
import {
  INITIAL_SCAN_STATE,
  keepsScannerAvailable,
  manualEntryIsOnlyPath,
  scanReducer,
  type ScanState,
} from '@/lib/qr/scan-reducer';

/**
 * Validates: Requirements 18.1, 18.3, 18.4
 *
 * Two negative constraints, which are the ones worth testing because nothing else
 * in the system will notice when they break.
 *
 *   THE PAYLOAD IS NOT A URL. Requirement 18.4 forbids a public unauthenticated
 *   route that discloses a record. The structural half of that guarantee is that a
 *   printed card carries an opaque string, so a generic phone camera pointed at it
 *   finds nothing to navigate to. "Make the QR open the patient page" is a
 *   plausible, well-meaning future change that would silently undo it — hence a
 *   test rather than a comment.
 *
 *   A MISS KEEPS THE SCANNER LIVE. Requirement 18.3 says an unmatched value shows
 *   a message and keeps the scanner available. The intuitive implementation tears
 *   the camera down on failure, which costs a permission round-trip and a second of
 *   black viewfinder on every crease and every shadow — precisely the conditions
 *   this requirement was written for.
 */

/* ——————————————————————— the payload is the bare id ——————————————————————— */

/** The seeded ids, so the assertions run against the values the demo scans. */
const SEEDED_IDS = buildSeed().patients.map((p) => p.qrId);

describe('qrPayload is byte-equal to the qrId', () => {
  it('returns every seeded id unchanged', () => {
    expect(SEEDED_IDS.length).toBeGreaterThan(0);
    for (const id of SEEDED_IDS) {
      const payload = qrPayload(id);
      expect(payload).toBe(id);
      /* Byte-for-byte, not merely equal after normalisation: `findPatientByQrId`
         is handed a scan result directly, and length equality catches an
         invisible character a `===` on trimmed strings would not. */
      expect(payload.length).toBe(id.length);
      expect([...payload]).toEqual([...id]);
    }
  });

  it('trims surrounding whitespace and changes nothing else', () => {
    expect(qrPayload('  SS-WRD-KAMLA-7F3A  ')).toBe('SS-WRD-KAMLA-7F3A');
    /* No case folding, no prefix, no encoding. */
    expect(qrPayload('ss-wrd-kamla-7f3a')).toBe('ss-wrd-kamla-7f3a');
  });
});

describe('the payload matches no URL pattern', () => {
  it('has no scheme, no host and no path separator for any seeded id', () => {
    for (const id of SEEDED_IDS) {
      const payload = qrPayload(id);
      expect(looksLikeUrl(payload)).toBe(false);
      expect(isOpaquePayload(payload)).toBe(true);

      /* Stated directly as well, so the guarantee does not rest on one regex
         being right. */
      expect(payload).not.toContain(':');
      expect(payload).not.toContain('/');
      expect(payload).not.toContain('\\');
      expect(payload.startsWith('www.')).toBe(false);

      /* And the strongest form: it is not parseable as an absolute URL at all,
         so there is nothing for a camera app to offer to open. */
      expect(URL.canParse(payload)).toBe(false);
    }
  });

  it('rejects every URL shape a future convenience change might introduce', () => {
    const urls = [
      'https://swasthya.example/p/SS-WRD-KAMLA-7F3A',
      'http://localhost:3000/asha/patient?id=abc',
      '//swasthya.example/p/abc',
      'www.swasthya.example/p/abc',
      'swasthyasetu://patient/SS-WRD-KAMLA-7F3A',
      'mailto:someone@example.com',
      '/asha/patient?id=abc',
      'p/SS-WRD-KAMLA-7F3A',
    ];
    for (const url of urls) {
      expect(looksLikeUrl(url)).toBe(true);
      expect(isOpaquePayload(url)).toBe(false);
    }
  });

  it('rejects an empty or whitespace-bearing payload', () => {
    for (const bad of ['', '   ', 'SS WRD KAMLA', 'SS-WRD\nKAMLA', '<script>']) {
      expect(isOpaquePayload(bad)).toBe(false);
    }
  });
});

describe('normaliseScannedValue', () => {
  it('strips what a keyboard and a camera add, and nothing more', () => {
    expect(normaliseScannedValue('  SS-WRD-KAMLA-7F3A \n')).toBe('SS-WRD-KAMLA-7F3A');
    /* Zero-width characters some Android keyboards paste in. */
    expect(normaliseScannedValue('SS-WRD\u200B-KAMLA-7F3A')).toBe(
      'SS-WRD-KAMLA-7F3A',
    );
    /* Case is preserved so the value can be echoed back exactly as read; the
       repo lookup is the layer that folds case. */
    expect(normaliseScannedValue('ss-wrd-kamla-7f3a')).toBe('ss-wrd-kamla-7f3a');
  });
});

/* ——————————————————————————— the scan reducer ——————————————————————————— */

const scanning = (): ScanState =>
  scanReducer(INITIAL_SCAN_STATE, { type: 'cameraStarted' });

describe('scanReducer transitions', () => {
  it('starts idle with no camera and nothing decided', () => {
    expect(INITIAL_SCAN_STATE.phase).toBe('idle');
    expect(INITIAL_SCAN_STATE.scannerActive).toBe(false);
    expect(INITIAL_SCAN_STATE.resolving).toBe(false);
  });

  it('goes idle → scanning when the camera comes up', () => {
    const state = scanning();
    expect(state.phase).toBe('scanning');
    expect(state.scannerActive).toBe(true);
  });

  it('goes scanning → found and stops the camera', () => {
    const submitted = scanReducer(scanning(), {
      type: 'submit',
      value: 'SS-WRD-KAMLA-7F3A',
    });
    const found = scanReducer(submitted, { type: 'resolved', patientId: 'p-kamla' });
    expect(found.phase).toBe('found');
    expect(found.patientId).toBe('p-kamla');
    /* The screen is navigating to a record; a stream that outlives its screen is
       the worst bug this module could ship. */
    expect(found.scannerActive).toBe(false);
  });

  it('ignores a decode that arrives while a lookup is open', () => {
    const busy = scanReducer(scanning(), { type: 'submit', value: 'FIRST' });
    const again = scanReducer(busy, { type: 'submit', value: 'SECOND' });
    expect(again).toBe(busy);
    expect(again.lastValue).toBe('FIRST');
  });

  it('ignores an empty manual submit', () => {
    const state = scanning();
    expect(scanReducer(state, { type: 'submit', value: '   ' })).toBe(state);
  });

  it('treats a blocked camera as a capability reading, not an error phase', () => {
    const blocked = scanReducer(scanning(), { type: 'cameraBlocked' });
    expect(blocked.cameraBlocked).toBe(true);
    expect(blocked.scannerActive).toBe(false);
    expect(blocked.phase).toBe('idle');
    /* Req 18.5 — with no camera, the typed field is the guaranteed path. */
    expect(manualEntryIsOnlyPath(blocked)).toBe(true);
  });

  it('resolves a manual submit with no camera ever started', () => {
    const submitted = scanReducer(INITIAL_SCAN_STATE, {
      type: 'submit',
      value: 'SS-WRD-KAMLA-7F3A',
    });
    /* 'idle' rather than 'scanning': there is no camera, and claiming otherwise
       would be a lie in the state name. */
    expect(submitted.phase).toBe('idle');
    expect(submitted.resolving).toBe(true);
    const found = scanReducer(submitted, { type: 'resolved', patientId: 'p-kamla' });
    expect(found.phase).toBe('found');
    expect(found.patientId).toBe('p-kamla');
  });
});

describe('a miss keeps scanning active (Req 18.3)', () => {
  it('shows not-found and leaves the camera running', () => {
    const submitted = scanReducer(scanning(), { type: 'submit', value: 'SS-NOPE' });
    const missed = scanReducer(submitted, { type: 'missed' });

    expect(missed.phase).toBe('not-found');
    /* The requirement, directly. */
    expect(missed.scannerActive).toBe(true);
    expect(missed.resolving).toBe(false);
    /* The value that missed is retained so the message can name it. */
    expect(missed.lastValue).toBe('SS-NOPE');
    /* And through the predicate the product uses: availability is unchanged by
       a miss. */
    expect(keepsScannerAvailable(submitted, missed)).toBe(true);
  });

  it('survives a run of consecutive misses without ever stopping', () => {
    /* A creased card in bad light misses repeatedly. If any miss cost a camera
       restart, this is the loop where the user gives up and types. */
    let state = scanning();
    for (const value of ['A', 'B', 'C', 'D', 'E']) {
      const before = state;
      state = scanReducer(state, { type: 'submit', value });
      state = scanReducer(state, { type: 'missed' });
      expect(state.phase).toBe('not-found');
      expect(state.scannerActive).toBe(true);
      expect(keepsScannerAvailable(before, state)).toBe(true);
    }
  });

  it('refuses the same value again until retry clears it', () => {
    /* The camera re-decodes the failed card ten times a second, so an unguarded
       reducer would rebuild the not-found plate continuously. */
    const missed = scanReducer(
      scanReducer(scanning(), { type: 'submit', value: 'SS-NOPE' }),
      { type: 'missed' },
    );
    expect(scanReducer(missed, { type: 'submit', value: 'SS-NOPE' })).toBe(missed);

    /* A DIFFERENT card resolves immediately — the guard is about the value, not
       about being in a failed state. */
    const other = scanReducer(missed, { type: 'submit', value: 'SS-OTHER' });
    expect(other.resolving).toBe(true);
    expect(other.lastValue).toBe('SS-OTHER');
  });

  it('returns to scanning on retry with the camera still up', () => {
    const missed = scanReducer(
      scanReducer(scanning(), { type: 'submit', value: 'SS-NOPE' }),
      { type: 'missed' },
    );
    const retried = scanReducer(missed, { type: 'retry' });
    expect(retried.phase).toBe('scanning');
    expect(retried.scannerActive).toBe(true);
    expect(retried.lastValue).toBeNull();
    /* And the same card can now be read again. */
    expect(scanReducer(retried, { type: 'submit', value: 'SS-NOPE' }).resolving).toBe(
      true,
    );
  });

  it('keeps a not-found message on screen when the user closes the camera', () => {
    const missed = scanReducer(
      scanReducer(scanning(), { type: 'submit', value: 'SS-NOPE' }),
      { type: 'missed' },
    );
    const stopped = scanReducer(missed, { type: 'cameraStopped' });
    expect(stopped.scannerActive).toBe(false);
    /* A message that vanished because the camera closed would leave the user
       unsure whether the scan had worked. */
    expect(stopped.phase).toBe('not-found');
    expect(manualEntryIsOnlyPath(stopped)).toBe(true);
  });
});
