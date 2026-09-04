import { describe, expect, it } from 'vitest';
import {
  EMPTY_VITALS_DRAFT,
  isVitalsDraftEmpty,
  parseVitals,
} from '@/lib/intake/vitals';

/**
 * Validates: Requirements 8.3, 8.4, 8.5
 *
 * The requirement that needs a test is 8.5: a non-numeric value in a numeric
 * field shows a field-level message AND RETAINS THE OTHER ENTERED VALUES. That
 * second clause is the one a form silently breaks, so it is asserted directly.
 */

describe('parseVitals', () => {
  it('returns no vitals and no errors for an entirely empty draft (Req 8.3, 8.4)', () => {
    const result = parseVitals(EMPTY_VITALS_DRAFT);
    expect(result.vitals).toBeUndefined();
    expect(result.errors).toEqual({});
    expect(result.ok).toBe(true);
  });

  it('accepts a partially filled draft', () => {
    const result = parseVitals({ ...EMPTY_VITALS_DRAFT, pulse: '78' });
    expect(result.ok).toBe(true);
    expect(result.vitals).toEqual({ pulse: 78 });
  });

  it('retains the other values when one field is non-numeric (Req 8.5)', () => {
    const result = parseVitals({
      bloodPressure: '138/88',
      pulse: 'abc',
      temperature: '38.6',
      spo2: '97',
      weight: '',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({ pulse: 'vitals.error.numeric' });
    /* Everything else survived. */
    expect(result.vitals).toEqual({
      bloodPressure: '138/88',
      temperature: 38.6,
      spo2: 97,
    });
  });

  it('validates the blood-pressure SHAPE rather than its numeric-ness', () => {
    expect(parseVitals({ ...EMPTY_VITALS_DRAFT, bloodPressure: '150/96' }).vitals)
      .toEqual({ bloodPressure: '150/96' });
    expect(parseVitals({ ...EMPTY_VITALS_DRAFT, bloodPressure: '150' }).errors)
      .toEqual({ bloodPressure: 'vitals.error.bloodPressure' });
    expect(parseVitals({ ...EMPTY_VITALS_DRAFT, bloodPressure: 'high' }).errors)
      .toEqual({ bloodPressure: 'vitals.error.bloodPressure' });
  });

  it('catches a slipped decimal as an out-of-range value', () => {
    expect(parseVitals({ ...EMPTY_VITALS_DRAFT, pulse: '780' }).errors).toEqual({
      pulse: 'vitals.error.range',
    });
    expect(parseVitals({ ...EMPTY_VITALS_DRAFT, temperature: '3.7' }).errors).toEqual({
      temperature: 'vitals.error.range',
    });
    /* Wide on purpose: a real febrile reading must pass. */
    expect(parseVitals({ ...EMPTY_VITALS_DRAFT, temperature: '41.2' }).ok).toBe(true);
  });

  it('reports several bad fields at once', () => {
    const result = parseVitals({
      bloodPressure: 'x',
      pulse: 'y',
      temperature: '',
      spo2: '',
      weight: '',
    });
    expect(result.errors).toEqual({
      bloodPressure: 'vitals.error.bloodPressure',
      pulse: 'vitals.error.numeric',
    });
  });
});

describe('isVitalsDraftEmpty', () => {
  it('treats whitespace as empty', () => {
    expect(isVitalsDraftEmpty(EMPTY_VITALS_DRAFT)).toBe(true);
    expect(isVitalsDraftEmpty({ ...EMPTY_VITALS_DRAFT, weight: '   ' })).toBe(true);
    expect(isVitalsDraftEmpty({ ...EMPTY_VITALS_DRAFT, weight: '54' })).toBe(false);
  });
});
