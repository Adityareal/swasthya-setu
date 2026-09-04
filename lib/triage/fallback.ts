import type { RiskLevel, SupportedLanguage, TriageResult } from '@/lib/types';

/**
 * Fallback_Triage — pure, zero imports beyond types. No fetch, no Date.now(),
 * no randomness. That is what lets Vitest cover it with no mocks and what lets
 * the client call it directly when the network is gone.
 *
 * Documented limitation: no negation handling. "no chest pain" / "सीने में दर्द
 * नहीं" classifies `high`. A negation window is a genuine NLP problem, not a
 * four-hour one, and over-triage is the safe direction for the error. The UI
 * always shows which keywords fired (`matched`) so a human can see the reason
 * and override by editing the transcript.
 */

/** Both scripts for Hindi: Devanagari for correct recognition, Latin
 *  transliteration for mis-transcribed or code-mixed speech. */
const HIGH_KEYWORDS: readonly string[] = [
  // English
  'chest pain', 'breathless', 'cannot breathe', "can't breathe", 'unconscious',
  'fainted', 'seizure', 'convulsion', 'fits', 'heavy bleeding', 'vomiting blood',
  'severe pain', 'blue lips', 'paralysis', 'stroke', 'slurred speech',
  'stiff neck', 'snake bite', 'poison', 'suicide', 'labour pain', 'labor pain',
  // Hindi (Devanagari)
  'सीने में दर्द', 'छाती में दर्द', 'साँस', 'सांस', 'दम घुट', 'बेहोश', 'दौरा',
  'मिरगी', 'झटके', 'खून बह', 'रक्तस्राव', 'खून की उल्टी', 'तेज दर्द', 'तेज़ दर्द',
  'होंठ नीले', 'लकवा', 'गर्दन अकड़', 'साँप ने काटा', 'सांप ने काटा', 'ज़हर', 'जहर',
  'आत्महत्या', 'प्रसव',
  // Hindi (Latin)
  'seene mein dard', 'sine mein dard', 'chhati mein dard', 'chati mein dard',
  'saans', 'sans', 'dum ghut', 'behosh', 'daura', 'jhatke', 'khoon', 'lakwa',
  'saanp', 'sanp', 'zahar', 'prasav',
];

const MEDIUM_KEYWORDS: readonly string[] = [
  // English
  'fever', 'persistent cough', 'cough', 'vomiting', 'diarrhoea', 'diarrhea',
  'dehydration', 'swelling', 'rash', 'weakness', 'dizziness', 'dizzy',
  'burning urination', 'ear discharge', 'weight loss', 'persistent headache',
  'headache',
  // Hindi (Devanagari)
  'बुखार', 'बुख़ार', 'खाँसी', 'खांसी', 'उल्टी', 'दस्त', 'सूजन', 'चकत्ते', 'दाने',
  'कमजोरी', 'कमज़ोरी', 'चक्कर', 'पेशाब में जलन', 'कान से पानी', 'वजन कम', 'सिरदर्द',
  // Hindi (Latin)
  'bukhar', 'khansi', 'ulti', 'dast', 'sujan', 'kamzori', 'chakkar',
  'peshab mein jalan', 'sirdard',
];

const LOW_KEYWORDS: readonly string[] = [
  // English
  'cold', 'runny nose', 'mild cough', 'body ache', 'acidity', 'gas',
  'constipation', 'minor cut', 'itching', 'checkup', 'check up', 'refill',
  // Hindi (Devanagari)
  'जुकाम', 'ज़ुकाम', 'सर्दी', 'नाक बहना', 'हल्की खाँसी', 'हल्की खांसी', 'बदन दर्द',
  'पेट में गैस', 'कब्ज', 'छोटा घाव', 'खुजली', 'जाँच', 'जांच', 'दवा लेने',
  // Hindi (Latin)
  'jukam', 'sardi', 'halki khansi', 'badan dard', 'kabz', 'khujli', 'jaanch',
];

/** The one composite rule, kept to one so the table stays testable. */
const PREGNANCY_TERMS: readonly string[] = [
  'गर्भ', 'प्रसव', 'pregnan', 'garbh', 'गर्भवती',
];

const BLEED_OR_PAIN_TERMS: readonly string[] = [
  'bleed', 'blood', 'pain', 'खून', 'रक्त', 'दर्द', 'khoon', 'dard', 'rakt',
];

/**
 * NFC normalise → lowercase → strip Latin punctuation and the Devanagari
 * danda → collapse whitespace. Matching is substring-based, because Devanagari
 * inflection and compounding make token equality useless (`साँस` appears
 * inside `साँस फूलना`).
 */
export function normaliseTranscript(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,;:!?'"“”‘’()\[\]{}\/\\|`~@#$%^&*_+=<>—–-]/g, ' ')
    .replace(/।/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatches(
  haystack: string,
  keywords: readonly string[],
): string[] {
  const hits: string[] = [];
  for (const kw of keywords) {
    if (haystack.includes(normaliseTranscript(kw))) hits.push(kw);
  }
  return hits;
}

/** Locale-keyed summary templates, one per risk level. Deterministic, so the
 *  tests can assert on exact strings. */
const SUMMARY: Record<SupportedLanguage, Record<RiskLevel, string>> = {
  'en-IN': {
    high: 'The described complaint includes signs that can worsen quickly. Treat this as urgent.',
    medium:
      'The described complaint needs a clinician to look at it soon, but shows no immediate emergency signs.',
    low: 'The described complaint reads as a minor, self-limiting problem.',
  },
  'hi-IN': {
    high: 'बताई गई शिकायत में ऐसे लक्षण हैं जो जल्दी बिगड़ सकते हैं। इसे तुरंत का मामला मानें।',
    medium:
      'बताई गई शिकायत को जल्द किसी डॉक्टर को दिखाना चाहिए, पर तुरंत खतरे का लक्षण नहीं दिखता।',
    low: 'बताई गई शिकायत छोटी और अपने आप ठीक हो जाने वाली लगती है।',
  },
};

const NEXT_STEP: Record<SupportedLanguage, Record<RiskLevel, string>> = {
  'en-IN': {
    high: 'Go to the nearest community health centre or district hospital now. Do not wait.',
    medium: 'Visit the community health centre within one to two days.',
    low: 'Visit the primary health centre when convenient.',
  },
  'hi-IN': {
    high: 'अभी सबसे नज़दीकी सामुदायिक स्वास्थ्य केंद्र या ज़िला अस्पताल जाएँ। रुकें नहीं।',
    medium: 'एक-दो दिन में सामुदायिक स्वास्थ्य केंद्र पर दिखाएँ।',
    low: 'सुविधा के अनुसार प्राथमिक स्वास्थ्य केंद्र पर दिखा लें।',
  },
};

const UNMATCHED_SUFFIX: Record<SupportedLanguage, string> = {
  'en-IN': ' No known keyword matched, so this is held for a clinician to review.',
  'hi-IN': ' कोई पहचाना गया शब्द नहीं मिला, इसलिए इसे डॉक्टर की जाँच के लिए रखा गया है।',
};

/**
 * Precedence: `high` if any high keyword matches, else `medium`, else `low`,
 * else — no match at all — **`medium`**.
 *
 * The no-match default is `medium`, not `low`. In triage the asymmetric error
 * is under-triage: sending a deteriorating patient to a PHC is a worse failure
 * than sending a mild case to a CHC. An unclassifiable complaint carries no
 * information, and the safe reading of no information is "a clinician should
 * look at this."
 */
export function fallbackTriage(
  transcript: string,
  locale: SupportedLanguage = 'hi-IN',
): TriageResult {
  const text = normaliseTranscript(transcript ?? '');

  const high = findMatches(text, HIGH_KEYWORDS);
  const medium = findMatches(text, MEDIUM_KEYWORDS);
  const low = findMatches(text, LOW_KEYWORDS);

  const pregnancy = findMatches(text, PREGNANCY_TERMS);
  const bleedOrPain = findMatches(text, BLEED_OR_PAIN_TERMS);
  const compositeFired = pregnancy.length > 0 && bleedOrPain.length > 0;

  let risk: RiskLevel;
  let matched: string[];
  let unmatched = false;

  if (high.length > 0 || compositeFired) {
    risk = 'high';
    matched = compositeFired
      ? Array.from(new Set([...high, ...pregnancy, ...bleedOrPain]))
      : high;
  } else if (medium.length > 0) {
    risk = 'medium';
    matched = medium;
  } else if (low.length > 0) {
    risk = 'low';
    matched = low;
  } else {
    risk = 'medium';
    matched = [];
    unmatched = true;
  }

  const base = SUMMARY[locale][risk];
  const summary = unmatched ? base + UNMATCHED_SUFFIX[locale] : base;

  return {
    risk_level: risk,
    summary,
    recommended_next_step: NEXT_STEP[locale][risk],
    source: 'fallback',
    matched,
  };
}

export const TRIAGE_KEYWORDS = {
  high: HIGH_KEYWORDS,
  medium: MEDIUM_KEYWORDS,
  low: LOW_KEYWORDS,
} as const;
