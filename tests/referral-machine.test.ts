import { describe, expect, it } from 'vitest';
import type { ReferralStatus } from '@/lib/types';
import { advanceReferral, nextStatus } from '@/lib/referral/machine';
import { groupByStatus, REFERRAL_COLUMNS } from '@/lib/referral/group';
import { buildSeed } from '@/lib/data/seed';

/**
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 21.2
 */
const ALL: readonly ReferralStatus[] = ['referred', 'in_progress', 'completed'];

const LEGAL: ReadonlyArray<[ReferralStatus, ReferralStatus]> = [
  ['referred', 'in_progress'],
  ['in_progress', 'completed'],
];

describe('advanceReferral', () => {
  it('accepts the two permitted transitions', () => {
    for (const [from, to] of LEGAL) {
      const result = advanceReferral(from, to);
      expect(result.ok, `${from} → ${to} should be accepted`).toBe(true);
      if (result.ok) expect(result.next).toBe(to);
    }
  });

  it('rejects all seven other ordered pairs with a reason key', () => {
    const rejected: Array<[ReferralStatus, ReferralStatus]> = [];

    for (const from of ALL) {
      for (const to of ALL) {
        const isLegal = LEGAL.some(([f, t]) => f === from && t === to);
        if (isLegal) continue;

        rejected.push([from, to]);
        const result = advanceReferral(from, to);
        expect(result.ok, `${from} → ${to} should be rejected`).toBe(false);
        if (!result.ok) {
          expect(result.reasonKey).toMatch(/^referral\.error\./);
          expect(result.reasonKey.length).toBeGreaterThan(0);
        }
      }
    }

    /* 3 × 3 ordered pairs minus the 2 legal ones. */
    expect(rejected).toHaveLength(7);
  });

  it('names the specific reason for each rejection class', () => {
    expect(advanceReferral('referred', 'referred')).toEqual({
      ok: false,
      reasonKey: 'referral.error.same',
    });
    expect(advanceReferral('referred', 'completed')).toEqual({
      ok: false,
      reasonKey: 'referral.error.illegal',
    });
    expect(advanceReferral('in_progress', 'referred')).toEqual({
      ok: false,
      reasonKey: 'referral.error.illegal',
    });
    expect(advanceReferral('completed', 'referred')).toEqual({
      ok: false,
      reasonKey: 'referral.error.terminal',
    });
  });

  it('treats completed as terminal', () => {
    for (const to of ALL) {
      const result = advanceReferral('completed', to);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reasonKey).toBe('referral.error.terminal');
    }
    expect(nextStatus('completed')).toBeNull();
  });

  it('exposes exactly one legal next state per non-terminal status', () => {
    expect(nextStatus('referred')).toBe('in_progress');
    expect(nextStatus('in_progress')).toBe('completed');
  });

  it('leaves the input status unmodified on rejection', () => {
    const referral = { status: 'completed' as ReferralStatus };
    advanceReferral(referral.status, 'in_progress');
    expect(referral.status).toBe('completed');
  });
});

describe('groupByStatus', () => {
  it('produces exactly three columns, empty ones included', () => {
    const board = groupByStatus([]);
    expect(Object.keys(board).sort()).toEqual([...REFERRAL_COLUMNS].sort());
    for (const status of REFERRAL_COLUMNS) expect(board[status]).toEqual([]);
  });

  it('partitions its input — every referral in exactly one column', () => {
    const referrals = buildSeed().referrals;
    const board = groupByStatus(referrals);
    const total = REFERRAL_COLUMNS.reduce(
      (sum, status) => sum + board[status].length,
      0,
    );
    expect(total).toBe(referrals.length);

    const ids = REFERRAL_COLUMNS.flatMap((s) => board[s].map((r) => r.id));
    expect(new Set(ids).size).toBe(referrals.length);
  });

  it('keeps a completed referral visible in its column', () => {
    const board = groupByStatus([
      {
        id: 'RF_X',
        patientId: 'P_X',
        fromFacility: 'CHC Wardha',
        toFacilityOrSpecialist: 'District Hospital Wardha',
        status: 'completed',
        raisedBy: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect(board.completed).toHaveLength(1);
  });
});
