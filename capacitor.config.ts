import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the static export in an Android WebView. It adds no code to
 * the app — `webDir` is the `out/` directory `next build` already produces, and
 * `npx cap sync android` copies it into the Gradle project verbatim.
 *
 * `allowMixedContent: false` is the one setting here with a security
 * consequence. The document loads over `https://localhost` inside the WebView,
 * so allowing mixed content would let a plain-`http://` API origin through and
 * put patient symptom text on the wire in the clear. Off means the hosted API in
 * `NEXT_PUBLIC_API_BASE_URL` must be HTTPS, which it should be regardless.
 *
 * `androidScheme: 'https'` is Capacitor's default and is left explicit because
 * it is load-bearing: `localStorage` is keyed by origin, and the repo snapshot
 * plus the offline write queue both live in `localStorage`. Changing the scheme
 * silently orphans every record already on the device.
 */
const config: CapacitorConfig = {
  appId: 'in.teamzenith.swasthyasetu',
  appName: 'Swasthya Setu',
  webDir: 'out',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
