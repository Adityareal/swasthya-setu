import type { NextConfig } from 'next';

/**
 * Two consumers, one repo, and they need opposite things from `next build`.
 *
 * - The **Android APK** is a Capacitor WebView loading files from disk. There is
 *   no Node process inside the app package, so it needs a fully self-contained
 *   static `out/` bundle — `output: 'export'`.
 * - The **hosted deployment** (Vercel, and `npm run dev`) needs the opposite: a
 *   normal server build, because the route handlers under `app/api/` are where
 *   the Gemini calls happen. A static export has no server to run a handler on,
 *   so exporting there serves the UI but leaves `/api/triage`,
 *   `/api/triage/chat` and `/api/summary` non-existent — every AI call then
 *   silently degrades to the deterministic local fallback. `GEMINI_API_KEY` also
 *   only stays server-side if there is a server.
 *
 * `BUILD_TARGET` picks between them, and it is set in exactly one place:
 * `.github/workflows/android.yml`, on the "Build static export" step. Anything
 * else — Vercel, `npm run build`, `npm run dev` — leaves it unset and gets the
 * server build with working route handlers.
 *
 * The other two settings are unconditional on purpose:
 *
 * - `images.unoptimized` — `next/image`'s optimiser is a server route, and the
 *   export has no server, so the export refuses to run without this. Harmless on
 *   a server build.
 * - `trailingSlash` — the export writes `/doctor/index.html` rather than
 *   `/doctor.html`, and inside the WebView a request for `/doctor/` resolves to
 *   that directory's `index.html` while `/doctor` does not reliably resolve to
 *   anything. This one MUST NOT differ between the two targets: the same client
 *   code builds both, so if hosted URLs and in-APK URLs disagree on the trailing
 *   slash they stop matching.
 */
const isApkBuild = process.env.BUILD_TARGET === 'apk';

const nextConfig: NextConfig = {
  ...(isApkBuild ? { output: 'export' as const } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
