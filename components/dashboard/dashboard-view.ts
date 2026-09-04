import type { DashboardStats, ReferralStatus, RiskLevel } from '@/lib/types';

/**
 * The District_Dashboard derivations, kept pure and out of the screen.
 *
 * Two rules govern this module.
 *
 * One: no chart library. Every bar on the dashboard is a `<div>` with a width in
 * per-cent, so the numbers are computed here where they can be tested, and the
 * component only renders them.
 *
 * Two: nothing here is a model. `getDashboardStats()` counts rows that already
 * exist and so does the hotspot band below — a count of health records per
 * village over a 90-day window, bucketed into three bands. The screen says so in
 * words (Req 20.5), and this file is the documentation it points at.
 */

/* ————————————————————————————————— Bars ————————————————————————————————— */

/** Worst first: a dashboard is read top-down and `high` is the number that
 *  changes what anyone does. */
export const RISK_ORDER: readonly RiskLevel[] = ['high', 'medium', 'low'];

/** Lifecycle order, so the referral row reads left-to-right as time passes. */
export const REFERRAL_ORDER: readonly ReferralStatus[] = [
  'referred',
  'in_progress',
  'completed',
];

export interface Bar {
  key: string;
  count: number;
  /**
   * Whole-number share of the set, summing to EXACTLY 100 across the bars
   * whenever the total is above zero, and 0 everywhere when it is not. Written
   * on screen next to the real count, so a rounding artefact would be visible.
   */
  percent: number;
  /**
   * Width relative to the LARGEST bar rather than to the total, because a set of
   * three near-equal small shares drawn against the total is three invisible
   * slivers. `percent` carries the truth; `width` carries the legibility.
   */
  width: number;
}

/** Counts are row counts: a negative or non-finite input is not a smaller count,
 *  it is a broken one, and it reads as zero. */
function safeCount(count: number): number {
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/**
 * Largest-remainder apportionment. Naive rounding lets three 33.3 % buckets add
 * up to 99 %, and a government dashboard whose percentages do not sum to 100 is
 * a dashboard nobody trusts again.
 *
 * A zero bucket can never receive a remainder point: the remainder equals the
 * sum of the fractional parts, each is below 1, so there are always strictly
 * more nonzero fractions than points to hand out.
 */
export function toBars(
  input: ReadonlyArray<{ key: string; count: number }>,
): Bar[] {
  const counts = input.map(({ key, count }) => ({ key, count: safeCount(count) }));
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  const max = counts.reduce((high, entry) => Math.max(high, entry.count), 0);

  if (total === 0) {
    return counts.map(({ key, count }) => ({ key, count, percent: 0, width: 0 }));
  }

  const shares = counts.map(({ count }) => (count * 100) / total);
  const percent = shares.map((share) => Math.floor(share));
  let remainder = 100 - percent.reduce((sum, value) => sum + value, 0);

  const byFraction = shares
    .map((share, index) => ({ index, fraction: share - Math.floor(share) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const { index } of byFraction) {
    if (remainder <= 0) break;
    percent[index] += 1;
    remainder -= 1;
  }

  return counts.map(({ key, count }, index) => ({
    key,
    count,
    percent: percent[index],
    width: max === 0 ? 0 : Math.round((count / max) * 100),
  }));
}

export function riskBars(byRisk: DashboardStats['byRisk']): Bar[] {
  return toBars(RISK_ORDER.map((risk) => ({ key: risk, count: byRisk?.[risk] ?? 0 })));
}

export function referralBars(
  byStatus: DashboardStats['referralsByStatus'],
): Bar[] {
  return toBars(
    REFERRAL_ORDER.map((status) => ({ key: status, count: byStatus?.[status] ?? 0 })),
  );
}

export interface FacilityBar extends Bar {
  facilityName: string;
}

export function facilityBars(
  byFacility: DashboardStats['byFacility'],
): FacilityBar[] {
  const rows = [...(byFacility ?? [])].sort(
    (a, b) => b.count - a.count || a.facilityName.localeCompare(b.facilityName),
  );
  const bars = toBars(rows.map((row) => ({ key: row.facilityId, count: row.count })));
  return bars.map((bar, index) => ({ ...bar, facilityName: rows[index].facilityName }));
}

/* ——————————————————————— Referral throughput ——————————————————————— */

export interface ReferralThroughput {
  /** `referred` + `in_progress` — still someone's responsibility today. */
  open: number;
  /** `completed` — the only terminal state the machine allows. */
  closed: number;
  total: number;
  closedPercent: number;
}

export function referralThroughput(
  byStatus: DashboardStats['referralsByStatus'],
): ReferralThroughput {
  const referred = safeCount(byStatus?.referred ?? 0);
  const inProgress = safeCount(byStatus?.in_progress ?? 0);
  const closed = safeCount(byStatus?.completed ?? 0);
  const open = referred + inProgress;
  const total = open + closed;

  return {
    open,
    closed,
    total,
    closedPercent: total === 0 ? 0 : Math.round((closed / total) * 100),
  };
}

/* ————————————————————————— Disease hotspots ————————————————————————— */

/**
 * The documented v1 heuristic, in one sentence: COUNT the health records
 * attributed to each village inside a 90-day window, then bucket that count
 * into three bands. That is the whole method. It is not a trained model, it is
 * not disease detection, and the screen says both.
 */
export const HOTSPOT_WINDOW_DAYS = 90;

const HOTSPOT_WINDOW_MS = HOTSPOT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type HotspotBand = 'watch' | 'elevated' | 'concentrated';

/** Ascending, and the floor of each band. Absolute rather than relative to the
 *  busiest village: a band that moves when the busiest village moves cannot be
 *  compared between two readings of the same screen. */
export const HOTSPOT_BAND_FLOOR: Record<HotspotBand, number> = {
  watch: 0,
  elevated: 3,
  concentrated: 6,
};

export const HOTSPOT_BANDS: readonly HotspotBand[] = [
  'concentrated',
  'elevated',
  'watch',
];

/**
 * Total over every count. A negative or non-finite count is not a band of its
 * own — it reads as the lowest band, which is the only direction that cannot
 * invent a hotspot out of broken data.
 */
export function hotspotBand(count: number): HotspotBand {
  const safe = safeCount(count);
  if (safe >= HOTSPOT_BAND_FLOOR.concentrated) return 'concentrated';
  if (safe >= HOTSPOT_BAND_FLOOR.elevated) return 'elevated';
  return 'watch';
}

export function isWithinHotspotWindow(iso: string, now: number): boolean {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return false;
  const age = now - at;
  /* A record dated in the future is a clock skew, not a record from tomorrow,
     and counting it would let a bad timestamp create a hotspot. */
  return age >= 0 && age <= HOTSPOT_WINDOW_MS;
}

export interface VillageRecords {
  /** `patients.village`. A patient registered without one is not attributable to
   *  a village, and a count "per village" cannot honestly include them. */
  village: string | null;
  /** ISO 8601 timestamps of that patient's health records. */
  timestamps: string[];
}

export interface HotspotRow {
  village: string;
  count: number;
  band: HotspotBand;
  /** Relative to the busiest village, for the bar width only. */
  width: number;
}

export interface HotspotView {
  rows: HotspotRow[];
  /** Records inside the window that no village could be assigned. Shown on
   *  screen rather than quietly dropped. */
  unattributed: number;
  /** Records inside the window, in total. */
  counted: number;
}

export function buildHotspots(
  input: readonly VillageRecords[],
  now: number = Date.now(),
): HotspotView {
  const counts = new Map<string, number>();
  let unattributed = 0;
  let counted = 0;

  for (const entry of input) {
    const village = (entry.village ?? '').trim();
    for (const iso of entry.timestamps ?? []) {
      if (!isWithinHotspotWindow(iso, now)) continue;
      counted += 1;
      if (village === '') {
        unattributed += 1;
        continue;
      }
      counts.set(village, (counts.get(village) ?? 0) + 1);
    }
  }

  const max = [...counts.values()].reduce((high, count) => Math.max(high, count), 0);

  const rows = [...counts.entries()]
    .map(([village, count]) => ({
      village,
      count,
      band: hotspotBand(count),
      width: max === 0 ? 0 : Math.round((count / max) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.village.localeCompare(b.village));

  return { rows, unattributed, counted };
}
