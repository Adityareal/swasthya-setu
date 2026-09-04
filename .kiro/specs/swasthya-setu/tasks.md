# Implementation Plan: Swasthya Setu

## Overview

Ordered for a ~4 hour build. The sequence is the risk mitigation, not a suggestion.

Four ordering rules govern this list:

1. **Every task leaves the app runnable.** No task ends on a broken build, so the demo can be walked at any point.
2. **The Design_System token layer lands before the first screen** (Task 2). There is no polish pass at the end — the token layer *is* the polish pass, and it cannot be retrofitted.
3. **Demo beats 1–5 are one contiguous vertical slice** (Tasks 3–6). Schema, seed, auth, shell, picker, voice, triage, routing, chit, readback. This slice is complete and demoable before any doctor-workspace work starts.
4. **Beat 10 needs a secure context**, so the HTTPS origin ships *before* the scanner (Task 11.4 before 11.5), not at the end.

Then beats 6–9 (doctor panel, prescription, referral board), then beat 10 (QR), then beat 11 (offline), then the labelled mock surfaces.

Requirement 15's four mandated areas ship as **plain Vitest example tests** and are **not** marked optional — they are the floor. Each sits immediately after the pure module it covers, never batched at the end. The `fast-check` property layer is Task 14 and is entirely optional.

Out of scope per requirements and therefore absent from this list: the NGO/fundraising portal (14.6), offline sign-in, merge-conflict resolution, any sync-management screen (13.6), Realtime queue subscriptions (8.5), any public `/p/{qr_id}` route (12.4), and any locale beyond `en-IN` / `hi-IN` (16.2).

## Tasks

- [ ] 1. Project foundation and environment

  - [ ] 1.1 Scaffold Next.js 15, dependencies, Supabase clients, env vars, Vitest
    - `create-next-app` with TypeScript, App Router, Tailwind; add `@supabase/supabase-js`, `@supabase/ssr`, `zustand`, `idb`, `zod`, `qrcode`, `html5-qrcode`, `vitest`
    - Write `lib/supabase/client.ts` (browser client) and `lib/supabase/server.ts` (`@supabase/ssr` cookie-based server client)
    - Declare all five env vars; `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` carry no `NEXT_PUBLIC_` prefix and are never imported by app code
    - `vitest.config.ts` with `environment: 'node'`, single project; `npm test` → `vitest run` (single-run mode)
    - Files: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `.env.local`, `.env.example`
    - _Design: Overview → Build Posture; Architecture → Environment; Testing Strategy_
    - _Requirements: 15.5, 16.4_

  - [ ] 1.2 shadcn init and Mukta font wiring
    - `shadcn init`, then add `button`, `card`, `input`, `textarea`, `select`, `dialog`, `badge`
    - Load Mukta via `next/font/google` at weights 400/600/800, subsets `latin` + `devanagari`, `display: 'swap'`, exposed as a CSS variable consumed by `--ss-font-ui`
    - Fallback chain `'Noto Sans Devanagari', system-ui, sans-serif` — no Latin-only face may be first
    - Files: `components.json`, `components/ui/*.tsx`, `app/layout.tsx`
    - _Design: Visual Design System → Typography_
    - _Requirements: 2.1_

- [ ] 2. Design_System token layer — written before the first screen

  - [ ] 2.1 CSS custom properties and Tailwind `@theme` mapping
    - `:root` block in `@layer base` with the full `--ss-*` set verbatim: ground/surface/sunk, ink and ink-muted, chrome trio, the three signal colours plus `--ss-med-fg`, action pair, `--ss-line` / `--ss-line-soft`, scrim
    - Type scale tokens `--ss-text-caption` through `--ss-text-token`, plus `--ss-leading-latin` / `--ss-leading-deva` with a `[lang="hi-IN"]` rule applying the Devanagari leading
    - Spacing 1–16, `--ss-touch-min: 44px`, `--ss-touch-field: 56px`, radius trio, the four hard-offset elevations (zero blur), motion duration and easing
    - `:focus-visible { outline: 3px solid var(--ss-ink); outline-offset: 2px }` plus the `.on-chrome` white variant
    - `@theme inline` mapping so components write `bg-surface text-ink border-2 border-line rounded-plate shadow-plate min-h-touch` and never a hex literal or arbitrary value
    - Files: `app/globals.css`
    - _Design: Visual Design System → Palette, Typography, Spacing/Radius/Elevation; How the Tokens Land in Code (Layers 1–2)_
    - _Requirements: 2.1, 2.3, 2.4, 16.3_

  - [ ] 2.2 Alias shadcn variables and edit the three identity primitives
    - Redefine `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--destructive`, `--border`, `--input`, `--ring`, `--radius` against `--ss-*` so every shadcn component inherits the identity untouched
    - In each of the three `cva` definitions: `rounded-md` → `rounded-plate`, `shadow-sm` → hard `shadow-plate`, `border` → `border-2 border-line`, add `min-h-touch`, add the pressed state (`active:translate-x-[2px] active:translate-y-[2px]` with `--ss-elev-pressed`)
    - Explicitly override the three failing shadcn defaults: soft grey borders, blurred `shadow-sm`, and the ~3:1 muted-foreground grey
    - Files: `app/globals.css`, `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/input.tsx`
    - _Design: How the Tokens Land in Code (Layer 3)_
    - _Requirements: 2.1, 2.3, 2.4_

  - [ ] 2.3 Signature-move primitives: plate, signal rail, BiLabel, MockPlate
    - `.plate` / `.plate--raised` / `.plate--pressed` utilities: flat fill, 2px ink border, `--ss-radius-plate`, hard offset shadow
    - Signal Rail: 8px `border-inline-start` driven by a `data-state` attribute, one rule covering risk / action / mock / error states
    - `<BiLabel>` renders the active locale at full size with the other locale beneath at `--ss-text-caption` in `--ss-ink-muted`, tight leading — scoped to decision surfaces only
    - `<MockPlate>` sets `data-mock="true"` and renders `<MockBadge>` (ochre pill, ink text, beaker glyph, `प्रदर्शन / DEMO`) plus the dashed ochre outline, so a mocked surface cannot exist without the badge
    - Files: `app/globals.css`, `components/system/BiLabel.tsx`, `components/system/MockPlate.tsx`, `components/system/MockBadge.tsx`
    - _Design: Three Signature Moves; Mock-Badge Treatment_
    - _Requirements: 2.1, 2.2, 14.1_

- [ ] 3. Database: schema, RLS, functions, seed

  - [ ] 3.1 Enums, nine tables, indexes, shared domain types
    - Eight enums including `language_code` (two members only, so a third locale needs a migration), `pgcrypto`, all nine tables with checks and the `appointments` unique `(facility_id, token_number)` constraint, `health_records_patient_time_idx`
    - Include the three load-bearing non-Requirement-1 columns: `health_records.triage_source`, `facilities.location_label`, `appointments.is_teleconsult`
    - Hand-write the TS domain types (`Facility`, `Patient`, `HealthRecord`, `RiskLevel`, `ReferralStatus`, `SupportedLanguage`, …) rather than generating — faster and the surface is small
    - Files: `supabase/migrations/0001_schema.sql`, `lib/types.ts`
    - _Design: Data Model → Enums, Tables_
    - _Requirements: 1.1_

  - [ ] 3.2 RLS policies, role helpers, verification script
    - `app_role()` and `is_worker()` as `security definer stable` with pinned `search_path` — note `current_role` is a reserved keyword and must not be used as the function name
    - Enable RLS on all nine tables and write the policy set: both roles read, ASHA-only patient writes, doctor-only prescription and referral inserts, append-only `health_records`, no policy granted to `anon` anywhere
    - `verify-rls.sql` asserts `rowsecurity` on all nine tables and at least one policy each
    - If the clock bites, apply in demo-path order: `patients`, `health_records`, `appointments`, `prescriptions`, `referrals`, then the rest
    - Files: `supabase/migrations/0002_rls.sql`, `supabase/verify-rls.sql`
    - _Design: Data Model → Row Level Security_
    - _Requirements: 3.6, 12.4_

  - [ ] 3.3 Referral transition trigger and `book_appointment` function
    - `enforce_referral_transition()` before-update trigger permitting only `referred → in_progress` and `in_progress → completed`, raising `check_violation` otherwise — RLS cannot compare OLD to NEW, which is why this is a trigger
    - `book_appointment(patient, facility, record, teleconsult)` as `security definer`: explicit `is_worker()` check, `pg_advisory_xact_lock(hash(facility))`, then compute-and-insert `max(token_number)+1` in one statement
    - Revoke from `public`/`anon`, grant execute to `authenticated`
    - Files: `supabase/migrations/0003_functions.sql`
    - _Design: Data Model → Referral Transition Trigger, Token Assignment Function; Routing_Engine → Token_Number and the race condition_
    - _Requirements: 8.2, 8.3, 11.3, 11.4_

  - [ ] 3.4 `supabase/seed.sql` with stable UUIDs
    - Declare the hard-coded constant UUIDs as comments, then upsert every row `on conflict (id) do update` so a second run changes values but never row counts
    - Three Wardha facilities (PHC Sevagram, CHC Wardha, District Hospital Wardha) with `"lat,lng"` coordinates and `location_label`; Kamla Bai 34, Wardha, `hi-IN`, `qr_id = 'SS-WRD-KAMLA-7F3A'`; three `health_records` for Kamla with distinct symptoms / summaries / risk levels spread over ~10 months; `medicine_stock` for all three facilities
    - Thirteen prior `appointments` rows at CHC Wardha holding explicit tokens 1–13, so the demo's next token is **14**
    - Files: `supabase/seed.sql`
    - _Design: Data Model → Seed Strategy (Requirement 1.6)_
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 3.5 `scripts/seed-auth.ts` for the two Auth users
    - Service-role Admin API, run from a terminal only, never imported by app code
    - Pass explicit `id` to `createUser` so `health_workers.id = auth.users.id` survives reseeds; on "already registered" fall through to `updateUserById`, then upsert the two `health_workers` rows with the same ids
    - `asha@swasthyasetu.demo` / `doctor@swasthyasetu.demo` with the seeded passwords and `facility_id` set to PHC Sevagram
    - Files: `scripts/seed-auth.ts`, `package.json` (script entry)
    - _Design: Data Model → Seed Strategy_
    - _Requirements: 1.6, 3.1_

- [ ] 4. Auth, i18n, and App_Shell

  - [ ] 4.1 i18n dictionaries and `useT`
    - `en-IN` is the type source: `type MessageKey = keyof typeof enIN`, so a key missing from `hi-IN` is a TypeScript error
    - `useT()` reads `locale` from Zustand, `t(key, params?)` interpolates `{name}`; set `document.documentElement.lang` in an effect so font selection and Devanagari leading follow
    - No `[locale]` segment, no locale middleware, no i18n framework
    - Files: `lib/i18n/en-IN.ts`, `lib/i18n/hi-IN.ts`, `lib/i18n/index.ts`
    - _Design: Components and Interfaces → i18n_
    - _Requirements: 16.2_

  - [ ] 4.2 Zustand store
    - `worker`, `facilities` (cached for offline routing), `selectedPatientId`, `locale`, `lastTriage`, `voice`, `pendingCount`, `failedCount`, `online`
    - Persist **only** `locale` to localStorage; a stale persisted `selectedPatientId` is a bug source with no upside
    - Files: `lib/store.ts`
    - _Design: Architecture → State Ownership_
    - _Requirements: 3.5, 13.3_

  - [ ] 4.3 Guard module, middleware, role redirects, error boundaries
    - `lib/auth/guard.ts` with pure `landingRouteFor(role)` and `guardDecision(session, path)`
    - `middleware.ts` matcher `['/asha/:path*', '/doctor/:path*', '/patient/:path*', '/dashboard/:path*', '/teleconsult/:path*']` — the `(patient)` and `(mock)` groups sit **inside** the authenticated perimeter — refreshing the session cookie and redirecting to `/sign-in?next=<pathname>`
    - Server-component role guards in each route-group layout: an ASHA hitting `/doctor` lands on `/asha`; `app/page.tsx` is a pure server redirect by role
    - One `error.tsx` per route group plus `global-error.tsx`, so a doctor-panel crash does not take the shell down
    - Files: `middleware.ts`, `lib/auth/guard.ts`, `app/page.tsx`, `app/(asha)/layout.tsx`, `app/(doctor)/layout.tsx`, `app/(asha)/error.tsx`, `app/(doctor)/error.tsx`, `app/global-error.tsx`
    - _Design: Components and Interfaces → Auth_Module; Architecture → Route Groups_
    - _Requirements: 3.2, 3.3, 3.4, 12.4_

  - [ ] 4.4 Sign-in screen with seeded credentials
    - Email + password against Supabase Auth, honours `?next=`, hydrates `worker` and `facilities` into Zustand once on success
    - Both seeded credentials rendered as copy-to-fill buttons, labelled as a demo affordance
    - Files: `app/(auth)/sign-in/page.tsx`
    - _Design: Components and Interfaces → Auth_Module_
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 4.5 App_Shell: app bar and icon-first navigation
    - Petrol-green app bar with `.on-chrome` focus scope; bottom nav on mobile promoting to a left rail above 768px for the doctor panel
    - Every destination is an icon paired with a `<BiLabel>` at a 56px target; locale toggle in the bar
    - Verify 360px width with no horizontal scroll; leave mount points for the connectivity banner and pending badge (filled in Task 12)
    - Files: `components/shell/AppShell.tsx`, `components/shell/BottomNav.tsx`, `components/shell/nav-config.ts`, `app/layout.tsx`
    - _Design: Visual Design System → Responsive and Shell_
    - _Requirements: 2.2, 2.3, 16.3_

- [ ] 5. Pure decision modules for the intake path

  - [ ] 5.1 `fallbackTriage` — deterministic keyword classifier
    - Pure, zero imports beyond types: no `fetch`, no `Date.now()`, no randomness, so it runs identically in the route handler and on an offline client
    - NFC normalise → lowercase → collapse whitespace → strip Latin punctuation and the danda; substring matching, because Devanagari inflection makes token equality useless
    - Full three-tier keyword table in English, Devanagari, **and Latin-script Hindi** so a romanised mis-transcription still triages
    - Precedence `high` → `medium` → `low`, and **no match defaults to `medium`, never `low`** — under-triage is the asymmetric error
    - One composite rule: a pregnancy term co-occurring with bleeding or pain escalates to `high`
    - Return `matched: string[]` so the UI can show which keywords fired; locale-keyed deterministic summary templates
    - No negation handling — documented limitation, over-triage is the safe direction
    - Files: `lib/triage/fallback.ts`
    - _Design: Components and Interfaces → Fallback_Triage_
    - _Requirements: 5.3, 16.5_

  - [ ] 5.2 Test Fallback_Triage keyword-to-Risk_Level mapping
    - Plain Vitest example tests, no mocks. This is a Requirement 15 floor task, not optional.
    - One example per Risk_Level in each script; the no-match → `medium` default; a mixed transcript where a `high` keyword wins; the pregnancy composite rule; assertions on `matched`
    - Files: `tests/fallback-triage.test.ts`
    - _Design: Testing Strategy_
    - _Requirements: 15.1, 5.3_

  - [ ] 5.3 Gemini request builder and triage response parser
    - `buildTriageRequest` emits **text parts only** — no `inlineData`, no `fileData` key anywhere in the serialised body
    - `parseTriage` is its own pure module returning a Result, so the unparseable branch is testable without a network: truncated JSON, fenced code block, out-of-enum `risk_level`, empty string
    - `resolveTriage` composes parse-or-fallback and never throws
    - Files: `lib/gemini/build-request.ts`, `lib/triage/parse.ts`, `lib/triage/resolve.ts`
    - _Design: Components and Interfaces → Triage_Engine_
    - _Requirements: 5.1, 5.3, 16.4, 16.5_

  - [ ] 5.4 `nextTokenFrom` — pure token rule
    - `[] → 1`, `[1,2,3] → 4`, `[7] → 8`; independent of input ordering and unaffected by duplicates
    - The same rule the SQL in `book_appointment` implements; the unique constraint and advisory lock are what make the database race-free, not this function
    - Files: `lib/routing/token.ts`
    - _Design: Routing_Engine → Token_Number and the race condition_
    - _Requirements: 8.3_

  - [ ] 5.5 Test Token_Number computation
    - Plain Vitest example tests. Requirement 15 floor task, not optional.
    - Empty facility → 1; facility holding tokens 1–13 → 14 (the demo case); unordered input; duplicate input
    - Files: `tests/token.test.ts`
    - _Design: Testing Strategy_
    - _Requirements: 15.3, 8.3_

  - [ ] 5.6 `selectFacility` — risk-to-facility-type with nearest match
    - Eligibility: `low` → PHC (falling back to CHC), `medium` → CHC (falling back to district hospital), `high` → nearest among **both** CHC and district hospital, because sending a possible cardiac case past a closer CHC costs time that matters
    - Inline haversine over `"lat,lng"` parsed from `facilities.location` — eight lines, no PostGIS, no dependency
    - Origin resolution: the signed-in ASHA's assigned facility coordinates, then the first eligible facility. **No device geolocation.**
    - Fully specified tie-breaks so tests are stable: distance → eligible-type priority → name → id. Returns `null` only on an empty list
    - No Realtime subscription anywhere in this path
    - Files: `lib/routing/select-facility.ts`, `lib/routing/haversine.ts`
    - _Design: Components and Interfaces → Routing_Engine_
    - _Requirements: 8.1, 8.5_

  - [ ] 5.7 Test Routing_Engine facility selection
    - Plain Vitest example tests. Requirement 15 floor task, not optional.
    - One example per Risk_Level against the three seeded facilities; the `high` case must resolve to CHC Wardha (the demo assertion); a no-eligible-facility list returns `null`; a tie exercising the documented tie-break chain
    - Files: `tests/select-facility.test.ts`
    - _Design: Testing Strategy_
    - _Requirements: 15.4, 8.1_

- [ ] 6. Flow A vertical slice — demo beats 2 through 5

  - [ ] 6.1 ASHA worklist and Patient_Picker with inline creation
    - `/asha` worklist listing seeded patients as plates with the signal rail; `/asha/intake` hosts the picker above the symptom form
    - Inline creation dialog writes a `patients` row with demographics and `preferred_language`, generating a `qr_id`; selection writes `selectedPatientId` to Zustand
    - **Symptom capture stays disabled while no patient is selected**
    - Empty state teaches the next action ("Scan a patient's card, or pick from the list") rather than announcing emptiness
    - Files: `app/(asha)/asha/page.tsx`, `app/(asha)/asha/intake/page.tsx`, `components/asha/PatientPicker.tsx`
    - _Design: Architecture → Route Groups; Demo Script beat 2_
    - _Requirements: 4.1, 4.2_

  - [ ] 6.2 Voice_Module capture and the transcript panel
    - `useSpeechRecognition` creates the instance lazily on first `start()`, never during render; `continuous = false`, `interimResults = true`, `lang` from the selected locale
    - Handle `onstart` / `onresult` / `onerror` / `onend` per the design table; walk results from `event.resultIndex`; **no auto-restart** on `onend`; `abort()` and null every handler on unmount
    - Interim text rendered in `--ss-ink-muted` with a dashed underline — **never italic**, since Devanagari has no true italic and a synthesised oblique looks broken
    - The transcript is **always** an editable textarea and the mic writes into it, so "edit before submission" and "no SpeechRecognition support" are the same code path; unsupported means a disabled mic with an explanatory caption
    - Map every error code to a locale message key; anything other than `no-speech` / `aborted` flips to text entry with the partial transcript preserved
    - "Use sample complaint" button behind `NEXT_PUBLIC_DEMO_HELPERS`, wrapped in `<MockPlate>`
    - Files: `lib/voice/useSpeechRecognition.ts`, `lib/voice/voice-reducer.ts`, `components/asha/TranscriptPanel.tsx`, `app/(asha)/asha/intake/page.tsx`
    - _Design: Components and Interfaces → Voice_Module_
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ] 6.3 `/api/triage` route handler
    - `export const runtime = 'nodejs'`; `gemini-2.5-flash` via plain `fetch`, no SDK
    - `systemInstruction` with the three-tier rubric and the no-diagnosis rule; `responseMimeType: 'application/json'` plus the `responseSchema`, `temperature: 0.2`, `maxOutputTokens: 400`
    - One `AbortController` at 10 000 ms cleared in `finally`; the abort path and the error path converge on a single fallback handler
    - **Always HTTP 200 on a well-formed request** — a Gemini failure is a `source: 'fallback'` response, not a client-visible error status. A malformed body is the only 4xx
    - Files: `app/api/triage/route.ts`
    - _Design: Components and Interfaces → Triage_Engine_
    - _Requirements: 5.1, 5.3, 16.4, 16.5_

  - [ ] 6.4 RiskBadge, AdvisoryNote, and the triage result plate
    - `<RiskBadge>` encodes risk four redundant ways: shape (circle / triangle / **octagon**) as one inline SVG with three swapped `d` paths, bar count, fill treatment, and bilingual text
    - `<AdvisoryNote>` is rendered **inside** `RiskBadge` and `AiSummary`, so a caller cannot render AI output without the advisory notice; the badge also renders the fallback label when `triage_source = 'fallback'`
    - Enforce the ochre rule: `--ss-med-fill` never appears as a foreground; medium-risk glyphs on light grounds use `--ss-med-fg`
    - Submit button enters a waiting state with a text label ("Assessing… / आकलन हो रहा है…") and a plate-shaped skeleton, never a spinner over content
    - Files: `components/system/RiskBadge.tsx`, `components/system/AdvisoryNote.tsx`, `components/asha/TriageResultPlate.tsx`
    - _Design: Risk Levels: Four Redundant Channels; Longitudinal_Summary → Advisory framing_
    - _Requirements: 2.4, 5.4, 5.5, 6.1, 6.2_

  - [ ] 6.5 Persist the record, select the facility, book the token
    - Insert `health_records` with `patient_id`, `symptoms`, `ai_triage_summary`, `risk_level`, `triage_source`, `timestamp` via the browser client under RLS
    - Call `selectFacility()` locally (pure, cached facility list), then `rpc('book_appointment')`
    - Retry on `23505` up to three times with a small backoff, converting a lost race into a correct token one higher; on failure show an inline error plate with the form state preserved rather than writing a partial appointment
    - Files: `lib/intake/submit-intake.ts`, `app/(asha)/asha/intake/page.tsx`
    - _Design: Architecture → Data Flow, Flow A; Routing_Engine_
    - _Requirements: 5.2, 8.1, 8.2, 8.3_

  - [ ] 6.6 Token Chit confirmation screen
    - The composition of all three signature moves: a plate with a perforated leading edge from a single `repeating-radial-gradient`, facility name in a `<BiLabel>` at `--ss-text-display`, token number at `--ss-text-token` in tabular 800
    - Display facility name, Facility_Type, and Token_Number; read `current_queue_length` once from the seeded row for display only, with no subscription
    - Built as a reusable component — appointment cards and the printable QR sheet reuse it verbatim
    - Files: `app/(asha)/asha/intake/[recordId]/page.tsx`, `components/system/TokenChit.tsx`
    - _Design: Three Signature Moves → The Token Chit; Demo Script beat 5_
    - _Requirements: 8.4, 8.5_

  - [ ] 6.7 SpeechSynthesis readback
    - `useSpeechSynthesis` waits for `voiceschanged` before selecting, since `getVoices()` populates asynchronously
    - Voice locale comes from the **patient's** `preferred_language`, deliberately a different source from the UI locale, so an English-UI ASHA can still play Hindi guidance
    - Selection order: exact `lang` match → `lang.startsWith('hi')` → `null`; a `null` result renders the guidance as on-screen text plus an "audio unavailable on this device" notice
    - The utterance builder assembles `advisory + summary + next step`, so the advisory cannot be omitted by a caller
    - Files: `lib/voice/useSpeechSynthesis.ts`, `lib/voice/select-voice.ts`, `lib/voice/build-utterance.ts`, `components/asha/ReadbackButton.tsx`
    - _Design: Components and Interfaces → Voice_Module → SpeechSynthesis_
    - _Requirements: 6.3, 7.1, 7.2, 7.3_

- [ ] 7. Checkpoint — demo beats 1 through 5 walk end to end
  - Run `npx vitest run`; the three Requirement 15 test files written so far must pass.
  - Walk the slice on Android Chrome: sign in as ASHA → pick Kamla → capture → HIGH verdict with advisory → CHC Wardha, Token 14 → Hindi readback.
  - Run the two by-hand integration checks worth their minute: seed twice and compare row counts, and `select tablename, rowsecurity from pg_tables` across the nine tables.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Doctor_Panel — demo beats 6 and 7

  - [ ] 8.1 `trimHistory` and `resolveSummary`
    - Sort date-descending and never drop the most recent record; keep at most 8; truncate `symptoms` / `summary` to 240 chars and `medicines` to 120 on a word boundary; attach `medicines` only to the 3 most recent prescribed records; hard-cap the serialised payload at 4 000 chars by dropping oldest-first
    - `resolveSummary` returns `{ summary: null, unavailable: true, reason }` on every failure shape and never fabricates a summary string
    - Files: `lib/summary/trim.ts`, `lib/summary/resolve.ts`
    - _Design: Components and Interfaces → Longitudinal_Summary_
    - _Requirements: 9.2, 9.3, 16.5_

  - [ ] 8.2 `/api/summary` route handler
    - `runtime = 'nodejs'`; the client posts an already-RLS-gated trimmed history, so the route stays stateless and no service-role key exists in the request path
    - Plain-text output, not JSON — one field does not need a schema; written in the patient's `preferred_language`; no diagnosis, no new clinical claims, references visits by date, names any cross-visit trend
    - Same 10 s `AbortController`; returns HTTP 200 with `unavailable: true` on timeout, HTTP error, or empty output
    - Files: `app/api/summary/route.ts`
    - _Design: Components and Interfaces → Longitudinal_Summary_
    - _Requirements: 9.2, 9.3, 16.4_

  - [ ] 8.3 Doctor queue page with summary prefetch
    - `/doctor` lists patients as plates with the risk signal rail
    - Fire the summary request on queue-row click rather than on panel mount, so it warms while the presenter is still talking; cache per `patientId` in Zustand for the session
    - Files: `app/(doctor)/doctor/page.tsx`, `lib/summary/use-summary.ts`
    - _Design: Risks → Doctor summary latency_
    - _Requirements: 9.2_

  - [ ] 8.4 Doctor_Panel: AI summary above the reverse-chronological record list
    - `<AiSummary>` renders `<AdvisoryNote>` internally; measure held to 65–75ch
    - `health_records` in reverse chronological order — required regardless, which is what makes the degraded state the normal state minus one plate rather than a blank screen
    - Degraded path: notice plate ("AI summary unavailable — showing full visit history") plus one manual **Retry summary** button, no automatic retry loop
    - Files: `app/(doctor)/doctor/patients/[id]/page.tsx`, `components/doctor/AiSummary.tsx`, `components/doctor/RecordList.tsx`
    - _Design: Components and Interfaces → Longitudinal_Summary → Graceful degradation; Demo Script beat 6_
    - _Requirements: 6.1, 9.1, 9.2, 9.3_

  - [ ] 8.5 `validatePrescription`
    - Rejects any string composed solely of whitespace, including tabs, newlines, and non-breaking spaces; accepts any string with at least one non-whitespace character; returns a field-level reason key
    - Files: `lib/prescriptions/validate.ts`
    - _Design: Error Handling_
    - _Requirements: 10.2_

  - [ ] 8.6 Prescription form, insert, and display on the record
    - Form against the record under review writing `record_id`, `medicines`, `dosage`, `notes` under the doctor-only insert policy
    - Empty `medicines` blocked client-side with a field-level message; the DB `CHECK` is the backstop
    - Existing prescriptions render on the record view
    - Files: `components/doctor/PrescriptionForm.tsx`, `components/doctor/PrescriptionPlate.tsx`, `app/(doctor)/doctor/patients/[id]/page.tsx`
    - _Design: Data Model → Tables (prescriptions); Error Handling_
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 9. Referral_Tracker — demo beats 8 and 9

  - [ ] 9.1 Referral state machine
    - `REFERRAL_TRANSITIONS` as a `satisfies Record<ReferralStatus, readonly ReferralStatus[]>` const, `advanceReferral(from, to)`, and `nextStatus(from)` which drives the board's single advance button
    - Rejections return a **message key** (`referral.error.same` / `.terminal` / `.illegal`), not a sentence, so the reason is localisable and tests assert on stable identifiers
    - Pure: no database, no imports beyond types
    - Files: `lib/referral/machine.ts`
    - _Design: Components and Interfaces → Referral State Machine_
    - _Requirements: 11.3, 11.4, 11.5_

  - [ ] 9.2 Test the Referral_Status state machine
    - Plain Vitest example tests. Requirement 15 floor task, not optional.
    - Assert acceptance of exactly `referred → in_progress` and `in_progress → completed`, and rejection of all seven other ordered pairs with a non-empty reason key and the input status unmodified; `completed` accepts nothing; `nextStatus` returns `null` on `completed`
    - Files: `tests/referral-machine.test.ts`
    - _Design: Testing Strategy_
    - _Requirements: 15.2, 11.3, 11.4_

  - [ ] 9.3 Referral board grouping
    - `groupByStatus` produces exactly three columns, every referral in exactly one, empty columns still present
    - Files: `lib/referral/group.ts`
    - _Design: Components and Interfaces → Referral State Machine_
    - _Requirements: 11.2, 11.5_

  - [ ] 9.4 Referral raise form
    - Inserts a `referrals` row with `patient_id`, `from_facility`, `to_facility_or_specialist`, `reason`, and status `referred`, under the doctor-only insert policy
    - Raised from the Doctor_Panel; the demo case is a district cardiologist
    - Files: `components/doctor/ReferralRaiseForm.tsx`, `app/(doctor)/doctor/patients/[id]/page.tsx`
    - _Design: Demo Script beat 8_
    - _Requirements: 11.1_

  - [ ] 9.5 Referral board with the advance control
    - Three status columns that scroll-snap horizontally at 360px — the one deliberate, contained horizontal-scroll exception in the product
    - Each card renders exactly one advance button labelled with the only legal next state from `nextStatus()`; `completed` cards render none and stay visible as closed
    - An attempted illegal transition shows a rejection plate with the localised reason and **no write is attempted**; the Postgres trigger is the third layer behind the UI and the pure function
    - Files: `app/(doctor)/doctor/referrals/page.tsx`, `components/doctor/ReferralCard.tsx`
    - _Design: Components and Interfaces → Referral State Machine; Demo Script beat 9_
    - _Requirements: 11.2, 11.3, 11.4, 11.5_

- [ ] 10. Checkpoint — beats 6 through 9 walk end to end
  - Run `npx vitest run`; all four Requirement 15 test files must pass.
  - Walk doctor sign-in → Kamla → summary over three prior visits → prescribe → refer → advance the card twice to `completed`.
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. QR identity and the HTTPS origin — demo beat 10

  - [ ] 11.1 QR generation on the patient view
    - `qrcode.toDataURL` into an `<img>` inside a plate; the encoded value is the **bare `qr_id` string**, never a URL, so a generic phone camera sees an opaque string with nowhere to navigate
    - Render patient name, `qr_id` as text, and district alongside the code; reuse `<TokenChit>` for the sheet layout
    - Files: `lib/qr/encode.ts`, `app/(asha)/asha/patients/[id]/page.tsx`, `components/system/QrPlate.tsx`
    - _Design: Components and Interfaces → QR_Module_
    - _Requirements: 12.1_

  - [ ] 11.2 Structural test: no public patient route exists
    - Plain Vitest walking the `app/` tree with `fs` — no `fast-check`, so it is not part of the optional property layer. Kept non-optional because Requirement 12.4 is an explicit security constraint and a negative constraint nothing checks is one a later commit deletes by accident
    - Fails if any route segment named `p` exists, or if any route returning patient data sits outside a route group covered by the middleware matcher
    - Files: `tests/no-public-qr-route.test.ts`
    - _Design: Components and Interfaces → QR_Module (layer 3); Testing Strategy_
    - _Requirements: 12.4_

  - [ ]* 11.3 Print styling for the QR sheet
    - Optional. The QR plate gets its own print route so the sheet is a screen rather than a media-query exercise, with an `@media print` block hiding chrome
    - Files: `app/(asha)/asha/patients/[id]/print/page.tsx`, `app/globals.css`
    - _Design: Risks → Print styling_
    - _Requirements: 12.1_

  - [ ] 11.4 Configure and ship the HTTPS origin
    - **This lands before the scanner, not at the end.** `getUserMedia` needs a secure context; `localhost` qualifies but a phone pointed at a laptop's LAN IP does not, so beat 10 is untestable without it
    - Set the four runtime env vars on the host (excluding `SUPABASE_SERVICE_ROLE_KEY`, which stays local to the seed script), confirm the production build compiles, and sign in on a second device to verify the session
    - Files: `vercel.json`, `next.config.ts`, `.env.example`
    - _Design: Risks → QR scan on a second device; Demo Script beat 10_
    - _Requirements: 12.2_

  - [ ] 11.5 Scanner page with manual entry fallback
    - `html5-qrcode` mounted only on `/asha/scan` and torn down on unmount so the camera actually stops
    - On decode, resolve `qr_id` under RLS: match → navigate to the patient record; no match → a not-found plate with the **scanner still live** for retry
    - Manual `qr_id` text field built at the same time, not as an afterthought, sharing the same resolution path — this is the guaranteed path when a camera is denied or unavailable
    - Files: `app/(asha)/asha/scan/page.tsx`, `lib/qr/scan-reducer.ts`
    - _Design: Components and Interfaces → QR_Module → Scanning_
    - _Requirements: 12.2, 12.3_

- [ ] 12. Bounded offline tolerance — demo beat 11

  - [ ] 12.1 IndexedDB store and the pure queue reducer
    - Database `swasthya-setu` v1, store `writes` with `{ keyPath: 'id', autoIncrement: true }` and a `by-status` index; `QueuedWrite` shape per the design, one `kind: 'intake'`
    - Pure `queue-reducer.ts` holding `planReplay` (keys strictly ascending), the enqueue fold, and the counter derivation — no I/O, so it tests without a browser
    - 50-record cap: beyond it new submissions are refused with a message and nothing is evicted, because losing a captured visit is the one failure this feature exists to prevent
    - Files: `lib/offline/db.ts`, `lib/offline/queue-reducer.ts`
    - _Design: Components and Interfaces → Offline_Queue_
    - _Requirements: 13.2, 13.3_

  - [ ] 12.2 Replay in submission order and counter refresh
    - All queue operations run in the **page context**, not the service worker, because replaying a write needs the authenticated Supabase client and that session lives in the page
    - `autoIncrement` keys are monotonic, so ascending `id` *is* submission order; replay walks sequentially with `await` per write — **never `Promise.all`**, which is the ordering bug
    - A module-scope `replayInFlight` flag prevents overlapping runs from two `online` events
    - On failure: retain the record, increment `attempts`, store `lastError`, set `status: 'failed'`, and **stop the run at that record**. Head-of-line blocking is chosen over skip-and-continue, which would break ordering for later writes on the same patient
    - Triggers are `online`, a `visibilitychange` check, and a manual **Retry sync** control — not a polling interval. `refreshQueueCounters()` recomputes both counts from IndexedDB after every mutation so the badge cannot drift
    - Scoped to an already-signed-in ASHA; no offline sign-in, no conflict resolution, no sync-management screen
    - Files: `lib/offline/replay.ts`, `lib/offline/counters.ts`
    - _Design: Components and Interfaces → Offline_Queue → Replay ordering guarantee_
    - _Requirements: 13.4, 13.5, 13.6_

  - [ ] 12.3 Connectivity_Banner and Pending_Badge
    - Banner is a full-width plate under the app bar, visible at all times: online is quiet with a `--ss-low` rail collapsed to one caption line; offline is `--ss-med-fill` ground with ink text and a 45° ink hazard-stripe rail — the barrier-tape reading needs no words, which matters when the person reading it is not reading
    - Pending_Badge is a chip on the nav sync icon: pending count in `--ss-action`, failure count in `--ss-high` when non-zero, both tabular numerals, both read from the Zustand mirrors
    - Files: `components/shell/ConnectivityBanner.tsx`, `components/shell/PendingBadge.tsx`, `components/shell/AppShell.tsx`
    - _Design: Visual Design System → Responsive and Shell_
    - _Requirements: 13.1, 13.3, 13.5_

  - [ ] 12.4 Offline intake path
    - When the network is gone the client calls `fallbackTriage()` directly — the same pure module the route handler uses — and `selectFacility()` against the cached facility list, so the ASHA still gets a risk level and a facility, not just a queued blob
    - The write is persisted to IndexedDB, the pending badge increments, and the confirmation chit shows **"Token pending — assigned on sync"** in the token slot, since a token cannot be allocated without the database. That reduction is deliberate
    - The app stays interactive throughout
    - Files: `lib/intake/submit-intake.ts`, `app/(asha)/asha/intake/page.tsx`, `app/(asha)/asha/intake/[recordId]/page.tsx`
    - _Design: Components and Interfaces → Offline_Queue → Offline triage and routing; Routing_Engine → Offline behaviour_
    - _Requirements: 13.2, 16.1_

  - [ ]* 12.5 Service worker and web manifest
    - Optional, and distinct from the IndexedDB queue above. Requirement 13.2's letter is satisfied by IndexedDB alone; what this adds is PWA installability and offline cold start. Without it, a hard reload while offline shows the browser's offline page, though the queue survives and drains
    - Hand-written `public/sw.js` registered from a client component in the root layout — build-plugin PWA setups can eat 30+ minutes against Turbopack and the App Router, and the worker this product needs is about 40 lines
    - The worker does **only** caching: precache the shell on `install`, cache-first for static assets, network-first with cache fallback for navigations, **`/api/*` never cached**, drop old versions on `activate`. It does not touch the write queue and does not use Background Sync
    - Files: `public/sw.js`, `public/manifest.webmanifest`, `components/system/ServiceWorkerRegistrar.tsx`, `app/layout.tsx`, `app/offline/page.tsx`
    - _Design: Components and Interfaces → Offline_Queue → Service worker registration_
    - _Requirements: 13.2_

- [ ] 13. Patient view and labelled mock surfaces

  - [ ] 13.1 Patient_View_Switch and the patient screen
    - Header control rendered only when `NEXT_PUBLIC_DEMO_HELPERS=1`; sets `selectedPatientId` in Zustand and navigates to `/patient`. It does **not** create a session and does not bypass the guard — `/patient` stays inside the middleware matcher
    - Patient screen reads the record, appointment, and token for that `patient_id`, reusing `<TokenChit>`
    - Files: `components/system/PatientViewSwitch.tsx`, `app/(patient)/patient/page.tsx`, `components/shell/AppShell.tsx`
    - _Design: Components and Interfaces → Auth_Module; Architecture → Route Groups_
    - _Requirements: 3.5_

  - [ ]* 13.2 Teleconsultation mock
    - Optional. Inserts an `appointments` row with `is_teleconsult = true` plus a `notifications` row of type `teleconsult`, then displays the slot. No video session
    - Wrapped in `<MockPlate>`, which is the layout rather than a decoration on it
    - Files: `app/(mock)/teleconsult/page.tsx`
    - _Design: Components and Interfaces → Mock Features_
    - _Requirements: 14.1, 14.2_

  - [ ]* 13.3 Ambulance / SOS mock
    - Optional. Inserts a `notifications` row (`type = 'emergency'`, `channel = 'sms'`), then renders a simulated dispatch timeline from static steps inside `<MockPlate>`
    - Files: `components/mock/SosPlate.tsx`, `app/(asha)/asha/page.tsx`
    - _Design: Components and Interfaces → Mock Features_
    - _Requirements: 14.1, 14.3_

  - [ ]* 13.4 Government aggregate dashboard
    - Optional. Aggregates seeded rows client-side: counts by `risk_level`, by facility, and referral throughput. If the clock runs out this degrades to a single stats plate with four numbers and a Mock_Badge
    - Files: `app/(mock)/dashboard/page.tsx`, `lib/mock/aggregate.ts`
    - _Design: Components and Interfaces → Mock Features_
    - _Requirements: 14.1, 14.4_

  - [ ]* 13.5 Stock and hotspot heuristic charts
    - Optional. CSS bar plates over seeded rows, no chart library — a chart library is 20 minutes of configuration for a mocked heuristic, and its defaults fight the enamel identity
    - Document the heuristic on screen: stock = `quantity` against a seeded reorder threshold; hotspot = `health_records` per village over 90 days bucketed into three bands. Labelled "v1 heuristic over seed data, not a trained model"
    - Files: `components/mock/StockBars.tsx`, `components/mock/HotspotBands.tsx`, `app/(mock)/dashboard/page.tsx`
    - _Design: Components and Interfaces → Mock Features_
    - _Requirements: 14.1, 14.5_

- [ ] 14. Property-based test layer with fast-check

  - [ ]* 14.1 Triage properties
    - Optional. Add `fast-check`, minimum 100 runs per property, each carrying the tag comment `// Feature: swasthya-setu, Property {n}: {property text}` so a failure points back to design.md
    - **Property 1: Triage always resolves** — **Validates: Requirements 5.1, 5.3, 16.5**
    - **Property 2: Fallback triage never under-triages an unmatched complaint** — **Validates: Requirements 5.3, 16.5**
    - **Property 14: Only text reaches Gemini** — **Validates: Requirements 16.4**
    - Files: `tests/triage-parse.test.ts`, `tests/gemini-request.test.ts`, `tests/fallback-triage.test.ts`
    - _Design: Correctness Properties; Testing Strategy_

  - [ ]* 14.2 Routing and referral properties
    - Optional.
    - **Property 4: Facility selection respects risk eligibility and distance** — **Validates: Requirements 8.1, 8.5**
    - **Property 5: Token numbers are strictly increasing per facility** — **Validates: Requirements 8.3**
    - **Property 6: Referral transitions are total and exclusive** — **Validates: Requirements 11.1, 11.3, 11.4, 11.5**
    - **Property 7: The referral board partitions its input** — **Validates: Requirements 11.2, 11.5**
    - Files: `tests/select-facility.test.ts`, `tests/token.test.ts`, `tests/referral-machine.test.ts`, `tests/referral-board.test.ts`
    - _Design: Correctness Properties; Testing Strategy_

  - [ ]* 14.3 Record, summary, and prescription properties
    - Optional.
    - **Property 3: The health record insert payload is complete** — **Validates: Requirements 5.2, 5.4**
    - **Property 8: Prescription validation rejects all whitespace** — **Validates: Requirements 10.2**
    - **Property 9: History trimming preserves recency within its caps** — **Validates: Requirements 9.2**
    - **Property 10: Record display order is a permutation** — **Validates: Requirements 9.1**
    - **Property 11: Summary failure degrades to the raw history** — **Validates: Requirements 9.3, 16.5**
    - Files: `tests/summary-trim.test.ts`, `tests/prescription.test.ts`, `tests/record-order.test.ts`
    - _Design: Correctness Properties; Testing Strategy_

  - [ ]* 14.4 Offline queue properties
    - Optional.
    - **Property 12: Replay preserves submission order and drains the queue** — **Validates: Requirements 13.4, 13.5, 16.1**
    - **Property 13: Queue counters equal queue contents** — **Validates: Requirements 13.2, 13.3, 16.1**
    - Files: `tests/queue.test.ts`
    - _Design: Correctness Properties; Testing Strategy_

  - [ ]* 14.5 Voice and QR properties
    - Optional.
    - **Property 19: Voice selection never returns a mismatched voice** — **Validates: Requirements 7.2, 7.3**
    - **Property 20: Voice guidance always carries the advisory** — **Validates: Requirements 6.3**
    - **Property 21: Voice failure never closes the intake path** — **Validates: Requirements 4.5**
    - **Property 22: Unmatched scans keep the scanner alive** — **Validates: Requirements 12.3**
    - **Property 15: The QR payload is opaque and no public patient route exists** — **Validates: Requirements 12.1, 12.4**
    - Files: `tests/voice.test.ts`, `tests/qr.test.ts`
    - _Design: Correctness Properties; Testing Strategy_

  - [ ]* 14.6 System-level properties: i18n, contrast, routing, aggregates
    - Optional.
    - **Property 16: Both locales resolve every key, and only two locales exist** — **Validates: Requirements 2.2, 16.2**
    - **Property 17: Declared token pairings meet their contrast thresholds** — **Validates: Requirements 2.1, 2.4**
    - **Property 18: Role routing is total** — **Validates: Requirements 3.2, 3.3, 3.4**
    - **Property 23: Dashboard aggregates conserve their input** — **Validates: Requirements 14.4**
    - Files: `tests/i18n.test.ts`, `tests/tokens.test.ts`, `tests/auth-routing.test.ts`, `tests/dashboard.test.ts`
    - _Design: Correctness Properties; Testing Strategy_

- [ ] 15. Final checkpoint — full demo rehearsal
  - Run `npx vitest run` in single-run mode and confirm a passing report.
  - Walk all eleven demo beats on the deployed HTTPS origin from Android Chrome, in order, against a freshly reseeded database.
  - Confirm every mocked surface carries its badge and that no unauthenticated route returns patient data.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- **The four Requirement 15 tests (5.2, 5.5, 5.7, 9.2) are deliberately not marked optional.** They are the floor, they are plain Vitest with no mocks, and each sits immediately after the pure module it covers. Only the `fast-check` layer in Task 14 is optional.
- **Task 11.2 is also non-optional** despite being a test, because Requirement 12.4 is an explicit security constraint and it is a plain `fs` walk rather than a property test.
- Tasks marked `*` can be skipped without breaking anything: print styling, the service worker (distinct from the IndexedDB queue), the four mock surfaces, and the whole property layer.
- **Cut order if the clock runs out**, per the design's risk register: Task 14 first, then 13.5 → 13.4 → 13.3 → 13.2, then 12.5, then 11.3, then beat 11 (Task 12) entirely. Nothing in Tasks 1 through 10 is cuttable — that is the demo.
- Task 2 must complete before Task 6. Task 11.4 must complete before Task 11.5.
- Every task leaves a runnable build; the checkpoints at 7, 10, and 15 are where that gets verified rather than assumed.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0,  "tasks": ["1.1"] },
    { "id": 1,  "tasks": ["1.2"] },
    { "id": 2,  "tasks": ["2.1"] },
    { "id": 3,  "tasks": ["2.2", "3.1"] },
    { "id": 4,  "tasks": ["2.3", "3.2"] },
    { "id": 5,  "tasks": ["3.3", "4.1"] },
    { "id": 6,  "tasks": ["3.4", "4.2"] },
    { "id": 7,  "tasks": ["3.5", "4.3", "5.1"] },
    { "id": 8,  "tasks": ["4.4", "5.2", "5.4"] },
    { "id": 9,  "tasks": ["4.5", "5.3", "5.5", "5.6"] },
    { "id": 10, "tasks": ["5.7", "6.1"] },
    { "id": 11, "tasks": ["6.2"] },
    { "id": 12, "tasks": ["6.3"] },
    { "id": 13, "tasks": ["6.4"] },
    { "id": 14, "tasks": ["6.5"] },
    { "id": 15, "tasks": ["6.6"] },
    { "id": 16, "tasks": ["6.7", "8.1", "9.1"] },
    { "id": 17, "tasks": ["8.2", "8.5", "9.2", "9.3"] },
    { "id": 18, "tasks": ["8.3"] },
    { "id": 19, "tasks": ["8.4"] },
    { "id": 20, "tasks": ["8.6"] },
    { "id": 21, "tasks": ["9.4"] },
    { "id": 22, "tasks": ["9.5", "11.1"] },
    { "id": 23, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 24, "tasks": ["11.5", "12.1"] },
    { "id": 25, "tasks": ["12.2", "13.1"] },
    { "id": 26, "tasks": ["12.3", "12.5"] },
    { "id": 27, "tasks": ["12.4", "13.2", "13.4"] },
    { "id": 28, "tasks": ["13.3", "13.5", "14.1"] },
    { "id": 29, "tasks": ["14.2", "14.3", "14.4"] },
    { "id": 30, "tasks": ["14.5", "14.6"] }
  ]
}
```
