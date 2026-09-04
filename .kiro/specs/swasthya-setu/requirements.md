# Requirements Document

## Introduction

Swasthya Setu is a web-based, offline-tolerant rural healthcare access platform built as a Smart India Hackathon 2026 MVP (Team Zenith, PS ID 26133). The platform gives three first-class roles — Patient, ASHA/ANM, and Doctor — access to one continuous longitudinal health record per patient, so that symptoms, vitals, history, decisions, and referrals follow the patient across visits instead of resetting at each facility. Tagline: Right Patient → Right Care → Right Facility → Right Time.

The demo narrative runs in one line: a patient enters symptoms alone and receives triage guidance → an ASHA/ANM assists that same patient, adding vitals and booking an appointment → a doctor reviews the AI summary and records a clinical decision, a prescription, and a referral → the patient sees the appointment, the referral status, and the doctor's decision in the same record. All three roles read and write the same patient record. The active role changes which capabilities are offered, never which record is authoritative.

Roles are reached through a demo role switcher over seeded identities. There is no signup and no OTP verification, and the build holds seeded demonstration data only.

The build budget is approximately four hours. The core path is: (A) patient self-service intake and ASHA-assisted intake with vitals, AI triage, and a deterministic fallback, (B) the doctor panel with an AI longitudinal summary, a distinctly recorded clinical decision, prescription, and referral raise, and (C) closed-loop referral tracking with patient-side status visibility. Voice capture, voice readback, and QR identity are retained here as stretch capabilities outside the core path. Every other capability listed here is deliberately reduced or mocked, and this document records the reduced form as the requirement. Requirements outside this document are out of scope for the MVP.

## Glossary

- **Swasthya_Setu**: The Next.js 15 App Router PWA and the Supabase backend that together form the platform.
- **Seed_Loader**: The versioned SQL/script artifact that populates the Supabase database with demo rows.
- **Design_System**: The Tailwind and shadcn/ui token layer (color, type scale, spacing, radius, elevation) that defines the platform's committed visual identity.
- **App_Shell**: The persistent layout, header, and icon-first navigation surface of Swasthya_Setu.
- **Auth_Module**: The Supabase Auth integration plus the role-based route guards of Swasthya_Setu.
- **ASHA_User**: A signed-in health worker whose `health_workers.role` is `asha`.
- **Doctor_User**: A signed-in health worker whose `health_workers.role` is `doctor`.
- **Patient_User**: A signed-in demo role acting on their own `patients` row, with no ASHA_User and no Doctor_User taking part.
- **Role_Switcher**: The App_Shell demo control that sets Active_Role to Patient_User, ASHA_User, or Doctor_User.
- **Active_Role**: The role currently selected through Role_Switcher, which determines the workspace and the capabilities Swasthya_Setu offers.
- **Assisted_Session**: A session in which an ASHA_User acts on behalf of one named patient, writing to that patient's Shared_Record.
- **Shared_Record**: The single set of `health_records`, `appointments`, `referrals`, and `prescriptions` rows keyed to one `patients` row, read and written by all three roles.
- **Record_Author**: The authoring role and authoring identity stored on a Shared_Record entry.
- **Vitals**: The ASHA-recorded measurements — blood pressure, pulse, temperature, SpO2, weight — attached to a `health_records` row.
- **Patient_Picker**: The patient selection control, with inline patient creation, that sits above the symptom intake form.
- **Voice_Module**: The browser Web Speech API wrapper of Swasthya_Setu, covering SpeechRecognition for capture and SpeechSynthesis for readback.
- **Supported_Language**: One of exactly two BCP-47 locales, `en-IN` and `hi-IN`.
- **Triage_Engine**: The server-side component that sends a symptom transcript as text to the Gemini API and returns a structured triage result.
- **Fallback_Triage**: The deterministic keyword-matching classifier inside Triage_Engine that produces a triage result without any network inference call.
- **Triage_Result**: A structured object containing a Risk_Level and a plain-language summary string.
- **Risk_Level**: One of `low`, `medium`, or `high`.
- **Routing_Engine**: The component that selects a facility from the seeded facility list and assigns a Token_Number.
- **Token_Number**: A per-facility sequential integer computed when an `appointments` row is inserted.
- **Facility_Type**: One of the seeded facility categories (`phc`, `chc`, `district_hospital`).
- **Doctor_Panel**: The doctor-facing patient detail screen of Swasthya_Setu.
- **Longitudinal_Summary**: A Gemini-generated text summary synthesizing a patient's prior `health_records` rows plus the current complaint.
- **Clinical_Decision**: A Doctor_User's recorded final assessment and plan for a `health_records` row, stored and displayed distinctly from Triage_Result.
- **Referral_Tracker**: The component that persists and displays `referrals` rows as a status board.
- **Referral_Status**: One of `referred`, `in_progress`, or `completed`.
- **QR_Module**: The QR generation and camera-scan component of Swasthya_Setu.
- **Offline_Queue**: The service worker plus IndexedDB write queue of Swasthya_Setu.
- **Connectivity_Banner**: The persistent online/offline indicator rendered in App_Shell.
- **Pending_Badge**: The App_Shell counter showing the number of unsynced writes held in Offline_Queue.
- **Stretch_Capability**: A capability retained in this document but excluded from the core demo path, so that every core flow completes without it.
- **Mock_Feature**: A capability that is demonstrated with simulated behavior only and carries a Mock_Badge.
- **Mock_Badge**: A visible UI label identifying a Mock_Feature as simulated.
- **Test_Suite**: The Vitest unit test suite of Swasthya_Setu.

## Requirements

### Requirement 1: Seeded Schema and Demo Data

**User Story:** As a demo presenter, I want a database that is already populated with a believable Wardha-district scenario, so that every flow shows meaningful content on first load.

#### Acceptance Criteria

1. THE Swasthya_Setu SHALL define Supabase Postgres tables `patients` (demographics, `preferred_language`, `qr_id`), `health_workers` (`role`, `facility_id`), `facilities` (`name`, `location`, `type`, `current_queue_length`), `health_records` (`patient_id`, `symptoms`, `ai_triage_summary`, `risk_level`, `timestamp`), `appointments` (`patient_id`, `facility_id`, `token_number`, `status`), `referrals` (`patient_id`, `from_facility`, `to_facility_or_specialist`, `status`), `prescriptions` (`record_id`, `medicines`, `dosage`, `notes`), `medicine_stock` (`facility_id`, `medicine`, `quantity`), and `notifications` (`patient_id`, `type`, `channel`).
2. THE Seed_Loader SHALL insert a patient named Kamla, age 34, Wardha district, with a populated `preferred_language` and `qr_id`.
3. THE Seed_Loader SHALL insert at least three `health_records` rows for Kamla, each with distinct symptoms, `ai_triage_summary`, `risk_level`, and `timestamp` values, sufficient for a Longitudinal_Summary to reference prior visits.
4. THE Seed_Loader SHALL insert at least three Wardha-district `facilities` rows covering at least two distinct Facility_Type values.
5. THE Seed_Loader SHALL insert `medicine_stock` rows for the seeded facilities.
6. WHEN the Seed_Loader runs a second time against the same database, THE Seed_Loader SHALL leave the row count of each seeded table unchanged.

### Requirement 2: Committed Visual Identity and Icon-First Shell

**User Story:** As a low-literacy field user, I want a distinctive, icon-led interface, so that I can navigate by recognition rather than by reading.

#### Acceptance Criteria

1. THE Design_System SHALL define named tokens for color, type scale, spacing, radius, and elevation, and THE Swasthya_Setu SHALL consume those tokens instead of default shadcn/ui values.
2. THE App_Shell SHALL render every primary navigation destination as an icon paired with a text label in the active Supported_Language.
3. THE App_Shell SHALL render interactive controls with a minimum hit area of 44 by 44 CSS pixels.
4. THE Design_System SHALL maintain a contrast ratio of at least 4.5:1 for body text and at least 3:1 for large text and icon glyphs against their backgrounds.

### Requirement 3: Three Demo Roles and Role Routing

**User Story:** As a demo presenter, I want Patient, ASHA/ANM, and Doctor each reachable as a first-class role without any signup, so that the whole care journey can be shown in one sitting.

#### Acceptance Criteria

1. THE Seed_Loader SHALL create exactly three demo identities: one Patient_User linked to a seeded `patients` row, one ASHA_User linked to a `health_workers` row whose `role` is `asha`, and one Doctor_User linked to a `health_workers` row whose `role` is `doctor`.
2. THE Auth_Module SHALL admit a user only through a seeded demo identity, and THE Swasthya_Setu SHALL exclude self-signup, email verification, and OTP verification from the MVP.
3. WHEN a user selects a role in the Role_Switcher, THE Auth_Module SHALL set Active_Role to the selected role and SHALL route the user to the workspace of that role: the patient workspace for Patient_User, the ASHA workspace for ASHA_User, and the Doctor_Panel workspace for Doctor_User.
4. THE Auth_Module SHALL derive from Active_Role only which capabilities Swasthya_Setu offers, and THE Auth_Module SHALL resolve patient data for every Active_Role value from the same Shared_Record.
5. IF an unauthenticated visitor requests a role-guarded route, THEN THE Auth_Module SHALL redirect the visitor to the sign-in screen.
6. WHILE Active_Role is Patient_User, THE Swasthya_Setu SHALL scope every patient data query to the `patient_id` of that Patient_User.
7. THE Swasthya_Setu SHALL enforce Supabase row level security policies keyed on role for every table listed in Requirement 1.
8. THE App_Shell SHALL display a notice on the Role_Switcher stating that role switching is a hackathon demonstration affordance and not authentication, and THE Swasthya_Setu SHALL restrict stored patient data to seeded demonstration records.

### Requirement 4: Shared Longitudinal Record Across All Three Roles

**User Story:** As a patient whose care spans an ASHA visit and a doctor visit, I want every role writing to one record of mine, so that my history stays continuous no matter who entered it.

#### Acceptance Criteria

1. THE Swasthya_Setu SHALL maintain exactly one Shared_Record per `patients` row, regardless of how many roles have written to that Shared_Record.
2. WHEN any Active_Role writes a `health_records`, `appointments`, `referrals`, or `prescriptions` row for a patient, THE Swasthya_Setu SHALL key that row to the patient's `patient_id` and SHALL make the row readable to every other Active_Role viewing that same patient.
3. THE Swasthya_Setu SHALL store a Record_Author on every `health_records` row it creates, carrying the authoring role and the authoring identity.
4. WHEN a Patient_User opens their own record timeline, THE Swasthya_Setu SHALL display entries authored by an ASHA_User and by a Doctor_User alongside entries the Patient_User authored, each labeled with its Record_Author.
5. WHEN an ASHA_User or a Doctor_User opens a patient, THE Swasthya_Setu SHALL display entries authored by that patient as a Patient_User in the same timeline.
6. THE Swasthya_Setu SHALL resolve every role's read of a patient to the same `patient_id` keyed rows, and THE Swasthya_Setu SHALL exclude per-role copies of patient data from the MVP.

### Requirement 5: Symptom Intake for Self and Assisted Use

**User Story:** As a Patient_User or an ASHA_User, I want one intake form that works whether I am describing my own symptoms or another person's, so that intake does not depend on a health worker being present.

#### Acceptance Criteria

1. THE Swasthya_Setu SHALL make the intake screen reachable by a Patient_User for their own `patients` row and by an ASHA_User for a patient selected in the Patient_Picker.
2. THE Patient_Picker SHALL list seeded patients and SHALL provide inline creation of a new `patients` row with demographics and `preferred_language` from within the intake screen.
3. WHILE Active_Role is ASHA_User and no patient is selected in the Patient_Picker, THE Swasthya_Setu SHALL keep the symptom capture control disabled.
4. WHILE Active_Role is Patient_User, THE Swasthya_Setu SHALL set the intake subject to the `patient_id` of that Patient_User and SHALL hide the Patient_Picker.
5. THE Swasthya_Setu SHALL accept a typed symptom transcript as the core intake path for both a Patient_User and an ASHA_User.
6. WHERE voice capture is offered as a Stretch_Capability, WHEN a user starts voice capture, THE Voice_Module SHALL run SpeechRecognition in the selected Supported_Language and SHALL display the interim transcript.
7. THE Swasthya_Setu SHALL allow the submitting user to edit the captured transcript as text before submission.
8. IF the browser exposes no SpeechRecognition support or SpeechRecognition returns an error, THEN THE Swasthya_Setu SHALL display a text entry field for the symptom transcript and SHALL keep the intake flow available.

### Requirement 6: Patient Self-Service Intake

**User Story:** As a patient with a phone and no ASHA nearby, I want to enter my own symptoms and receive guidance, so that I can start care on my own.

#### Acceptance Criteria

1. THE Swasthya_Setu SHALL offer a Patient_User a language control listing exactly the Supported_Language values.
2. WHEN a Patient_User selects a Supported_Language, THE Swasthya_Setu SHALL persist the selection to that patient's `preferred_language` and SHALL render App_Shell text in the selected Supported_Language.
3. WHEN a Patient_User opens Swasthya_Setu in a later session, THE Swasthya_Setu SHALL apply the stored `preferred_language` as the active Supported_Language.
4. THE Swasthya_Setu SHALL allow a Patient_User to enter their own symptom transcript, age, sex, and village without an ASHA_User or a Doctor_User taking part.
5. WHEN a Patient_User submits a symptom transcript, THE Triage_Engine SHALL return a Triage_Result and THE Swasthya_Setu SHALL write the resulting `health_records` row to that patient's Shared_Record with Record_Author set to the Patient_User.
6. WHEN a Triage_Result is displayed to a Patient_User, THE Swasthya_Setu SHALL present the Triage_Result as decision support with the advisory notice of Requirement 10 and SHALL state the recommended next step.

### Requirement 7: Assisted Intake by an ASHA_User

**User Story:** As an ASHA_User visiting a patient who cannot use the app, I want to complete intake on that patient's behalf, so that the patient still gets a record, a triage result, and an appointment.

#### Acceptance Criteria

1. WHEN an ASHA_User selects a patient in the Patient_Picker, THE Swasthya_Setu SHALL open an Assisted_Session naming that patient as the subject and SHALL display the subject's name on the intake screen.
2. WHILE an Assisted_Session is active, THE Swasthya_Setu SHALL write every intake row with `patient_id` set to the named patient and with Record_Author set to the ASHA_User.
3. WHEN an ASHA_User registers a new patient from the Patient_Picker, THE Swasthya_Setu SHALL insert a `patients` row and SHALL open an Assisted_Session for the new patient.
4. WHEN an Assisted_Session write completes, THE Swasthya_Setu SHALL make the written row visible in that patient's Patient_User views without any further action by the ASHA_User.
5. WHILE an Assisted_Session is active, THE Swasthya_Setu SHALL display the subject patient's Shared_Record timeline to the ASHA_User.

### Requirement 8: Vitals Capture

**User Story:** As an ASHA_User, I want to record the measurements I take in the field next to the symptoms, so that the doctor sees objective values with the complaint.

#### Acceptance Criteria

1. THE Swasthya_Setu SHALL offer an ASHA_User Vitals fields for blood pressure, pulse, temperature, SpO2, and weight on the intake screen.
2. WHEN an ASHA_User submits intake carrying one or more Vitals values, THE Swasthya_Setu SHALL store the submitted Vitals on the `health_records` row created by that intake.
3. THE Swasthya_Setu SHALL treat every Vitals field as optional.
4. WHEN an ASHA_User submits intake carrying no Vitals value, THE Swasthya_Setu SHALL create the `health_records` row and SHALL complete the intake flow.
5. IF a submitted Vitals value is non-numeric in a field that stores a number, THEN THE Swasthya_Setu SHALL display a field-level validation message and SHALL retain the other entered values.
6. WHEN a Doctor_User or a Patient_User views a `health_records` row carrying Vitals, THE Swasthya_Setu SHALL display the stored Vitals with that entry.

### Requirement 9: AI Triage With Deterministic Fallback

**User Story:** As a Patient_User or an ASHA_User, I want a structured risk assessment from the described complaint, so that I know how urgently care is needed.

#### Acceptance Criteria

1. WHEN a Patient_User or an ASHA_User submits a symptom transcript, THE Triage_Engine SHALL send the transcript as text to the Gemini API and SHALL return a Triage_Result containing one Risk_Level and one plain-language summary.
2. WHEN THE Triage_Engine returns a Triage_Result, THE Swasthya_Setu SHALL insert a `health_records` row carrying `patient_id`, `symptoms`, `ai_triage_summary`, `risk_level`, and `timestamp`.
3. IF the Gemini API returns an error, returns unparseable output, or exceeds a 10 second timeout, THEN THE Triage_Engine SHALL return a Triage_Result produced by Fallback_Triage and SHALL complete the intake flow.
4. WHERE a Triage_Result originates from Fallback_Triage, THE Swasthya_Setu SHALL display a label identifying the result as a keyword-based fallback assessment.
5. WHILE the Triage_Engine awaits a response, THE Swasthya_Setu SHALL display a progress indicator on the intake screen.

### Requirement 10: Advisory Framing of AI Output Against Clinical Decision

**User Story:** As a patient or frontline worker, I want AI output presented as guidance and the doctor's judgement presented as the decision, so that clinical authority stays with a qualified professional.

#### Acceptance Criteria

1. THE Swasthya_Setu SHALL display an advisory notice adjacent to every rendered Risk_Level, `ai_triage_summary`, and Longitudinal_Summary, stating that the content is AI-generated decision support and is not a medical diagnosis.
2. THE Swasthya_Setu SHALL present a Risk_Level as a triage priority indicator and SHALL attribute the value to the Triage_Engine in the surrounding label.
3. WHERE the Voice_Module reads a Triage_Result aloud, THE Voice_Module SHALL include the advisory notice in the spoken output.
4. THE Swasthya_Setu SHALL label a Triage_Result as the AI suggestion and SHALL label a Clinical_Decision as the doctor's decision on every screen where either appears.
5. WHERE a Clinical_Decision exists for a `health_records` row, THE Swasthya_Setu SHALL render the Clinical_Decision with visual prominence equal to or greater than the Triage_Result for that row.
6. THE Swasthya_Setu SHALL present a Triage_Result to a Patient_User as guidance toward a next step and SHALL state that a Doctor_User records the deciding assessment.

### Requirement 11: Voice Guidance Readback (Stretch_Capability)

**User Story:** As a patient who cannot read, I want the guidance spoken back in my own language, so that I understand what to do next.

#### Acceptance Criteria

1. WHEN a Triage_Result is displayed, THE Voice_Module SHALL offer SpeechSynthesis playback of the plain-language summary and the recommended next step.
2. THE Voice_Module SHALL select the SpeechSynthesis voice locale from the selected patient's `preferred_language`, constrained to a Supported_Language.
3. IF the browser exposes no SpeechSynthesis voice for the requested Supported_Language, THEN THE Voice_Module SHALL display the guidance as on-screen text and SHALL report the unavailable playback to the user.
4. THE Swasthya_Setu SHALL treat Voice_Module capture and playback as a Stretch_Capability, and THE Swasthya_Setu SHALL keep every core flow completable through typed entry and on-screen text alone.

### Requirement 12: Risk-Based Facility Routing and Token Assignment

**User Story:** As a patient, I want to be sent to a facility that matches my risk level with a queue position already assigned, so that I avoid unnecessary travel and waiting.

#### Acceptance Criteria

1. WHEN a Triage_Result is persisted, THE Routing_Engine SHALL select one facility from the seeded `facilities` rows by matching Risk_Level to Facility_Type and by choosing the nearest match on the stored `location` value.
2. WHEN THE Routing_Engine selects a facility, THE Routing_Engine SHALL insert an `appointments` row with `patient_id`, `facility_id`, a computed Token_Number, and `status`.
3. THE Routing_Engine SHALL compute Token_Number as the next sequential integer among existing `appointments` rows for the same `facility_id`.
4. THE Swasthya_Setu SHALL display the selected facility name, Facility_Type, and Token_Number on the intake confirmation screen.
5. THE Routing_Engine SHALL derive facility selection from the seeded static facility list, and THE Swasthya_Setu SHALL exclude any Supabase Realtime queue subscription from the routing path.
6. WHEN an ASHA_User books an appointment for the subject patient of an Assisted_Session, THE Routing_Engine SHALL insert an `appointments` row with the ASHA-selected `facility_id`, a computed Token_Number, and `status`.
7. THE Swasthya_Setu SHALL offer an ASHA_User explicit appointment booking in addition to the automatic assignment that follows a persisted Triage_Result.

### Requirement 13: Patient Status Visibility

**User Story:** As a patient, I want to see my own appointment, token, referral status, and record timeline, so that I know where to go and what has happened without asking anyone.

#### Acceptance Criteria

1. WHEN a Patient_User opens the patient workspace, THE Swasthya_Setu SHALL display that patient's most recent `appointments` row with the facility name, Facility_Type, and Token_Number.
2. WHEN a Patient_User opens the patient workspace, THE Swasthya_Setu SHALL display the Referral_Status of every `referrals` row belonging to that patient.
3. WHEN a Patient_User opens their record timeline, THE Swasthya_Setu SHALL display that patient's `health_records` rows in reverse chronological order, each with its Record_Author, Risk_Level, stored Vitals, stored Clinical_Decision, and stored prescription.
4. THE Swasthya_Setu SHALL restrict every query issued by the patient workspace to the `patient_id` of the signed-in Patient_User.
5. WHEN an ASHA_User or a Doctor_User writes an appointment, a referral, a prescription, or a health record for a patient, THE Swasthya_Setu SHALL reflect that write in the Patient_User views of the same patient on the next load.
6. IF a Patient_User has no `appointments` row or no `referrals` row, THEN THE Swasthya_Setu SHALL display an empty-state message naming the next action available to that Patient_User.

### Requirement 14: Doctor Panel Longitudinal Summary

**User Story:** As a Doctor_User, I want a synthesized history of a patient's prior visits alongside the current complaint, so that I can act without reading every past record.

#### Acceptance Criteria

1. WHEN a Doctor_User opens a patient in the Doctor_Panel, THE Doctor_Panel SHALL display that patient's `health_records` rows in reverse chronological order.
2. WHEN a Doctor_User opens a patient in the Doctor_Panel, THE Doctor_Panel SHALL request a Longitudinal_Summary that synthesizes the patient's prior `health_records` rows and the most recent complaint, and SHALL display the returned summary.
3. IF the Longitudinal_Summary request fails or exceeds a 10 second timeout, THEN THE Doctor_Panel SHALL display the raw `health_records` list together with a notice that the summary is unavailable.

### Requirement 15: Clinical Decision by a Doctor_User

**User Story:** As a Doctor_User, I want my final assessment recorded separately from the AI suggestion, so that the record shows the AI advising and the clinician deciding.

#### Acceptance Criteria

1. THE Doctor_Panel SHALL offer a Doctor_User a form to record a Clinical_Decision containing a final assessment and a plan for the `health_records` row under review.
2. WHEN a Doctor_User submits a Clinical_Decision, THE Swasthya_Setu SHALL store the Clinical_Decision against that `health_records` row with the Doctor_User as Record_Author and with a timestamp.
3. THE Swasthya_Setu SHALL store a Clinical_Decision in fields separate from `ai_triage_summary` and `risk_level`, and THE Swasthya_Setu SHALL retain the stored `ai_triage_summary` and `risk_level` values after a Clinical_Decision is stored.
4. WHEN a Clinical_Decision exists for a `health_records` row, THE Doctor_Panel SHALL display the Clinical_Decision and the Triage_Result as two distinctly labeled blocks on that record view.
5. WHERE a Clinical_Decision states a Risk_Level that differs from the Triage_Result Risk_Level, THE Swasthya_Setu SHALL display both values side by side and SHALL retain the Triage_Engine value on the `health_records` row.
6. IF a Doctor_User submits a Clinical_Decision with an empty assessment value, THEN THE Swasthya_Setu SHALL reject the submission and SHALL display a field-level validation message.
7. WHEN a Clinical_Decision is stored, THE Swasthya_Setu SHALL display that Clinical_Decision in the Patient_User views of the same patient's Shared_Record.

### Requirement 16: Prescription Authoring

**User Story:** As a Doctor_User, I want to write a prescription against the visit I am reviewing, so that the patient leaves with a recorded treatment plan.

#### Acceptance Criteria

1. WHEN a Doctor_User submits a prescription form, THE Swasthya_Setu SHALL insert a `prescriptions` row with `record_id`, `medicines`, `dosage`, and `notes`.
2. IF a Doctor_User submits a prescription form with an empty `medicines` value, THEN THE Swasthya_Setu SHALL reject the submission and SHALL display a field-level validation message.
3. WHEN a `prescriptions` row exists for a `health_records` row, THE Swasthya_Setu SHALL display that prescription on the patient's record view.

### Requirement 17: Closed-Loop Referral Tracking

**User Story:** As a Doctor_User, I want referrals tracked to completion on a board, so that no referred patient is lost between facilities.

#### Acceptance Criteria

1. WHEN a Doctor_User raises a referral, THE Referral_Tracker SHALL insert a `referrals` row with `patient_id`, `from_facility`, `to_facility_or_specialist`, and Referral_Status set to `referred`.
2. THE Referral_Tracker SHALL display `referrals` rows grouped into one column per Referral_Status value.
3. WHEN a user advances a referral, THE Referral_Tracker SHALL permit only the transitions `referred` to `in_progress` and `in_progress` to `completed`.
4. IF a transition other than the two permitted transitions is requested, THEN THE Referral_Tracker SHALL reject the transition, SHALL leave the stored Referral_Status unchanged, and SHALL display the rejection reason.
5. WHEN a Referral_Status reaches `completed`, THE Referral_Tracker SHALL display the referral as closed and SHALL keep the referral visible in the `completed` column.

### Requirement 18: Patient QR Identity Within Authenticated Sessions (Stretch_Capability)

**User Story:** As an ASHA_User, I want to pull up the right patient by scanning a QR code, so that identification is fast in the field without exposing health records publicly.

#### Acceptance Criteria

1. THE QR_Module SHALL render a QR code encoding the `qr_id` of a selected patient, and THE Swasthya_Setu SHALL make that QR code printable from the patient view.
2. WHILE an ASHA_User or Doctor_User session is authenticated, THE QR_Module SHALL resolve a scanned `qr_id` to the matching `patients` row and SHALL open that patient's record.
3. IF a scanned value matches no `patients.qr_id` row, THEN THE QR_Module SHALL display a not-found message and SHALL keep the scanner available for a retry.
4. THE Swasthya_Setu SHALL restrict every route that returns patient health data to an authenticated session held by an ASHA_User, a Doctor_User, or the Patient_User who owns that record. As an explicit security constraint, Swasthya_Setu SHALL NOT ship a public unauthenticated QR landing route, including any `/p/{qr_id}` route, because such a route would disclose a full health record to any holder of the link.
5. THE Swasthya_Setu SHALL treat QR_Module generation and scanning as a Stretch_Capability, and THE Swasthya_Setu SHALL keep patient selection completable through the Patient_Picker alone.

### Requirement 19: Bounded Offline Tolerance

**User Story:** As an ASHA_User working in a low-connectivity village, I want my submissions to survive a dropped connection, so that I never lose a captured visit.

#### Acceptance Criteria

1. THE Connectivity_Banner SHALL display the current online or offline state of the browser in App_Shell at all times.
2. WHILE the browser reports an offline state and an ASHA_User session is already signed in, THE Offline_Queue SHALL persist submitted intake writes to IndexedDB and SHALL keep the application interactive.
3. WHILE Offline_Queue holds unsynced writes, THE Pending_Badge SHALL display the count of those writes.
4. WHEN the browser transitions from offline to online, THE Offline_Queue SHALL replay queued writes to Supabase in submission order and SHALL decrement the Pending_Badge count for each acknowledged write.
5. IF a queued write fails during replay, THEN THE Offline_Queue SHALL retain that write in IndexedDB and SHALL display the failure count.
6. THE Offline_Queue SHALL be limited to queueing and replay for an already-signed-in ASHA_User, and THE Swasthya_Setu SHALL exclude offline sign-in, merge conflict resolution, and any sync management screen from the MVP.

### Requirement 20: Visibly Labeled Mock Features

**User Story:** As a hackathon judge, I want simulated capabilities clearly marked, so that I can tell the working system apart from the demonstration stubs.

#### Acceptance Criteria

1. THE Swasthya_Setu SHALL render a Mock_Badge on every screen and card belonging to a Mock_Feature.
2. WHEN a user requests a teleconsultation, THE Swasthya_Setu SHALL create a scheduled slot record and SHALL display the scheduled slot as a Mock_Feature without opening a video session.
3. WHEN a user triggers ambulance or SOS assistance, THE Swasthya_Setu SHALL log an emergency `notifications` row and SHALL display a simulated dispatch status as a Mock_Feature.
4. THE Swasthya_Setu SHALL compute the government aggregate dashboard statistics from seeded rows and SHALL present the dashboard as a Mock_Feature.
5. THE Swasthya_Setu SHALL derive medicine-stock and disease-hotspot charts from seeded rows using a documented heuristic and SHALL label those charts as a v1 heuristic over seed data rather than a trained model.
6. THE Swasthya_Setu SHALL exclude the NGO and fundraising portal from the MVP, and this document records that capability as out of scope.

### Requirement 21: Automated Test Coverage

**User Story:** As a developer, I want the deterministic logic covered by tests, so that a late change does not silently break the demo path.

#### Acceptance Criteria

1. THE Test_Suite SHALL cover Fallback_Triage keyword-to-Risk_Level mapping for each Risk_Level value.
2. THE Test_Suite SHALL cover the Referral_Status state machine, asserting acceptance of the two permitted transitions and rejection of all other transitions.
3. THE Test_Suite SHALL cover Token_Number computation for an empty facility and for a facility with existing `appointments` rows.
4. THE Test_Suite SHALL cover Routing_Engine facility selection for each Risk_Level value.
5. WHEN the Test_Suite runs through Vitest in single-run mode, THE Test_Suite SHALL report a passing result.

### Requirement 22: Non-Functional Constraints

**User Story:** As a field user on a mid-range Android phone in bright sunlight, I want the platform to stay usable and legible, so that the tool works where care is actually delivered.

#### Acceptance Criteria

1. WHEN connectivity is lost during any ASHA_User interaction, THE Swasthya_Setu SHALL remain interactive and SHALL retain submitted data through Offline_Queue.
2. THE Swasthya_Setu SHALL provide UI text and voice interaction in both Supported_Language values, and THE Swasthya_Setu SHALL exclude every other locale from the MVP.
3. THE Swasthya_Setu SHALL render all primary flows within the viewport of a 360 CSS pixel wide mobile browser without horizontal scrolling.
4. THE Swasthya_Setu SHALL send only text content to the Gemini API and SHALL exclude audio and image payloads from every inference call.
5. WHERE a Gemini API call fails, THE Swasthya_Setu SHALL continue the active flow using a deterministic fallback path rather than blocking the user.
