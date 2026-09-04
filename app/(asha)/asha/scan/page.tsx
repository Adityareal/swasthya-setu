'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CameraOff, QrCode } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { normaliseScannedValue } from '@/lib/qr/encode';
import {
  INITIAL_SCAN_STATE,
  manualEntryIsOnlyPath,
  scanReducer,
} from '@/lib/qr/scan-reducer';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { QrScanner } from '@/components/qr/qr-scanner';
import { ManualQrEntry } from '@/components/qr/manual-qr-entry';

/**
 * Scan a patient's card (Req 18.2, 18.3, 18.5).
 *
 * This route is what makes `/asha/scan` in the nav a real destination — it has
 * been a dead link since the shell landed.
 *
 * THE STATE MACHINE IS NOT IN THIS FILE. `scanReducer` decides what the screen
 * says and whether the camera should be running; this file owns the two impure
 * things — a `MediaStream` and an async lookup — and nothing else. That split is
 * why Requirement 18.3's real content, *a miss keeps the scanner live*, is covered
 * by a plain Vitest test with no camera and no DOM.
 *
 * ONE RESOLUTION PATH, TWO WAYS IN. A decoded frame and a typed card number both
 * dispatch `submit`, and `resolve` below is the only place `findPatientByQrId` is
 * called. A camera that resolved differently from a keyboard would be a bug that
 * only appears in the field, on the one device without a working camera.
 *
 * THE MANUAL FIELD IS ALWAYS RENDERED. `getUserMedia` needs a secure context, a
 * permission, and hardware; Req 18.5 requires patient selection to stay
 * completable without any of the three. So the field is never conditional — it
 * only changes prominence, taking the wayfinding rail when no camera is running.
 *
 * THE CAMERA DOES NOT AUTOSTART. Landing on a screen that immediately raises a
 * permission dialog is how a user learns to press Deny reflexively, and on Android
 * a denied camera stays denied. The first press is the consent, and the button
 * says what it is about to do.
 */
export default function AshaScanPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const [state, dispatch] = useReducer(scanReducer, INITIAL_SCAN_STATE);

  /**
   * `html5-qrcode` decodes the SAME symbol on every frame, ten times a second,
   * and the scanner deliberately stays live after a miss (Req 18.3) — so the
   * camera keeps re-reading the card that just failed. The reducer refuses those
   * repeats, but the callback they arrive through is captured by the scanner's
   * effect and cannot see current state, so the same two rules are mirrored in
   * refs here: one lookup at a time, and never the value already decided.
   */
  const inFlightRef = useRef(false);
  const decidedRef = useRef<string | null>(null);

  /** The one lookup, for both input paths — camera and keyboard. */
  const resolve = useCallback(async (raw: string) => {
    const value = normaliseScannedValue(raw);
    if (value === '' || inFlightRef.current || decidedRef.current === value) return;

    inFlightRef.current = true;
    decidedRef.current = value;
    dispatch({ type: 'submit', value });

    try {
      const found = await repo.findPatientByQrId(value);
      if (found) dispatch({ type: 'resolved', patientId: found.id });
      else dispatch({ type: 'missed' });
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  /** Try again clears the latch, so the SAME card can be re-read after the user
   *  has moved it — which is the whole point of keeping the scanner live. */
  const retry = useCallback(() => {
    decidedRef.current = null;
    dispatch({ type: 'retry' });
  }, []);

  /* Req 18.2 — a match opens that patient's record. Navigation happens in an
     effect rather than inside `resolve`, so the reducer stays the single source of
     "we found someone" and a `found` state reached any other way still navigates. */
  useEffect(() => {
    if (state.phase === 'found' && state.patientId) {
      router.push(`/asha/patient?id=${encodeURIComponent(state.patientId)}`);
    }
  }, [router, state.phase, state.patientId]);

  const onDecode = useCallback((text: string) => void resolve(text), [resolve]);
  const onUnavailable = useCallback(() => dispatch({ type: 'cameraBlocked' }), []);

  const manualIsPrimary = manualEntryIsOnlyPath(state);

  return (
    <>
      <Plate state="action" className="p-4" as="section">
        <div className="flex items-start gap-3">
          <QrCode aria-hidden="true" className="mt-1 size-6 shrink-0 text-action" />
          <div className="min-w-0">
            <h1>
              <BiLabel
                k="qr.scan"
                className="text-headline leading-tight font-extrabold text-ink"
              />
            </h1>
            <p
              lang={locale}
              className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted"
            >
              {state.cameraBlocked ? t('qr.unsupported') : t('qr.scanning')}
            </p>
          </div>
        </div>
      </Plate>

      {/* ——— The viewfinder. Mounted only while `scannerActive`, which a miss
              leaves TRUE (Req 18.3) — the message below appears and the stream
              never blinks. ——— */}
      {state.scannerActive && (
        <Plate className="overflow-hidden p-2" as="section">
          <QrScanner
            active={state.scannerActive}
            onDecode={onDecode}
            onUnavailable={onUnavailable}
            className="mx-auto min-h-[260px] w-full max-w-[320px] [&_video]:block [&_video]:h-auto [&_video]:w-full"
          />
        </Plate>
      )}

      {/* ——— The camera control. 56px: a one-handed field action. ——— */}
      {!state.cameraBlocked && (
        <Button
          type="button"
          variant={state.scannerActive ? 'outline' : 'default'}
          size="field"
          onClick={() =>
            dispatch({ type: state.scannerActive ? 'cameraStopped' : 'cameraStarted' })
          }
        >
          {state.scannerActive ? (
            <CameraOff aria-hidden="true" />
          ) : (
            <Camera aria-hidden="true" />
          )}
          <BiLabel
            k={state.scannerActive ? 'common.close' : 'qr.scan'}
            secondaryClassName={
              state.scannerActive ? undefined : 'text-action-fg/75'
            }
          />
        </Button>
      )}

      {/* ——— Req 18.3 — the miss. The value that missed is echoed, because
              "no patient matches that card" is only actionable if you can see
              WHICH card was read. ——— */}
      {state.phase === 'not-found' && (
        <section role="alert" className="plate p-4" data-state="error">
          <BiLabel k="qr.notFound" className="text-title font-semibold text-ink" />
          {state.lastValue && (
            <p className="tabular mt-1 text-caption font-semibold break-all text-ink-muted">
              {state.lastValue}
            </p>
          )}
          <Button type="button" variant="outline" className="mt-3" onClick={retry}>
            <BiLabel k="common.retry" />
          </Button>
        </section>
      )}

      {/* ——— Always present, never conditional (Req 18.5). ——— */}
      <ManualQrEntry
        onSubmit={(value) => void resolve(value)}
        busy={state.resolving}
        primary={manualIsPrimary}
      />
    </>
  );
}
