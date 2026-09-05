/**
 * Where the server routes live.
 *
 * On the web the app and its route handlers are the same deployment, so a bare
 * `/api/...` is correct and `API_BASE` stays empty. Inside the Android APK the
 * document is served from `file://` (or `capacitor://`), where `/api/summary`
 * resolves to a path on the device filesystem that does not exist — the request
 * fails before it reaches the network. The APK build therefore sets
 * `NEXT_PUBLIC_API_BASE_URL` to the absolute origin of the hosted deployment and
 * every call becomes cross-origin by construction.
 *
 * `NEXT_PUBLIC_` is inlined at build time, which is exactly the right exposure
 * for this value: it is an origin, not a credential. The Gemini key stays behind
 * those routes and never enters the client bundle — an APK is a zip file that
 * anyone can unpack, so a key inlined here would be a key published.
 *
 * Every call site that uses this checks `isEffectivelyOnline()` FIRST, so an APK
 * running with no network never issues the request: triage answers from the
 * keyword classifier on the device and the summary from a locally composed
 * template, both visibly labelled, and every flow completes.
 *
 * An APK built with no base URL is a different case, and it now reads as the
 * misconfiguration it is. Online, its `/api/...` request resolves inside the
 * WebView instead of reaching a server, and that surfaces as a visible,
 * retryable error rather than as a keyword assessment wearing the AI's plate.
 * Set `NEXT_PUBLIC_API_BASE_URL`.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** Joins `path` onto the configured API origin. `path` starts with a slash. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
