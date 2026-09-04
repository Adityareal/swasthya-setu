'use client';

import { useEffect, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';

/**
 * QR_Module — the camera (Req 18.2, 18.3).
 *
 * MOUNTED ONLY HERE, TORN DOWN ON UNMOUNT. `html5-qrcode` holds a live
 * `MediaStream`; a component that starts one and does not stop it leaves the
 * camera indicator lit on a health worker's phone after she has navigated away,
 * which is both a battery problem and, far worse, a trust problem for an app that
 * asks people to hand over their symptoms. The cleanup below is the point of this
 * file, and it awaits the startup promise before stopping so a fast
 * mount-unmount — React's development double-invoke, or a quick back gesture —
 * cannot stop a stream that has not finished opening and leave the real one
 * running.
 *
 * THE LIBRARY IS LOADED DYNAMICALLY. It reaches for `document` and `navigator` at
 * module scope. With `output: 'export'` this page is prerendered in Node, so a
 * static import would break the build; the dynamic import inside the effect also
 * keeps a decoder that most sessions never open out of every other route's
 * bundle.
 *
 * THE DECODE FAILURE CALLBACK IS A NO-OP ON PURPOSE. `html5-qrcode` invokes it
 * for every frame that does not contain a symbol — tens of times a second while
 * the user is still lining the card up. Surfacing that as an error would turn a
 * working viewfinder into a flickering wall of failures. The real signals are a
 * successful decode and a failure to START, and those are the only two this
 * component reports.
 */

/**
 * A constant element id, not `useId()`.
 *
 * `Html5Qrcode`'s constructor takes an id STRING and resolves it itself, and this
 * scanner is mounted at exactly one place in the product — one route, one
 * instance, guaranteed by the route tree rather than by convention. A generated id
 * would buy reusability this component does not have and would hand the library a
 * string containing React's own delimiter characters.
 */
const HOST_ID = 'ss-qr-scanner-host';

export function QrScanner({
  active,
  onDecode,
  onUnavailable,
  className,
}: {
  /** Driven by `scanReducer`'s `scannerActive`. A miss leaves it `true`. */
  active: boolean;
  onDecode: (value: string) => void;
  /** The camera could not be started: denied, absent, or an insecure context. */
  onUnavailable: () => void;
  className?: string;
}) {
  /* Both callbacks are read through refs so the effect depends on `active`
     alone. Depending on the callbacks would restart the camera on every parent
     render, which is the same permission-churn bug the recognition hook avoids by
     refusing to auto-restart. */
  const onDecodeRef = useRef(onDecode);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let engine: Html5Qrcode | null = null;

    const startup = (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        engine = new Html5Qrcode(HOST_ID, { verbose: false });
        await engine.start(
          /* The rear camera by preference. A `facingMode` constraint rather than
             a device id, because enumerating cameras needs permission we have not
             been granted yet and the ASHA is pointing the phone away from herself
             either way. */
          { facingMode: 'environment' },
          {
            /* 10fps decodes fast enough to feel instant and leaves the CPU alone
               on a low-end handset. */
            fps: 10,
            /* A square reticle sized for a card held at arm's length. Fits inside
               the 360px design width with room for the frame. */
            qrbox: { width: 240, height: 240 },
          },
          (text) => onDecodeRef.current(text),
          () => {
            /* Per-frame no-match. Not an error. See the header note. */
          },
        );
      } catch {
        /* Denied, no camera, or an insecure context. One report, and the screen
           switches the manual field from fallback to primary path. */
        if (!cancelled) onUnavailableRef.current();
      }
    })();

    return () => {
      cancelled = true;
      /* Await startup first: stopping an engine mid-`start()` throws and leaves
         the stream open, which is exactly the leak this cleanup exists to
         prevent. */
      void startup.then(async () => {
        if (!engine) return;
        try {
          await engine.stop();
        } catch {
          /* Already stopped, or never fully started. */
        }
        try {
          engine.clear();
        } catch {
          /* The host node may already be detached. */
        }
        engine = null;
      });
    };
  }, [active]);

  return (
    <div
      id={HOST_ID}
      /* The library injects a `<video>` and its own overlay canvas here and sizes
         them itself, so this element only supplies the plate and a floor height —
         without one the viewfinder pops the layout open when the stream arrives. */
      className={className}
    />
  );
}
