/**
 * `en-IN` is the TYPE SOURCE for the message catalogue. `MessageKey` is
 * `keyof typeof enIN`, so a key missing from `hi-IN.ts` is a compile error
 * rather than a blank space discovered on stage.
 *
 * Flat keys, no nesting, no framework. Two locales do not need one.
 */
const enIN = {
  /* ——— Identity ——— */
  'app.name': 'Swasthya Setu',
  'app.tagline': 'Right Patient → Right Care → Right Facility → Right Time',
  'app.language': 'Language',
  'app.language.en': 'English',
  'app.language.hi': 'हिन्दी',

  /* ——— Roles and the switcher ——— */
  'role.patient': 'Patient',
  'role.asha': 'ASHA / ANM',
  'role.doctor': 'Doctor',
  'role.self': 'Self',
  'role.patient.blurb': 'Describe your own symptoms and see your record.',
  'role.asha.blurb': 'Register a patient, take vitals, book an appointment.',
  'role.doctor.blurb': 'Review history, record a decision, raise a referral.',
  'role.switch': 'Switch role',
  'role.switch.title': 'Choose a role',
  'role.active': 'Active role',
  'role.choose': 'Who is using this device?',
  'role.demoNotice':
    'Role switching is a hackathon demonstration affordance, not authentication. No sign-in, no OTP, and the data is seeded demonstration records only.',
  'role.guard.redirect': 'Choose a role to continue.',

  /* ——— Navigation ——— */
  'nav.home': 'Home',
  'nav.record': 'My record',
  'nav.intake': 'New complaint',
  'nav.language': 'Language',
  'nav.patients': 'Patients',
  'nav.register': 'Register',
  'nav.referrals': 'Referrals',
  'nav.board': 'Referral board',

  /* ——— Intake ——— */
  'intake.title': 'New complaint',
  'intake.subject': 'Recording for',
  'intake.symptoms.label': 'What is the problem?',
  'intake.symptoms.placeholder': 'Describe the symptoms in your own words',
  'intake.symptoms.hint': 'You can edit the text before submitting.',
  'intake.submit': 'Get guidance',
  'intake.submitting': 'Assessing…',
  'intake.voice.start': 'Speak',
  'intake.voice.stop': 'Stop',
  'intake.voice.unavailable':
    'Voice capture is unavailable on this browser. Type the complaint instead.',
  'intake.picker.label': 'Select a patient',
  'intake.picker.empty': 'Pick a patient before recording a complaint.',
  'intake.picker.new': 'Register a new patient',
  'intake.age': 'Age',
  'intake.gender': 'Sex',
  'intake.village': 'Village',
  'intake.phone': 'Phone',
  'intake.name': 'Full name',

  /* ——— Vitals ——— */
  'vitals.title': 'Vitals',
  'vitals.optional': 'All fields optional',
  'vitals.bloodPressure': 'Blood pressure',
  'vitals.bloodPressure.placeholder': '120/80',
  'vitals.pulse': 'Pulse',
  'vitals.pulse.unit': 'bpm',
  'vitals.temperature': 'Temperature',
  'vitals.temperature.unit': '°C',
  'vitals.spo2': 'SpO₂',
  'vitals.spo2.unit': '%',
  'vitals.weight': 'Weight',
  'vitals.weight.unit': 'kg',
  'vitals.none': 'No vitals recorded',

  /* ——— Triage result ——— */
  'triage.title': 'AI suggestion',
  'triage.risk': 'Triage priority',
  'triage.risk.low': 'LOW',
  'triage.risk.medium': 'MEDIUM',
  'triage.risk.high': 'HIGH',
  'triage.nextStep': 'What to do next',
  'triage.matched': 'Matched terms',
  'triage.source.gemini': 'AI assessment',
  'triage.source.fallback': 'Keyword-based fallback assessment',
  'triage.readAloud': 'Read aloud',
  'triage.assessing': 'Assessing…',

  /* ——— Advisory framing ——— */
  'advisory.notice':
    'AI-generated decision support. This is not a medical diagnosis. A doctor records the deciding assessment.',
  'advisory.aiSuggestion': 'AI suggestion',
  'advisory.doctorDecision': "Doctor's decision",
  'advisory.summary.unavailable':
    'AI summary unavailable — showing the full visit history.',
  'advisory.summary.retry': 'Retry summary',
  'advisory.source.template': 'Composed from recorded visits. No clinical inference.',

  /* ——— Appointment and token ——— */
  'appointment.title': 'Your appointment',
  'appointment.facility': 'Go to',
  'appointment.token': 'Token',
  'appointment.type.phc': 'Primary Health Centre',
  'appointment.type.chc': 'Community Health Centre',
  'appointment.type.district_hospital': 'District Hospital',
  'appointment.distance': 'Distance',
  'appointment.queue': 'People waiting',
  'appointment.book': 'Book appointment',
  'appointment.status.scheduled': 'Scheduled',
  'appointment.status.checked_in': 'Checked in',
  'appointment.status.completed': 'Completed',
  'appointment.status.cancelled': 'Cancelled',
  'appointment.none': 'No appointment yet',

  /* ——— Referrals ——— */
  'referral.title': 'Referrals',
  'referral.raise': 'Raise a referral',
  'referral.to': 'Refer to',
  'referral.from': 'From',
  'referral.reason': 'Reason',
  'referral.status.referred': 'Referred',
  'referral.status.in_progress': 'In progress',
  'referral.status.completed': 'Completed',
  'referral.advance': 'Move to',
  'referral.closed': 'Closed',
  'referral.none': 'No referrals',
  'referral.error.same': 'The referral is already in that state.',
  'referral.error.terminal': 'A completed referral cannot be moved again.',
  'referral.error.illegal': 'That step is not allowed from the current state.',
  'referral.error.notFound': 'That referral no longer exists.',

  /* ——— Prescription ——— */
  'prescription.title': 'Prescription',
  'prescription.medicines': 'Medicines',
  'prescription.dosage': 'Dosage',
  'prescription.notes': 'Notes',
  'prescription.save': 'Save prescription',
  'prescription.none': 'No prescription recorded',
  'prescription.error.medicinesRequired': 'Enter at least one medicine.',

  /* ——— Clinical decision ——— */
  'decision.title': "Doctor's decision",
  'decision.assessment': 'Final assessment',
  'decision.plan': 'Plan',
  'decision.risk': 'Doctor’s priority',
  'decision.save': 'Record decision',
  'decision.none': 'No decision recorded yet',
  'decision.by': 'Recorded by',
  'decision.differs': 'The doctor’s priority differs from the AI suggestion.',
  'decision.error.assessmentRequired': 'Enter a final assessment.',

  /* ——— Timeline ——— */
  'timeline.title': 'Record timeline',
  'timeline.author': 'Entered by',
  'timeline.entry.record': 'Visit',
  'timeline.entry.prescription': 'Prescription',
  'timeline.entry.referral': 'Referral',
  'timeline.entry.appointment': 'Appointment',
  'timeline.summary.title': 'History summary',
  'timeline.empty': 'Nothing recorded yet.',

  /* ——— Doctor panel ——— */
  'doctor.title': 'Patients',
  'doctor.review': 'Review',
  'doctor.currentComplaint': 'Current complaint',
  'doctor.priorVisits': 'Prior visits',
  'doctor.open': 'Open record',

  /* ——— Empty states: teach the next action ——— */
  'empty.patient.record': 'No visits yet. Describe a complaint to start your record.',
  'empty.patient.appointment': 'No appointment yet. Describe a complaint to get one.',
  'empty.patient.referral': 'No referrals. A doctor raises one when a specialist is needed.',
  'empty.asha.patients': 'Scan a patient’s card, or pick from the list.',
  'empty.doctor.patients': 'No patients waiting.',
  'empty.referral.board': 'No referrals in this column.',

  /* ——— Connectivity ——— */
  'connectivity.online': 'Online',
  'connectivity.offline': 'Offline — your entries are saved on this device',
  'connectivity.pending': 'Waiting to sync',
  'connectivity.failed': 'Failed',
  'connectivity.retry': 'Retry sync',

  /* ——— Mock features ——— */
  'mock.badge': 'DEMO',
  'mock.notice': 'This surface is simulated for the demonstration.',

  /* ——— Demo controls ——— */
  'demo.reset': 'Reset demo data',
  'demo.reset.caption': 'Discards everything created during this session.',

  /* ——— Validation and generic ——— */
  'validation.required': 'This field is required.',
  'validation.numeric': 'Enter a number.',
  'validation.age': 'Enter an age between 0 and 120.',
  'validation.bloodPressure': 'Enter as systolic/diastolic, e.g. 120/80.',
  'action.save': 'Save',
  'action.cancel': 'Cancel',
  'action.back': 'Back',
  'action.retry': 'Try again',
  'action.close': 'Close',
  'state.loading': 'Loading…',
  'state.error': 'Something went wrong.',

  /* ========================================================================
     Below this line: the namespaces later screens need. `lib/i18n/*` is frozen
     once this wave lands, so a key that is missing here is a string a later
     screen hardcodes in English. The catalogue is deliberately wider than any
     one screen.
     ====================================================================== */

  /* ——— The symptom chat (Req 5.5, 6.5, 9.1) ——— */
  'chat.title': 'Tell us what is wrong',
  'chat.opening':
    'Namaste. Tell me what is troubling you. I will ask two or three short questions, then tell you what to do.',
  'chat.composer.placeholder': 'Type your answer here',
  'chat.composer.label': 'Your answer',
  'chat.send': 'Send',
  'chat.thinking': 'Reading your answer…',
  'chat.progress': 'Question {n} of up to {max}',
  'chat.quickReplies': 'Tap an answer',
  'chat.restart': 'Start again',
  'chat.continue': 'Continue',
  'chat.assessment.title': 'What this looks like',
  'chat.assessment.nextStep': 'What to do next',
  'chat.assessment.redFlags': 'Watch for these',
  'chat.you': 'You',
  'chat.assistant': 'Health guide',
  'chat.error': 'The assessment could not be completed online. A keyword-based result is shown.',
  'chat.transcript': 'What you described',
  'chat.conversation': 'Intake conversation',
  'chat.conversation.hint': 'The questions and answers this assessment was reached through.',
  'chat.empty': 'Type or tap an answer to begin.',

  /* ——— Triage additions ——— */
  'triage.redFlags': 'Warning signs',
  'triage.result.title': 'Guidance',

  /* ——— Vitals validation (Req 8.5) ——— */
  'vitals.error.numeric': 'Enter a number, for example 78.',
  'vitals.error.bloodPressure': 'Enter as systolic/diastolic, for example 120/80.',
  'vitals.error.range': 'That value is outside the expected range.',
  'vitals.recorded': 'Vitals recorded',

  /* ——— Appointment additions ——— */
  'appointment.teleconsult': 'Teleconsultation',
  'appointment.next': 'Your next appointment',
  'appointment.confirmed': 'Appointment confirmed',

  /* ——— Referral additions ——— */
  'referral.raise.title': 'Raise a referral',
  'referral.to.placeholder': 'Facility or specialist',
  'referral.reason.placeholder': 'Why is this referral needed?',
  'referral.error.toRequired': 'Enter a facility or specialist.',
  'referral.rejected': 'Transition rejected',

  /* ——— Prescription additions ——— */
  'prescription.medicines.placeholder': 'One medicine per line',
  'prescription.dosage.placeholder': 'e.g. 1 tablet three times daily for 3 days',
  'prescription.notes.placeholder': 'When to return, what to avoid',

  /* ——— Decision: the AI-advises / clinician-decides pairing (Req 10.4) ——— */
  'decision.aiSuggestion': 'AI suggestion',
  'decision.doctorDecision': "Doctor's decision",
  'decision.assessment.placeholder': 'Final assessment for this visit',
  'decision.plan.placeholder': 'Treatment plan and follow-up',
  'decision.recorded': 'Decision recorded',

  /* ——— Timeline: Record_Author labels (Req 4.4) ——— */
  'timeline.author.patient': 'Entered by the patient',
  'timeline.author.asha': 'Entered by the ASHA worker',
  'timeline.author.doctor': 'Entered by the doctor',
  'timeline.at': 'On',

  /* ——— Patient workspace ——— */
  'patient.title': 'My health',
  'patient.myRecord': 'My record',
  'patient.myStatus': 'My status',
  'patient.myAppointment': 'My appointment',
  'patient.myReferrals': 'My referrals',
  'patient.language.select': 'Choose your language',
  'patient.language.saved': 'Language saved',
  'patient.register.title': 'Register a patient',
  'patient.register.name': 'Full name',
  'patient.register.age': 'Age',
  'patient.register.gender': 'Sex',
  'patient.register.gender.female': 'Female',
  'patient.register.gender.male': 'Male',
  'patient.register.gender.other': 'Other',
  'patient.register.village': 'Village',
  'patient.register.district': 'District',
  'patient.register.phone': 'Phone',
  'patient.register.language': 'Preferred language',
  'patient.register.save': 'Register and continue',
  'patient.register.saved': 'Patient registered',
  'patient.select': 'Select patient',
  'patient.selected': 'Recording for',

  /* ——— Doctor workspace ——— */
  'doctor.queue': 'Today’s queue',
  'doctor.panel': 'Patient panel',
  'doctor.summary.title': 'History summary',
  'doctor.summary.unavailable': 'AI summary unavailable — showing the full visit history.',
  'doctor.summary.retry': 'Retry summary',
  'doctor.summary.loading': 'Composing the history summary…',
  'doctor.vitalsAndSymptoms': 'Vitals and symptoms',
  'doctor.noRecords': 'This patient has no recorded visits.',

  /* ——— Medicine stock (Req 20.5) ——— */
  'stock.title': 'Medicine stock',
  'stock.medicine': 'Medicine',
  'stock.quantity': 'Quantity',
  'stock.level': 'Level',
  'stock.level.in_stock': 'In stock',
  'stock.level.low': 'Low',
  'stock.level.out': 'Out of stock',
  'stock.reorder': 'Reorder',
  'stock.reorder.threshold': 'Reorder below {n}',
  'stock.heuristic':
    'A v1 heuristic over seeded rows, not a trained model.',
  'stock.empty': 'No stock recorded for this facility.',

  /* ——— Aggregate dashboard (Req 20.4) ——— */
  'dashboard.title': 'District dashboard',
  'dashboard.patients': 'Patients',
  'dashboard.records': 'Visits recorded',
  'dashboard.byRisk': 'By triage priority',
  'dashboard.byFacility': 'Appointments by facility',
  'dashboard.referrals': 'Referrals by status',
  'dashboard.hotspots': 'Frequent symptom terms',
  'dashboard.heuristic':
    'Counted from seeded rows using a documented v1 heuristic. Not a trained model and not disease detection.',
  'dashboard.empty': 'Nothing to aggregate yet.',

  /* ——— Offline_Queue (Req 19) ——— */
  'offline.online': 'Online',
  'offline.offline': 'Offline — your entries are saved on this device',
  'offline.pending': 'Waiting to sync',
  'offline.failed': 'Failed to sync',
  'offline.retry': 'Retry sync',
  'offline.syncing': 'Syncing…',
  'offline.synced': 'All entries synced',
  'offline.simulate': 'Simulate offline',
  'offline.simulate.on': 'Offline simulated',
  'offline.simulate.off': 'Back online',
  'offline.queue.title': 'Waiting to sync',
  'offline.queue.empty': 'Nothing waiting to sync.',
  'offline.queue.kind.intake': 'Visit',
  'offline.queue.kind.referral': 'Referral',
  'offline.queue.kind.prescription': 'Prescription',
  'offline.queue.kind.clinical-decision': 'Doctor’s decision',
  'offline.queue.attempts': 'Attempts',

  /* ——— Voice_Module (Req 5.6, 11) ——— */
  'voice.listen': 'Listen',
  'voice.stop': 'Stop',
  'voice.speak': 'Speak',
  'voice.listening': 'Listening…',
  'voice.speaking': 'Speaking…',
  'voice.unsupported': 'Voice is not available on this browser. Type instead.',
  'voice.noVoice': 'No voice is installed for this language. The guidance is shown as text.',
  'voice.interim': 'Heard so far',

  /* ——— QR_Module (Req 18) ——— */
  'qr.title': 'Patient card',
  'qr.scan': 'Scan a card',
  'qr.scanning': 'Point the camera at the card',
  'qr.print': 'Print card',
  'qr.notFound': 'No patient matches that card. Try again.',
  'qr.manual': 'Enter the card number instead',
  'qr.manual.placeholder': 'SS-WRD-…',
  'qr.id': 'Card number',
  'qr.unsupported': 'The camera is not available. Enter the card number instead.',

  /* ——— Common actions and states ——— */
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.retry': 'Try again',
  'common.close': 'Close',
  'common.edit': 'Edit',
  'common.done': 'Done',
  'common.loading': 'Loading…',
  'common.saving': 'Saving…',
  'common.error': 'Something went wrong.',
  'common.empty': 'Nothing here yet.',
  'common.optional': 'Optional',
  'common.required': 'Required',
  'common.resetDemo': 'Reset demo data',
  'common.resetDemo.caption': 'Discards everything created during this session.',
  'common.yes': 'Yes',
  'common.no': 'No',
} as const;

export default enIN;
