/**
 * QR_Module — the payload, and why it is not a URL (Req 18.1, 18.4).
 *
 * THE ENCODED VALUE IS THE BARE `qrId` STRING. `SS-WRD-KAMLA-7F3A`. Not
 * `https://…/p/SS-WRD-KAMLA-7F3A`, not a deep link, not a signed token.
 *
 * That single choice is what turns Requirement 18.4's negative constraint —
 * *SHALL NOT ship a public unauthenticated QR landing route* — from a promise
 * about the route tree into a property of the artefact. A printed card is handled
 * by people who are not the patient: it sits in a bag, it gets photographed, it
 * gets left on a table. Any passer-by can point a generic phone camera at it, and
 * what that camera does with what it finds is entirely outside this codebase's
 * control. If the payload were a URL, the camera would offer to open it, and the
 * only thing standing between a stranger and a health record would be whatever
 * the server chose to check. Because the payload is an opaque string, the camera
 * has nothing to offer: no scheme to launch, no host to resolve, no path to
 * fetch. There is no link to leak, forward or screenshot, because there is no
 * link. The code means something only to an app that already knows how to resolve
 * it, and resolution lives behind the route guard.
 *
 * `looksLikeUrl` exists so that constraint is CHECKED rather than merely
 * intended. A negative constraint nothing tests is a constraint a later commit
 * deletes by accident, and "make the QR open the patient page" is exactly the
 * kind of well-meaning convenience change that would do it.
 *
 * Everything above the data-URL helper is pure — no `qrcode`, no canvas, no DOM.
 */

/**
 * A scheme (`http:`, `mailto:`, `ss:`), a protocol-relative prefix (`//host`), a
 * bare-host convention (`www.`), or any path separator at all.
 *
 * Deliberately over-broad. This is a guard, and for a guard a false positive
 * costs one rejected id while a false negative costs a leaked record. A `qrId`
 * has no legitimate reason to contain `:` or `/`, so nothing valid is caught by
 * being strict here.
 */
const URL_SHAPED =
  /(^[A-Za-z][A-Za-z0-9+.-]*:)|(^\/\/)|(^www\.)|([/\\])|(:\/\/)/u;

/** Whitespace, control characters, and the quote/angle set that would make a
 *  payload ambiguous if it were ever interpolated somewhere. */
const UNSAFE_IN_PAYLOAD = /[\s\u0000-\u001F<>"'`]/u;

/**
 * The value written into the QR symbol.
 *
 * Trims surrounding whitespace and does NOTHING ELSE. No case change, no prefix,
 * no encoding: the string that comes out is byte-for-byte the `qrId` that went
 * in, which is what lets `findPatientByQrId` be handed a scan result directly and
 * what the test asserts.
 */
export function qrPayload(qrId: string): string {
  return (qrId ?? '').trim();
}

/** `true` when a value could be navigated to by a generic camera app. */
export function looksLikeUrl(value: string): boolean {
  return URL_SHAPED.test((value ?? '').trim());
}

/**
 * The invariant, as a predicate: a payload is opaque — non-empty, no URL shape,
 * no whitespace or control characters.
 */
export function isOpaquePayload(value: string): boolean {
  const payload = (value ?? '').trim();
  if (payload === '') return false;
  if (looksLikeUrl(payload)) return false;
  return !UNSAFE_IN_PAYLOAD.test(payload);
}

/**
 * A scanned or typed value, normalised for lookup.
 *
 * `findPatientByQrId` already compares case-insensitively, so this only has to
 * strip what a keyboard and a camera add: surrounding whitespace, and the
 * zero-width characters some Android keyboards paste in. Case is left alone so
 * the value can be shown back to the user exactly as it was read.
 */
export function normaliseScannedValue(value: string): string {
  return (value ?? '').replace(/[\u200B-\u200D\uFEFF]/gu, '').trim();
}

/**
 * The QR symbol as a PNG data URL, for an `<img src>`.
 *
 * `qrcode` is loaded through a dynamic import for two reasons. It keeps the
 * encoder — and its canvas dependency — out of every bundle except the one screen
 * that draws a card. And it keeps this module importable by a plain Node test, so
 * the payload rules above can be covered without loading a rendering library to
 * assert a string equality.
 *
 * No colour options are passed. The default pure black on pure white is not a
 * design choice this module is allowed to make prettier: it is the maximum
 * contrast a camera can get, and the demo scans a PRINTED code, possibly a
 * photocopied one, possibly in shade. The plate around the image carries the
 * product's ink and paper; the symbol itself carries the data.
 *
 * `errorCorrectionLevel: 'M'` recovers roughly 15% of a damaged symbol, which is
 * the level that survives a fold, a thumb smudge and a grubby print without
 * inflating the module count past what a 360px screen can show legibly.
 */
type ToDataURL = (typeof import('qrcode'))['toDataURL'];

/**
 * `qrcode`'s browser entry is CommonJS — `exports.toDataURL = …` — and how that
 * arrives through a dynamic `import()` depends on the bundler's interop. Both
 * shapes are accepted rather than assuming one, because the difference between
 * them is the difference between a patient card and a blank plate, and it would
 * only show up at runtime in a browser.
 */
async function loadToDataURL(): Promise<ToDataURL> {
  const mod = (await import('qrcode')) as unknown as {
    toDataURL?: ToDataURL;
    default?: { toDataURL?: ToDataURL };
  };
  const fn = mod.toDataURL ?? mod.default?.toDataURL;
  if (typeof fn !== 'function') {
    throw new Error('qr: qrcode.toDataURL is unavailable in this environment');
  }
  return fn;
}

export async function encodeQrDataUrl(
  qrId: string,
  options?: { scale?: number; margin?: number },
): Promise<string> {
  const payload = qrPayload(qrId);
  if (!isOpaquePayload(payload)) {
    throw new Error('qr: refusing to encode a payload that is not an opaque id');
  }

  const toDataURL = await loadToDataURL();
  return toDataURL(payload, {
    errorCorrectionLevel: 'M',
    /* A quiet zone of 2 modules is the spec minimum that still decodes; the
       plate's own padding supplies the rest of the visual breathing room. */
    margin: options?.margin ?? 2,
    scale: options?.scale ?? 8,
  });
}
