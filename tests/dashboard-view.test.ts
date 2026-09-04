import { describe, expect, it } from 'vitest';
import type { ReferralStatus, RiskLevel } from '@/lib/types';
import {
  buildHotspots,
  facilityBars,
  hotspotBand,
  HOTSPOT_BAND_FLOOR,
  HOTSPOT_WINDOW_DAYS,
  isWithinHotspotWindow,
  referralBars,
  referralThroughput,
  riskBars,
  toBars,
} from '@/components/dashboard/dashboard-view';

/**
 * The District_Dashboard derivations.
 *
 * Validates: Requirements 20.1, 20.4, 20.5
 *
 * `now` is passed in everywhere, so the 90-day window is asserted against a
 * fixed instant rather than against the clock the suite happens to run on.
 */

const NOW = Date.parse('2025-06-01T09:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(NOW - days * DAY_MS).toISOString();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('bar percentages', () => {
  it('sums to exactly 100 for a distribution that does not divide evenly', () => {
    const byRisk: Record<RiskLevel, number> = { high: 1, medium: 1, low: 1 };
    const bars = riskBars(byRisk);

    expect(sum(bars.map((b) => b.percent))).toBe(100);
    /* Naive rounding gives 33 + 33 + 33 = 99. Largest-remainder does not. */
    expect(bars.map((b) => b.percent).sort()).toEqual([33, 33, 34]);
  });

  it('sums to exactly 100 across a range of awkward distributions', () => {
    const distributions: Array<Record<RiskLevel, number>> = [
      { high: 1, medium: 1, low: 1 },
      { high: 1, medium: 2, low: 4 },
      { high: 7, medium: 0, low: 0 },
      { high: 3, medium: 3, low: 1 },
      { high: 1, medium: 0, low: 2 },
      { high: 99, medium: 1, low: 1 },
      { high: 5, medium: 6, low: 7 },
    ];

    for (const byRisk of distributions) {
      const bars = riskBars(byRisk);
      expect(sum(bars.map((b) => b.percent))).toBe(100);
    }
  });

  it('is all zero for an empty input rather than NaN or 100', () => {
    const bars = riskBars({ high: 0, medium: 0, low: 0 });

    expect(bars.map((b) => b.percent)).toEqual([0, 0, 0]);
    expect(bars.map((b) => b.width)).toEqual([0, 0, 0]);
    expect(sum(bars.map((b) => b.percent))).toBe(0);
    expect(toBars([])).toEqual([]);
  });

  it('never produces a negative bucket, even from broken counts', () => {
    const bars = toBars([
      { key: 'a', count: -5 },
      { key: 'b', count: Number.NaN },
      { key: 'c', count: 4 },
    ]);

    for (const bar of bars) {
      expect(bar.count).toBeGreaterThanOrEqual(0);
      expect(bar.percent).toBeGreaterThanOrEqual(0);
      expect(bar.width).toBeGreaterThanOrEqual(0);
      expect(bar.width).toBeLessThanOrEqual(100);
    }
    expect(sum(bars.map((b) => b.percent))).toBe(100);
    expect(bars[2].percent).toBe(100);
  });

  it('gives a zero count a zero share', () => {
    const bars = toBars([
      { key: 'a', count: 0 },
      { key: 'b', count: 3 },
    ]);

    expect(bars[0].percent).toBe(0);
    expect(bars[0].width).toBe(0);
    expect(bars[1].percent).toBe(100);
    expect(bars[1].width).toBe(100);
  });

  it('keeps risk order high, medium, low and preserves the real counts', () => {
    const bars = riskBars({ high: 2, medium: 5, low: 3 });

    expect(bars.map((b) => b.key)).toEqual(['high', 'medium', 'low']);
    expect(bars.map((b) => b.count)).toEqual([2, 5, 3]);
    /* Width is relative to the largest bar, so the biggest is always full. */
    expect(bars[1].width).toBe(100);
  });

  it('orders facility bars by load and carries the facility name through', () => {
    const bars = facilityBars([
      { facilityId: 'F_PHC', facilityName: 'PHC Sevagram', count: 2 },
      { facilityId: 'F_CHC', facilityName: 'CHC Wardha', count: 13 },
      { facilityId: 'F_DH', facilityName: 'District Hospital Wardha', count: 0 },
    ]);

    expect(bars.map((b) => b.facilityName)).toEqual([
      'CHC Wardha',
      'PHC Sevagram',
      'District Hospital Wardha',
    ]);
    expect(bars.map((b) => b.count)).toEqual([13, 2, 0]);
    expect(sum(bars.map((b) => b.percent))).toBe(100);
  });
});

describe('referral throughput', () => {
  it('counts referred and in_progress as open, completed as closed', () => {
    const byStatus: Record<ReferralStatus, number> = {
      referred: 2,
      in_progress: 1,
      completed: 1,
    };
    const throughput = referralThroughput(byStatus);

    expect(throughput.open).toBe(3);
    expect(throughput.closed).toBe(1);
    expect(throughput.total).toBe(4);
    expect(throughput.closedPercent).toBe(25);
    expect(throughput.open + throughput.closed).toBe(throughput.total);
  });

  it('reports zero rather than NaN with no referrals at all', () => {
    const throughput = referralThroughput({
      referred: 0,
      in_progress: 0,
      completed: 0,
    });

    expect(throughput).toEqual({
      open: 0,
      closed: 0,
      total: 0,
      closedPercent: 0,
    });
    expect(sum(referralBars({ referred: 0, in_progress: 0, completed: 0 }).map((b) => b.percent))).toBe(0);
  });
});

describe('hotspot banding', () => {
  it('is total — every count from 0 to 500 lands in exactly one band', () => {
    const bands = new Set(['watch', 'elevated', 'concentrated']);
    for (let count = 0; count <= 500; count += 1) {
      expect(bands.has(hotspotBand(count))).toBe(true);
    }
  });

  it('holds broken counts at the lowest band rather than inventing a hotspot', () => {
    expect(hotspotBand(-1)).toBe('watch');
    expect(hotspotBand(Number.NaN)).toBe('watch');
    expect(hotspotBand(Number.POSITIVE_INFINITY)).toBe('watch');
  });

  it('bands at the documented floors', () => {
    expect(hotspotBand(HOTSPOT_BAND_FLOOR.elevated - 1)).toBe('watch');
    expect(hotspotBand(HOTSPOT_BAND_FLOOR.elevated)).toBe('elevated');
    expect(hotspotBand(HOTSPOT_BAND_FLOOR.concentrated - 1)).toBe('elevated');
    expect(hotspotBand(HOTSPOT_BAND_FLOOR.concentrated)).toBe('concentrated');
  });

  it('never bands a larger count lower than a smaller one', () => {
    const rank = { watch: 0, elevated: 1, concentrated: 2 };
    for (let count = 1; count <= 200; count += 1) {
      expect(rank[hotspotBand(count)]).toBeGreaterThanOrEqual(
        rank[hotspotBand(count - 1)],
      );
    }
  });
});

describe('the 90-day hotspot window', () => {
  it('includes a recent record and excludes an older one', () => {
    expect(isWithinHotspotWindow(daysAgo(1), NOW)).toBe(true);
    expect(isWithinHotspotWindow(daysAgo(HOTSPOT_WINDOW_DAYS - 1), NOW)).toBe(true);
    expect(isWithinHotspotWindow(daysAgo(HOTSPOT_WINDOW_DAYS + 1), NOW)).toBe(false);
    expect(isWithinHotspotWindow(daysAgo(300), NOW)).toBe(false);
  });

  it('excludes a future timestamp and an unparseable one', () => {
    expect(isWithinHotspotWindow(daysAgo(-2), NOW)).toBe(false);
    expect(isWithinHotspotWindow('not-a-date', NOW)).toBe(false);
    expect(isWithinHotspotWindow('', NOW)).toBe(false);
  });

  it('counts only the records inside the window, per village', () => {
    const view = buildHotspots(
      [
        { village: 'Sevagram', timestamps: [daysAgo(2), daysAgo(30), daysAgo(200)] },
        { village: 'Sevagram', timestamps: [daysAgo(10), daysAgo(89)] },
        { village: 'Pipri', timestamps: [daysAgo(400)] },
        { village: 'Kelzar', timestamps: [daysAgo(5)] },
      ],
      NOW,
    );

    /* Sevagram: 4 inside the window, the 200-day record dropped. Pipri drops
       out entirely rather than appearing as a zero. */
    expect(view.rows.map((r) => [r.village, r.count])).toEqual([
      ['Sevagram', 4],
      ['Kelzar', 1],
    ]);
    expect(view.counted).toBe(5);
    expect(view.rows[0].band).toBe('elevated');
    expect(view.rows[0].width).toBe(100);
    expect(view.rows[1].band).toBe('watch');
  });

  it('reports records with no village as unattributed instead of guessing one', () => {
    const view = buildHotspots(
      [
        { village: null, timestamps: [daysAgo(3)] },
        { village: '   ', timestamps: [daysAgo(4)] },
        { village: 'Bordharan', timestamps: [daysAgo(5)] },
      ],
      NOW,
    );

    expect(view.unattributed).toBe(2);
    expect(view.counted).toBe(3);
    expect(view.rows.map((r) => r.village)).toEqual(['Bordharan']);
  });

  it('returns an empty view for no input', () => {
    expect(buildHotspots([], NOW)).toEqual({
      rows: [],
      unattributed: 0,
      counted: 0,
    });
  });
});
