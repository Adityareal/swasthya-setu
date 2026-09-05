# Swasthya Setu — Android APK

The app ships as a Capacitor WebView wrapping the Next.js static export. The APK
is built by GitHub Actions, not on a developer machine — no Android SDK, JDK, or
Gradle install is needed to produce one.

**One thing to know before the demo:** the APK works offline. Only the two AI
surfaces need the network, and both fall back to a deterministic local result
that is visibly labelled as such. See [What needs the network](#what-needs-the-network).

---

## Build an APK

1. Push this repository to GitHub, then open **Actions → Android APK**.
2. Press **Run workflow**, pick the branch, confirm.
3. It also runs automatically on every push to `master`.

The run takes roughly 5–10 minutes. Most of that is Gradle downloading the
Android platform on a cold cache; later runs are quicker.

## Download it

Open the completed run and scroll to **Artifacts** at the bottom of the summary
page. Download **`swasthya-setu-debug-apk`**. GitHub always serves artifacts as a
zip, so unzip it to get `app-debug.apk`. Artifacts expire after 30 days.

## Sideload it

On the phone:

1. Copy `app-debug.apk` across — USB, Drive, or just download it from GitHub in
   the phone's browser while signed in.
2. Open it with the Files app. Android will refuse the first time and offer a
   settings shortcut.
3. Enable **Install unknown apps** for whichever app is doing the opening
   (Files, Chrome, Drive). On older Android this is one global switch under
   **Settings → Security → Unknown sources**.
4. Install. Play Protect may show a "unrecognised developer" warning — **Install
   anyway**. This is expected for a debug-signed build and is not a malware
   finding.

Minimum Android 6.0 (API 23). The app appears as **Swasthya Setu**.

### Why debug signing

A debug APK is signed with the standard Android debug key that every SDK install
generates. That is enough to sideload anywhere and enough for a demo. A release
build would need a keystore held in repository secrets, and losing that keystore
means never being able to ship an update to an installed app. The one thing this
trade gives up is Play Store distribution, which is not needed here.

---

## What needs the network

Two surfaces call Gemini, and both go through server route handlers rather than
calling the model from the phone:

| Surface | Route | Without network |
|---|---|---|
| Symptom triage / chat | `POST /api/triage`, `POST /api/triage/chat` | Deterministic keyword classifier, labelled as a fallback assessment |
| Doctor longitudinal summary | `POST /api/summary` | Locally composed template summary, labelled as unavailable-AI |

Reaching those handlers is necessary but not sufficient: the deployment serving
them also needs `GEMINI_API_KEY` in **its own** environment for live AI. Without
it the handlers still answer, they just answer with the fallbacks in the
right-hand column above. See
[Live AI on the hosted deployment](#live-ai-on-the-hosted-deployment).

Everything else — registration, intake, vitals, facility routing, token
assignment, clinical decisions, prescriptions, the referral board, the stock and
dashboard views, the offline write queue — runs entirely on the device against
`localStorage`. No network, no server, no account.

### Live AI on the hosted deployment

Because the export is conditional, the hosted build keeps its route handlers, so
`/api/triage`, `/api/triage/chat` and `/api/summary` answer rather than returning
405. Answering is not the same as answering with Gemini — the deployment also
needs `GEMINI_API_KEY` in **its own** environment:

1. **Vercel → the project → Settings → Environment Variables → Add**
   - Key: `GEMINI_API_KEY`
   - Value: a Google AI Studio key for `gemini-2.5-flash`
   - Apply it to Production, plus Preview if previews should have live AI too.
2. Redeploy. An already-built deployment does not pick up a variable added after
   it was built.

Server-side only, and it has to stay that way: no `NEXT_PUBLIC_` prefix, so the
value is never inlined into the client bundle. Only `app/api/` reads it.

Without the key every flow still completes on its visibly labelled fallback —
keyword triage marked as a fallback assessment, and a locally composed
longitudinal summary marked as unavailable-AI. A missing key degrades the demo
rather than breaking it.

### Pointing the APK at a hosted deployment

To get live Gemini output inside the APK, the route handlers have to exist
somewhere the phone can reach:

1. Deploy this repository to any Node host that runs Next.js route handlers
   (Vercel is the path of least resistance). Set `GEMINI_API_KEY` in that
   deployment's environment.
2. In this repository: **Settings → Secrets and variables → Actions →
   Variables → New repository variable**.
   - Name: `API_BASE_URL`
   - Value: the deployment origin, e.g. `https://swasthya-setu.vercel.app`
     — **https, no trailing slash**
3. Re-run the workflow. `NEXT_PUBLIC_API_BASE_URL` is inlined into the bundle at
   build time, so an existing APK does not pick this up; you need a new one.

A **variable**, not a secret, because the value is an origin rather than a
credential. HTTPS is not optional: `capacitor.config.ts` sets
`allowMixedContent: false`, so the WebView drops plain `http`.

Leave it unset and the workflow still succeeds — the APK just runs on its local
fallbacks. That is deliberate, so a working APK exists before any deployment
does.

### Where the Gemini key is, and is not

`GEMINI_API_KEY` is read only by the route handlers in `app/api/`, only
server-side, and appears nowhere in this workflow. An APK is a zip archive that
anyone can unpack, so a key inlined into the client bundle would be a published
key. The phone talks to your deployment; your deployment talks to Gemini.

---

## How the packaging works

```
BUILD_TARGET=apk next build ──> out/    static export, no server
                 │
          npx cap sync android ──> android/app/src/main/assets/public/
                                          │
                                   ./gradlew assembleDebug
                                          │
                                   app-debug.apk
```

Four decisions carry this, each with a consequence worth knowing before changing it:

**The static export in `next.config.ts` is conditional on `BUILD_TARGET=apk`.**
The two consumers need opposite builds. The APK needs a static bundle — the
WebView loads files from disk and there is no Node process inside the app
package. The hosted deployment needs the opposite, a server build, because a
static export has no server to run a route handler on and would leave
`/api/triage`, `/api/triage/chat` and `/api/summary` non-existent. The env var
picks between them, and it is set in exactly one place: the **Build static
export** step in `.github/workflows/android.yml`. Vercel, `npm run build` and
`npm run dev` leave it unset and get working route handlers.

`images.unoptimized` and `trailingSlash` stay unconditional. The first because
the image optimiser is a server route the export cannot use; the second because
the export writes `/doctor/index.html` and a directory request is what resolves
reliably inside a WebView — and because the same client code builds both targets,
so hosted and in-APK URLs have to agree on the trailing slash.

**The workflow deletes `app/api/` before building.** Now that the export is
conditional this is not what makes the APK build possible; it is what guarantees
server code cannot reach the APK bundle. `app/api/` is where `GEMINI_API_KEY` is
read, an APK is a zip anyone can unpack, and handlers that are not in the tree
cannot be compiled into one. The handlers stay in the repo for the hosted
deployment. The step is annotated in the workflow; please read that comment
before removing it.

**The doctor detail route is `/doctor/patient/?id=…`, not `/doctor/patients/[id]`.**
A dynamic segment under `output: 'export'` requires `generateStaticParams()`,
which can only prerender ids that exist at build time. Patients are created at
runtime by the ASHA registration flow, so a prerendered list would 404 for
exactly the patients a live demo creates. A query parameter has no build-time
dependency.

**Every `/api` call goes through `apiUrl()` in `lib/api-base.ts`.** Empty base
means same-origin, which is what the web needs. A configured base makes the call
absolute, which is what the APK needs. One seam, both behaviours.

## Local development is unchanged

```bash
npm run dev      # http://localhost:3000, route handlers live, same-origin /api
npm run build    # server build with route handlers — same as Vercel
npm test         # 236 tests
```

`npm run build` with `BUILD_TARGET` unset is a normal server build, so `npm start`
(`next start`) serves this app including `/api/...`. Set `BUILD_TARGET=apk` and the
same command emits a static `out/` instead, with no server and no route handlers —
that is the APK's build and not the one to reach for locally.

## Rebuilding the APK locally

Only if you have the Android SDK and **JDK 21** installed. `BUILD_TARGET=apk` is
required — without it the build is a server build, no `out/` is written, and
`cap sync` has nothing to copy (or, worse, copies a stale `out/` from an earlier
run):

```powershell
$env:BUILD_TARGET='apk'; npm run apk:debug; Remove-Item Env:\BUILD_TARGET
```

```bash
BUILD_TARGET=apk npm run apk:debug
```

The `apk:debug` script does not set the variable itself, deliberately: the switch
lives in the environment so there is exactly one build command and exactly one
thing that decides what it emits.

JDK 21 specifically — `android/app/capacitor.build.gradle`, generated by
Capacitor, pins Java 21 source and target compatibility. JDK 17 fails with
`invalid source release: 21`.

## Regenerating the icons

```bash
npm run icons
```

Writes `public/icons/` from the `--ss-*` palette in `app/globals.css`. The mark
is a medical cross over a bridge deck: Swasthya over Setu.

The **Android launcher icon is still Capacitor's default**. Swapping it means
replacing `android/app/src/main/res/mipmap-*/ic_launcher*.png` and setting
`values/ic_launcher_background.xml` to `#0B3B33`. Left alone deliberately —
a malformed Android resource fails `aapt2`, and that failure could not be
reproduced locally on the machine this was set up from.

## PWA fallback

`public/manifest.webmanifest` is wired through `metadata.manifest`, so the hosted
deployment is installable straight from the browser — **Add to Home screen** in
Chrome on Android gives a standalone window with the same icon. Worth knowing as
a second demo path if the APK is not to hand.

## Known gaps

- The Gradle build has only ever run in CI. If the first run fails, the failure
  will be in the Android toolchain rather than in the web build, which is
  verified locally.
- `components/shell/nav.ts` links to `/asha/scan`, which has no page yet
  (QR scanner, spec task 11.5). In the APK that link dead-ends on the 404 page
  rather than a browser error, but it is still a dead link.
- No release/signed variant, and no Play Store listing.
