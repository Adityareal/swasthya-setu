import type { Vitals } from '@/lib/types';
import type { MessageKey } from '@/lib/i18n';

/**
 * Vitals parsing — pure, so Requirement 8.5 ("show a field-level message and
 * RETAIN the other entered values") is a property of the return shape rather
 * than of a form's error handling.
 *
 * `parseVitals` returns BOTH the accepted values and the per-field errors from
 * one pass. A caller cannot lose the good fields while reporting the bad one,
 * because the good fields come back in the same object as the errors.
 */

export const VITALS_FIELDS = [
  'bloodPressure',
  'pulse',
  'temperature',
  'spo2',
  'weight',
] as const;

export type VitalsField = (typeof VITALS_FIELDS)[number];

/** The raw form state: every field a string, including the numeric ones. */
export type VitalsDraft = Record<VitalsField, string>;

export const EMPTY_VITALS_DRAFT: VitalsDraft = {
  bloodPressure: '',
  pulse: '',
  temperature: '',
  spo2: '',
  weight: '',
};

export type VitalsErrors = Partial<Record<VitalsField, MessageKey>>;

export interface ParsedVitals {
  /** Present only when at least one field parsed. Absent vitals must not block
   *  the intake (Req 8.4), so `undefined` is a valid, complete result. */
  vitals: Vitals | undefined;
  errors: VitalsErrors;
  ok: boolean;
}

/**
 * Plausibility ranges, not clinical limits. The point is to catch a slipped
 * decimal or a value typed into the wrong box — a pulse of 780, a temperature of
 * 3.7 — not to second-guess a measurement an ASHA actually took. Wide on
 * purpose: rejecting a real reading is the worse error.
 */
const RANGES: Record<Exclude<VitalsField, 'bloodPressure'>, [number, number]> = {
  pulse: [20, 250],
  temperature: [30, 45],
  spo2: [50, 100],
  weight: [1, 300],
};

/** `"150/96"` — two numbers wearing one label, so the shape is validated rather
 *  than the numeric-ness. */
const BP_PATTERN = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/;

export function parseVitals(draft: Partial<VitalsDraft>): ParsedVitals {
  const errors: VitalsErrors = {};
  const vitals: Vitals = {};

  const bp = (draft.bloodPressure ?? '').trim();
  if (bp !== '') {
    const match = BP_PATTERN.exec(bp);
    if (!match) {
      errors.bloodPressure = 'vitals.error.bloodPressure';
    } else {
      const systolic = Number(match[1]);
      const diastolic = Number(match[2]);
      if (systolic < 50 || systolic > 300 || diastolic < 20 || diastolic > 200) {
        errors.bloodPressure = 'vitals.error.range';
      } else {
        vitals.bloodPressure = `${systolic}/${diastolic}`;
      }
    }
  }

  for (const field of ['pulse', 'temperature', 'spo2', 'weight'] as const) {
    const raw = (draft[field] ?? '').trim();
    if (raw === '') continue;

    /* `Number('')` is 0 and `Number('12abc')` is NaN — the empty case is already
       handled above, so a NaN here is genuinely non-numeric input (Req 8.5). */
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors[field] = 'vitals.error.numeric';
      continue;
    }
    const [min, max] = RANGES[field];
    if (value < min || value > max) {
      errors[field] = 'vitals.error.range';
      continue;
    }
    vitals[field] = value;
  }

  const hasAny = Object.keys(vitals).length > 0;
  return {
    vitals: hasAny ? vitals : undefined,
    errors,
    ok: Object.keys(errors).length === 0,
  };
}

/** True when nothing at all was typed — an entirely empty Vitals form, which is
 *  a legitimate submission (Req 8.3, 8.4). */
export function isVitalsDraftEmpty(draft: Partial<VitalsDraft>): boolean {
  return VITALS_FIELDS.every((field) => (draft[field] ?? '').trim() === '');
}
