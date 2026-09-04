import { describe, expect, it } from 'vitest';
import type { StockRow } from '@/lib/data/repo';
import { DEFAULT_REORDER_THRESHOLD, stockLevel } from '@/lib/data/repo';
import {
  buildStockView,
  compareStockRows,
  countLevels,
  filterStockRows,
  groupStockByFacility,
  matchesQuery,
  sortStockRows,
} from '@/components/stock/stock-view';

/**
 * The Medicine_Availability view rules.
 *
 * Validates: Requirements 20.1, 20.5, 22.3
 *
 * Every fixture goes through `stockLevel` rather than declaring its own level,
 * so a test row cannot claim a state the shipped derivation would not give it.
 */

function row(facilityId: string, medicine: string, quantity: number): StockRow {
  return {
    id: `${facilityId}:${medicine}`,
    facilityId,
    medicine,
    quantity,
    reorderThreshold: DEFAULT_REORDER_THRESHOLD,
    level: stockLevel(quantity, DEFAULT_REORDER_THRESHOLD),
  };
}

const FACILITIES = [
  { id: 'F_PHC', name: 'PHC Sevagram' },
  { id: 'F_CHC', name: 'CHC Wardha' },
];

/** A deliberate mix, exactly as the seed carries: healthy, low, and zero. */
const ROWS: StockRow[] = [
  row('F_PHC', 'Paracetamol 500mg', 420),
  row('F_PHC', 'ORS sachets', 18),
  row('F_PHC', 'Iron & folic acid', 0),
  row('F_CHC', 'Amlodipine 5mg', 22),
  row('F_CHC', 'Salbutamol inhaler', 0),
  row('F_CHC', 'Metformin 500mg', 310),
];

describe('stock row ordering', () => {
  it('puts out before low, and low before in_stock', () => {
    const levels = sortStockRows(ROWS).map((r) => r.level);
    expect(levels).toEqual(['out', 'out', 'low', 'low', 'in_stock', 'in_stock']);
  });

  it('falls back to the medicine name inside a level', () => {
    const outNames = sortStockRows(ROWS)
      .filter((r) => r.level === 'out')
      .map((r) => r.medicine);
    expect(outNames).toEqual(['Iron & folic acid', 'Salbutamol inhaler']);
  });

  it('is a total order — the same medicine at two facilities never ties', () => {
    const a = row('F_CHC', 'Paracetamol 500mg', 1240);
    const b = row('F_PHC', 'Paracetamol 500mg', 420);
    expect(compareStockRows(a, b)).toBeLessThan(0);
    expect(compareStockRows(b, a)).toBeGreaterThan(0);
    expect(compareStockRows(a, a)).toBe(0);
  });

  it('does not mutate its input', () => {
    const before = ROWS.map((r) => r.id);
    sortStockRows(ROWS);
    expect(ROWS.map((r) => r.id)).toEqual(before);
  });
});

describe('the medicine name filter', () => {
  it('matches a substring case-insensitively', () => {
    const target = row('F_PHC', 'Paracetamol 500mg', 420);
    expect(matchesQuery(target, 'para')).toBe(true);
    expect(matchesQuery(target, 'PARA')).toBe(true);
    expect(matchesQuery(target, 'cEtAmOl')).toBe(true);
    expect(matchesQuery(target, '500')).toBe(true);
    expect(matchesQuery(target, 'insulin')).toBe(false);
  });

  it('treats a blank query as no filter at all', () => {
    expect(filterStockRows(ROWS, { query: '', onlyShortages: false })).toHaveLength(
      ROWS.length,
    );
    expect(
      filterStockRows(ROWS, { query: '   ', onlyShortages: false }),
    ).toHaveLength(ROWS.length);
  });

  it('narrows to the matching rows only', () => {
    /* A substring match, not a prefix one: `ol` finds "folic" mid-word as well
       as the two -tamols. A worker who half-remembers a name still finds it. */
    const found = filterStockRows(ROWS, { query: 'ol', onlyShortages: false });
    expect(found.map((r) => r.medicine).sort()).toEqual([
      'Iron & folic acid',
      'Paracetamol 500mg',
      'Salbutamol inhaler',
    ]);
    expect(
      filterStockRows(ROWS, { query: 'tamol', onlyShortages: false }).map(
        (r) => r.medicine,
      ),
    ).toEqual(['Paracetamol 500mg', 'Salbutamol inhaler']);
  });
});

describe('the low-and-out toggle', () => {
  it('excludes exactly in_stock', () => {
    const shown = filterStockRows(ROWS, { query: '', onlyShortages: true });
    expect(shown).toHaveLength(4);
    expect(shown.every((r) => r.level !== 'in_stock')).toBe(true);
    /* `low` survives the toggle — it is the state that still has time to be
       acted on, and hiding it would leave only the failures. */
    expect(shown.filter((r) => r.level === 'low')).toHaveLength(2);
    expect(shown.filter((r) => r.level === 'out')).toHaveLength(2);
  });

  it('composes with the search query', () => {
    const shown = filterStockRows(ROWS, { query: 'tamol', onlyShortages: true });
    expect(shown.map((r) => r.medicine)).toEqual(['Salbutamol inhaler']);
  });

  it('keeps a row exactly at the reorder threshold as low, not out', () => {
    const atThreshold = row('F_PHC', 'Zinc', DEFAULT_REORDER_THRESHOLD);
    expect(atThreshold.level).toBe('low');
    expect(
      filterStockRows([atThreshold], { query: '', onlyShortages: true }),
    ).toHaveLength(1);
  });
});

describe('grouping by facility', () => {
  it('partitions the input — nothing dropped, nothing duplicated', () => {
    const groups = groupStockByFacility(ROWS, FACILITIES);
    const ids = groups.flatMap((g) => g.rows.map((r) => r.id));

    expect(ids).toHaveLength(ROWS.length);
    expect(new Set(ids).size).toBe(ROWS.length);
    expect(ids.slice().sort()).toEqual(ROWS.map((r) => r.id).sort());
  });

  it('puts every row in the group its own facilityId names', () => {
    for (const group of groupStockByFacility(ROWS, FACILITIES)) {
      expect(group.rows.every((r) => r.facilityId === group.facilityId)).toBe(true);
    }
  });

  it('labels a facility the lookup does not know, rather than dropping it', () => {
    const orphan = row('F_UNKNOWN', 'Anti-snake venom', 6);
    const groups = groupStockByFacility([...ROWS, orphan], FACILITIES);
    const found = groups.find((g) => g.facilityId === 'F_UNKNOWN');

    expect(found).toBeDefined();
    expect(found!.facilityName).toBe('F_UNKNOWN');
    expect(groups.flatMap((g) => g.rows)).toHaveLength(ROWS.length + 1);
  });

  it('sorts rows inside every group and counts its levels', () => {
    const groups = groupStockByFacility(ROWS, FACILITIES);
    for (const group of groups) {
      expect(group.rows).toEqual(sortStockRows(group.rows));
      expect(group.counts).toEqual(countLevels(group.rows));
      const total =
        group.counts.out + group.counts.low + group.counts.in_stock;
      expect(total).toBe(group.rows.length);
    }
  });

  it('returns no groups for no rows', () => {
    expect(groupStockByFacility([], FACILITIES)).toEqual([]);
  });
});

describe('buildStockView', () => {
  it('reports what was hidden as well as what is shown', () => {
    const view = buildStockView(ROWS, FACILITIES, {
      query: '',
      onlyShortages: true,
    });

    expect(view.total).toBe(6);
    expect(view.shown).toBe(4);
    expect(view.counts).toEqual({ out: 2, low: 2, in_stock: 0 });
    expect(view.groups.flatMap((g) => g.rows)).toHaveLength(view.shown);
  });

  it('holds an empty result without throwing', () => {
    const view = buildStockView(ROWS, FACILITIES, {
      query: 'nothing-by-this-name',
      onlyShortages: false,
    });

    expect(view.shown).toBe(0);
    expect(view.groups).toEqual([]);
    expect(view.total).toBe(6);
  });
});
