import type { Facility, StockLevel } from '@/lib/types';
import type { StockRow } from '@/lib/data/repo';

/**
 * The Medicine_Availability view rules, kept pure and out of the screen.
 *
 * The screen answers ONE question — "is the medicine actually there before I
 * send someone on a two-hour journey" — so every rule here bends toward putting
 * what is MISSING at the top. `out` first, then `low`, then `in_stock`, and only
 * then alphabetically.
 *
 * Nothing in this module touches the DOM, `repo`, or a clock, so the ordering
 * and filtering can be read and tested without a browser.
 */

/** `out` sorts first because the screen exists to surface absence. */
export const LEVEL_RANK: Record<StockLevel, number> = {
  out: 0,
  low: 1,
  in_stock: 2,
};

/** The two levels that mean "do not promise this to a patient". */
export function isShortage(level: StockLevel): boolean {
  return level !== 'in_stock';
}

/**
 * Total order: level, then medicine name, then facility. The last tiebreak
 * matters — the same medicine appears at every facility in the all-facilities
 * view, and without it the list could reshuffle between renders.
 */
export function compareStockRows(a: StockRow, b: StockRow): number {
  const byLevel = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
  if (byLevel !== 0) return byLevel;

  const byName = a.medicine.localeCompare(b.medicine);
  if (byName !== 0) return byName;

  return a.facilityId.localeCompare(b.facilityId);
}

export function sortStockRows(rows: readonly StockRow[]): StockRow[] {
  return [...rows].sort(compareStockRows);
}

/** NFC first: a Devanagari medicine name typed two ways is one name. */
export function normalizeQuery(query: string): string {
  return (query ?? '').normalize('NFC').trim().toLowerCase();
}

/**
 * Case-insensitive substring match over the medicine name only. A blank query
 * matches everything, so an empty search box is not an empty screen.
 */
export function matchesQuery(row: StockRow, query: string): boolean {
  const needle = normalizeQuery(query);
  if (needle === '') return true;
  return row.medicine.normalize('NFC').toLowerCase().includes(needle);
}

export interface StockFilter {
  query: string;
  /** Excludes exactly `in_stock` — never `low`, which is the state that needs
   *  acting on before it becomes `out`. */
  onlyShortages: boolean;
}

export const NO_FILTER: StockFilter = { query: '', onlyShortages: false };

export function filterStockRows(
  rows: readonly StockRow[],
  filter: StockFilter = NO_FILTER,
): StockRow[] {
  return rows.filter(
    (row) =>
      matchesQuery(row, filter.query) &&
      (!filter.onlyShortages || isShortage(row.level)),
  );
}

export function countLevels(rows: readonly StockRow[]): Record<StockLevel, number> {
  const counts: Record<StockLevel, number> = { out: 0, low: 0, in_stock: 0 };
  for (const row of rows) counts[row.level] += 1;
  return counts;
}

export interface StockGroup {
  facilityId: string;
  /** The facility's name, or its id when the lookup has no entry — a row is
   *  never dropped for want of a label. */
  facilityName: string;
  rows: StockRow[];
  counts: Record<StockLevel, number>;
}

/**
 * Partitions rows by facility. Every input row lands in exactly one group: the
 * lookup only supplies a LABEL, never membership, so an unknown facility id
 * still gets its group rather than silently losing its medicines.
 *
 * Groups are ordered by how much is missing, for the same reason rows are.
 */
export function groupStockByFacility(
  rows: readonly StockRow[],
  facilities: ReadonlyArray<Pick<Facility, 'id' | 'name'>> = [],
): StockGroup[] {
  const names = new Map(facilities.map((f) => [f.id, f.name]));
  const groups = new Map<string, StockRow[]>();

  for (const row of rows) {
    const held = groups.get(row.facilityId);
    if (held) held.push(row);
    else groups.set(row.facilityId, [row]);
  }

  return [...groups.entries()]
    .map(([facilityId, held]) => ({
      facilityId,
      facilityName: names.get(facilityId) ?? facilityId,
      rows: sortStockRows(held),
      counts: countLevels(held),
    }))
    .sort(
      (a, b) =>
        b.counts.out - a.counts.out ||
        b.counts.low - a.counts.low ||
        a.facilityName.localeCompare(b.facilityName),
    );
}

export interface StockView {
  groups: StockGroup[];
  /** Rows before filtering — so the screen can say "6 of 12" rather than
   *  showing an empty list with no explanation. */
  total: number;
  shown: number;
  /** Level counts over the FILTERED rows. */
  counts: Record<StockLevel, number>;
}

export function buildStockView(
  rows: readonly StockRow[],
  facilities: ReadonlyArray<Pick<Facility, 'id' | 'name'>> = [],
  filter: StockFilter = NO_FILTER,
): StockView {
  const shown = filterStockRows(rows, filter);
  return {
    groups: groupStockByFacility(shown, facilities),
    total: rows.length,
    shown: shown.length,
    counts: countLevels(shown),
  };
}
