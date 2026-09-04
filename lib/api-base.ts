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
 * Every call site that uses this has a deterministic local fallback
 * (`fallbackTriage`, the summary's unavailable state), so an APK built with no
 * base URL, or one running with no network, still completes every flow.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** Joins `path` onto the configured API origin. `path` starts with a slash. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
