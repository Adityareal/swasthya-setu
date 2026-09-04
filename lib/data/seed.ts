import type {
  Appointment,
  AppNotification,
  Facility,
  HealthRecord,
  HealthWorker,
  LatLng,
  MedicineStock,
  Patient,
  Prescription,
  Referral,
} from '@/lib/types';

/**
 * The Wardha-district dataset, in TypeScript. No SQL, no migrations.
 *
 * `buildSeed()` is a pure function returning a fresh object graph, so calling
 * it twice produces two structurally identical objects and cannot change a row
 * count — which is Requirement 1.6 (idempotent reseed) satisfied by
 * construction rather than by an upsert. Every id and every timestamp is a
 * literal for exactly that reason: no `Date.now()`, no `crypto.randomUUID()`.
 */

export interface Db {
  facilities: Facility[];
  workers: HealthWorker[];
  patients: Patient[];
  healthRecords: HealthRecord[];
  appointments: Appointment[];
  referrals: Referral[];
  prescriptions: Prescription[];
  medicineStock: MedicineStock[];
  notifications: AppNotification[];
}

/* ——————————————————————————— Demo identities ——————————————————————————— */

export const DEMO_PATIENT_ID = 'P_KAMLA';
export const DEMO_ASHA_ID = 'W_SUNITA';
export const DEMO_DOCTOR_ID = 'W_ANAND';

export const FACILITY_PHC_SEVAGRAM = 'F_PHC_SEVAGRAM';
export const FACILITY_CHC_WARDHA = 'F_CHC_WARDHA';
export const FACILITY_DH_WARDHA = 'F_DH_WARDHA';

/**
 * Origin resolution for a Patient_User doing self-intake: a patient has no
 * assigned facility, so the village name supplies the coordinate. No device
 * geolocation — a permission prompt in the first thirty seconds of a health app
 * is a poor trade for a number the village name already gives us.
 */
export const VILLAGE_COORDS: Record<string, LatLng> = {
  Sevagram: { lat: 20.7453, lng: 78.6022 },
  Pipri: { lat: 20.748, lng: 78.61 },
  Bordharan: { lat: 20.79, lng: 78.69 },
  Kelzar: { lat: 20.82, lng: 78.71 },
};

/** District centre, used when a village is unknown. */
export const DISTRICT_CENTRE: LatLng = { lat: 20.75, lng: 78.63 };

export function resolveVillageCoords(village: string | null): LatLng {
  if (!village) return DISTRICT_CENTRE;
  return VILLAGE_COORDS[village] ?? DISTRICT_CENTRE;
}

/* —————————————————————————————— The graph —————————————————————————————— */

export function buildSeed(): Db {
  const facilities: Facility[] = [
    {
      id: FACILITY_PHC_SEVAGRAM,
      name: 'PHC Sevagram',
      location: '20.7453,78.6022',
      locationLabel: 'Sevagram, Wardha',
      type: 'phc',
      currentQueueLength: 4,
    },
    {
      /* Coordinates deliberately distinct from PHC Sevagram. Identical coords
         would make routing compute 0.0 km and the haversine path would never
         actually be exercised. */
      id: FACILITY_CHC_WARDHA,
      name: 'CHC Wardha',
      location: '20.7560,78.6570',
      locationLabel: 'Wardha town',
      type: 'chc',
      currentQueueLength: 13,
    },
    {
      id: FACILITY_DH_WARDHA,
      name: 'District Hospital Wardha',
      location: '20.7500,78.6300',
      locationLabel: 'Civil Lines, Wardha',
      type: 'district_hospital',
      currentQueueLength: 21,
    },
  ];

  const workers: HealthWorker[] = [
    {
      id: DEMO_ASHA_ID,
      fullName: 'Sunita Tai Kamble',
      role: 'asha',
      facilityId: FACILITY_PHC_SEVAGRAM,
    },
    {
      id: DEMO_DOCTOR_ID,
      fullName: 'Dr. Anand Deshmukh',
      role: 'doctor',
      facilityId: FACILITY_CHC_WARDHA,
    },
  ];

  const patients: Patient[] = [
    {
      id: DEMO_PATIENT_ID,
      fullName: 'Kamla Bai',
      age: 34,
      gender: 'female',
      village: 'Sevagram',
      district: 'Wardha',
      phone: '+91 90000 11223',
      preferredLanguage: 'hi-IN',
      qrId: 'SS-WRD-KAMLA-7F3A',
    },
    {
      id: 'P_RUKMINI',
      fullName: 'Rukmini Gawande',
      age: 52,
      gender: 'female',
      village: 'Bordharan',
      district: 'Wardha',
      phone: '+91 90000 44556',
      preferredLanguage: 'hi-IN',
      qrId: 'SS-WRD-RUKMINI-2B91',
    },
    {
      id: 'P_SHALIK',
      fullName: 'Shalik Rao Meshram',
      age: 61,
      gender: 'male',
      village: 'Pipri',
      district: 'Wardha',
      phone: '+91 90000 77881',
      preferredLanguage: 'en-IN',
      qrId: 'SS-WRD-SHALIK-5C4D',
    },
    {
      id: 'P_ANJALI',
      fullName: 'Anjali Bhoyar',
      age: 23,
      gender: 'female',
      village: 'Kelzar',
      district: 'Wardha',
      phone: '+91 90000 33447',
      preferredLanguage: 'hi-IN',
      qrId: 'SS-WRD-ANJALI-9E20',
    },
  ];

  /**
   * Three prior visits for Kamla across ~10 months, with distinct symptoms,
   * summaries, risk levels and authoring roles — so the Longitudinal_Summary
   * has real material and the timeline demonstrably mixes authors (Req 4.4).
   */
  const healthRecords: HealthRecord[] = [
    {
      id: 'HR_KAMLA_1',
      patientId: DEMO_PATIENT_ID,
      symptoms: 'जुकाम और हल्की खाँसी, तीन दिन से। बुखार नहीं।',
      aiTriageSummary:
        'बताई गई शिकायत छोटी और अपने आप ठीक हो जाने वाली लगती है।',
      riskLevel: 'low',
      triageSource: 'fallback',
      vitals: { bloodPressure: '124/80', pulse: 78, temperature: 36.9 },
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      timestamp: '2025-05-12T09:20:00.000Z',
    },
    {
      id: 'HR_KAMLA_2',
      patientId: DEMO_PATIENT_ID,
      symptoms: 'चार दिन से बुखार, कमजोरी और चक्कर आ रहे हैं।',
      aiTriageSummary:
        'बताई गई शिकायत को जल्द किसी डॉक्टर को दिखाना चाहिए, पर तुरंत खतरे का लक्षण नहीं दिखता।',
      riskLevel: 'medium',
      triageSource: 'gemini',
      vitals: {
        bloodPressure: '138/88',
        pulse: 96,
        temperature: 38.6,
        spo2: 97,
        weight: 54,
      },
      /* Self-entered: a patient with a phone and no ASHA nearby (Req 6.4). */
      authorRole: 'patient',
      authorId: DEMO_PATIENT_ID,
      timestamp: '2025-09-28T05:45:00.000Z',
      /* Stored separately from the AI fields above, both retained (Req 15.3). */
      clinicalDecision: {
        assessment:
          'Febrile illness with dehydration. No focal chest or urinary findings on examination.',
        plan: 'Oral rehydration, paracetamol 500mg three times daily for 3 days, review if fever persists beyond 48 hours.',
        riskLevel: 'medium',
        byId: DEMO_DOCTOR_ID,
        at: '2025-09-28T11:10:00.000Z',
      },
    },
    {
      id: 'HR_KAMLA_3',
      patientId: DEMO_PATIENT_ID,
      symptoms:
        'सीने में दर्द और साँस फूल रही है, चलने पर बढ़ जाता है। दो दिन से।',
      aiTriageSummary:
        'बताई गई शिकायत में ऐसे लक्षण हैं जो जल्दी बिगड़ सकते हैं। इसे तुरंत का मामला मानें।',
      riskLevel: 'high',
      triageSource: 'gemini',
      vitals: {
        bloodPressure: '152/96',
        pulse: 108,
        temperature: 37.2,
        spo2: 94,
        weight: 53,
      },
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      timestamp: '2026-03-14T04:30:00.000Z',
    },
    /* A second patient with history, so the doctor's list is not a list of one. */
    {
      id: 'HR_RUKMINI_1',
      patientId: 'P_RUKMINI',
      symptoms: 'पैरों में सूजन और कमज़ोरी, एक हफ्ते से।',
      aiTriageSummary:
        'बताई गई शिकायत को जल्द किसी डॉक्टर को दिखाना चाहिए, पर तुरंत खतरे का लक्षण नहीं दिखता।',
      riskLevel: 'medium',
      triageSource: 'fallback',
      vitals: { bloodPressure: '160/98', pulse: 88, weight: 67 },
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      timestamp: '2026-03-02T07:05:00.000Z',
    },
    {
      id: 'HR_SHALIK_1',
      patientId: 'P_SHALIK',
      symptoms: 'Persistent cough for three weeks with weight loss.',
      aiTriageSummary:
        'The described complaint needs a clinician to look at it soon, but shows no immediate emergency signs.',
      riskLevel: 'medium',
      triageSource: 'gemini',
      vitals: { pulse: 84, temperature: 37.8, weight: 58 },
      authorRole: 'patient',
      authorId: 'P_SHALIK',
      timestamp: '2026-03-09T10:15:00.000Z',
    },
  ];

  const prescriptions: Prescription[] = [
    {
      id: 'RX_KAMLA_2',
      recordId: 'HR_KAMLA_2',
      medicines: 'Paracetamol 500mg; ORS sachets',
      dosage: 'Paracetamol 1 tablet three times daily after food for 3 days',
      notes: 'Return if fever persists beyond 48 hours or breathing changes.',
      prescribedBy: DEMO_DOCTOR_ID,
      createdAt: '2025-09-28T11:14:00.000Z',
    },
    {
      id: 'RX_RUKMINI_1',
      recordId: 'HR_RUKMINI_1',
      medicines: 'Amlodipine 5mg',
      dosage: 'One tablet each morning',
      notes: 'Recheck blood pressure in two weeks.',
      prescribedBy: DEMO_DOCTOR_ID,
      createdAt: '2026-03-02T12:40:00.000Z',
    },
  ];

  /**
   * THIRTEEN prior appointments at CHC Wardha holding tokens 1–13, so the
   * demo's next token is 14. Explicit `tokenNumber` values, which is safe
   * because `nextTokenFrom` derives from `max` rather than from a counter.
   */
  const chcPatients = [
    'P_RUKMINI',
    'P_SHALIK',
    'P_ANJALI',
    'P_RUKMINI',
    'P_SHALIK',
    'P_ANJALI',
    'P_RUKMINI',
    'P_SHALIK',
    'P_ANJALI',
    'P_RUKMINI',
    'P_SHALIK',
    'P_ANJALI',
    DEMO_PATIENT_ID, // token 13 — Kamla, so the patient workspace opens with content
  ];

  const appointments: Appointment[] = chcPatients.map((patientId, i) => {
    const token = i + 1;
    return {
      id: `AP_CHC_${String(token).padStart(2, '0')}`,
      patientId,
      facilityId: FACILITY_CHC_WARDHA,
      tokenNumber: token,
      status: token === 13 ? 'scheduled' : 'completed',
      isTeleconsult: false,
      /* 13 slots through one clinic morning, 06:00Z onward at 12-minute gaps. */
      createdAt: `2026-03-14T${String(6 + Math.floor((i * 12) / 60)).padStart(2, '0')}:${String((i * 12) % 60).padStart(2, '0')}:00.000Z`,
    };
  });

  appointments.push(
    {
      id: 'AP_PHC_01',
      patientId: DEMO_PATIENT_ID,
      facilityId: FACILITY_PHC_SEVAGRAM,
      recordId: 'HR_KAMLA_1',
      tokenNumber: 1,
      status: 'completed',
      isTeleconsult: false,
      createdAt: '2025-05-12T09:25:00.000Z',
    },
    {
      id: 'AP_PHC_02',
      patientId: 'P_RUKMINI',
      facilityId: FACILITY_PHC_SEVAGRAM,
      recordId: 'HR_RUKMINI_1',
      tokenNumber: 2,
      status: 'completed',
      isTeleconsult: false,
      createdAt: '2026-03-02T07:10:00.000Z',
    },
  );

  /** In-flight referrals, so the board is not three empty columns. */
  const referrals: Referral[] = [
    {
      id: 'RF_RUKMINI_1',
      patientId: 'P_RUKMINI',
      fromFacility: 'CHC Wardha',
      toFacilityOrSpecialist: 'District Hospital Wardha — Cardiology',
      reason: 'Uncontrolled hypertension with pedal oedema. Needs echo.',
      status: 'in_progress',
      raisedBy: DEMO_DOCTOR_ID,
      createdAt: '2026-03-02T12:45:00.000Z',
      updatedAt: '2026-03-05T09:00:00.000Z',
    },
    {
      id: 'RF_SHALIK_1',
      patientId: 'P_SHALIK',
      fromFacility: 'PHC Sevagram',
      toFacilityOrSpecialist: 'District Hospital Wardha — Chest clinic',
      reason: 'Cough over three weeks with weight loss. Sputum review needed.',
      status: 'referred',
      raisedBy: DEMO_DOCTOR_ID,
      createdAt: '2026-03-09T11:00:00.000Z',
      updatedAt: '2026-03-09T11:00:00.000Z',
    },
  ];

  /** Healthy / low / zero quantities across all three facilities, so the
   *  mocked stock heuristic has something to bite on (Req 1.5, 20.5). */
  const medicineStock: MedicineStock[] = [
    { id: 'MS_01', facilityId: FACILITY_PHC_SEVAGRAM, medicine: 'Paracetamol 500mg', quantity: 420 },
    { id: 'MS_02', facilityId: FACILITY_PHC_SEVAGRAM, medicine: 'ORS sachets', quantity: 18 },
    { id: 'MS_03', facilityId: FACILITY_PHC_SEVAGRAM, medicine: 'Iron & folic acid', quantity: 0 },
    { id: 'MS_04', facilityId: FACILITY_PHC_SEVAGRAM, medicine: 'Amoxicillin 250mg', quantity: 96 },
    { id: 'MS_05', facilityId: FACILITY_CHC_WARDHA, medicine: 'Paracetamol 500mg', quantity: 1240 },
    { id: 'MS_06', facilityId: FACILITY_CHC_WARDHA, medicine: 'Amlodipine 5mg', quantity: 22 },
    { id: 'MS_07', facilityId: FACILITY_CHC_WARDHA, medicine: 'Salbutamol inhaler', quantity: 0 },
    { id: 'MS_08', facilityId: FACILITY_CHC_WARDHA, medicine: 'Metformin 500mg', quantity: 310 },
    { id: 'MS_09', facilityId: FACILITY_DH_WARDHA, medicine: 'Paracetamol 500mg', quantity: 3100 },
    { id: 'MS_10', facilityId: FACILITY_DH_WARDHA, medicine: 'Anti-snake venom', quantity: 6 },
    { id: 'MS_11', facilityId: FACILITY_DH_WARDHA, medicine: 'Oxygen cylinder (D-type)', quantity: 14 },
    { id: 'MS_12', facilityId: FACILITY_DH_WARDHA, medicine: 'Insulin (human, 40IU)', quantity: 0 },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'NT_01',
      patientId: DEMO_PATIENT_ID,
      type: 'appointment',
      channel: 'sms',
      payload: { facility: 'CHC Wardha', tokenNumber: 13 },
      createdAt: '2026-03-14T08:24:00.000Z',
    },
  ];

  return {
    facilities,
    workers,
    patients,
    healthRecords,
    appointments,
    referrals,
    prescriptions,
    medicineStock,
    notifications,
  };
}
