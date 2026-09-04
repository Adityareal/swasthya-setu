import type { NextConfig } from 'next';

/**
 * Static export, because the Android APK is a Capacitor WebView loading files
 * from disk. There is no Node server inside the app package, so the build has to
 * emit a fully self-contained `out/` bundle.
 *
 * The three settings below are all consequences of that single decision:
 *
 * - `output: 'export'` — emit `out/` instead of a server build.
 * - `images.unoptimized` — `next/image`'s optimiser is a server route, and the
 *   export has no server. Without this the export refuses to run.
 * - `trailingSlash` — the export writes `/doctor/index.html` rather than
 *   `/doctor.html`. Under `file://` a request for `/doctor/` resolves to the
 *   directory's `index.html`; a request for `/doctor` does not reliably resolve
 *   to anything. This is the setting that decides whether navigation works
 *   inside the APK at all.
 *
 * NOTE FOR THE WEB DEPLOYMENT: `output: 'export'` and route handlers are
 * mutually exclusive. `app/api/` therefore stays in the repo for the hosted
 * deployment (which serves the Gemini calls) and is deleted only inside the APK
 * workflow. See `.github/workflows/android.yml` step "Strip server route
 * handlers".
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
