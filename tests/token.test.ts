import { describe, expect, it } from 'vitest';
import { nextTokenFrom } from '@/lib/routing/token';
import { buildSeed, FACILITY_CHC_WARDHA } from '@/lib/data/seed';

/**
 * Validates: Requirements 12.3, 21.3
 */
describe('nextTokenFrom', () => {
  it('returns 1 for an empty facility', () => {
    expect(nextTokenFrom([])).toBe(1);
  });

  it('returns 14 for tokens 1 through 13 — the demo case', () => {
    const held = Array.from({ length: 13 }, (_, i) => i + 1);
    expect(nextTokenFrom(held)).toBe(14);
  });

  it('is independent of input ordering', () => {
    expect(nextTokenFrom([3, 1, 2])).toBe(4);
    expect(nextTokenFrom([2, 3, 1])).toBe(4);
    expect(nextTokenFrom([13, 7, 1, 9])).toBe(14);
  });

  it('is unaffected by duplicates', () => {
    expect(nextTokenFrom([1, 1, 2, 2, 3, 3])).toBe(4);
    expect(nextTokenFrom([7, 7, 7])).toBe(8);
  });

  it('returns a value strictly greater than every element', () => {
    const held = [4, 11, 2, 11, 8];
    const next = nextTokenFrom(held);
    for (const n of held) expect(next).toBeGreaterThan(n);
    expect(next).toBe(12);
  });

  /* The same assertion the demo makes on stage: the test now covers the code
     that actually runs, not a rule the database separately re-implemented. */
  it('yields 14 from the seeded CHC Wardha appointments', () => {
    const db = buildSeed();
    const held = db.appointments
      .filter((a) => a.facilityId === FACILITY_CHC_WARDHA)
      .map((a) => a.tokenNumber);

    expect(held).toHaveLength(13);
    expect([...held].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(nextTokenFrom(held)).toBe(14);
  });
});
