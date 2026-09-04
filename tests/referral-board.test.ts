import { describe, expect, it } from 'vitest';
import type { Referral, ReferralStatus } from '@/lib/types';
import { groupByStatus, REFERRAL_COLUMNS } from '@/lib/referral/group';
import { nextStatus } from '@/lib/referral/machine';

/**
 * The rendering contract of the closed-loop board, asserted against the two
 * pure functions the board is built from. No mocks, no DOM: what is worth
 * testing here is the shape of the board, and that shape is decided by
 * `groupByStatus` and `nextStatus` before a single element renders.
 *
 * Validates: Requirements 17.2, 17.3, 17.5
 */

const STATUSES: readonly ReferralStatus[] = ['referred', 'in_progress', 'completed'];

function referral(id: string, status: ReferralStatus, patientId = 'P_KAMLA'): Referral {
  return {
    id,
    patientId,
    fromFacility: 'PHC Sevagram',
    toFacilityOrSpecialist: 'District Hospital Wardha',
    reason: 'Needs a specialist review',
    status,
    raisedBy: 'W_ANAND',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-10T09:00:00.000Z',
  };
}

describe('the referral board always has three columns', () => {
  it('renders one column per Referral_Status and nothing else', () => {
    expect(REFERRAL_COLUMNS).toHaveLength(3);
    expect([...REFERRAL_COLUMNS]).toEqual([...STATUSES]);
  });

  it('keeps every column present when there are no referrals at all', () => {
    const board = groupByStatus([]);

    expect(Object.keys(board)).toHaveLength(3);
    for (const status of REFERRAL_COLUMNS) {
      expect(board[status], `${status} column must exist`).toEqual([]);
    }
  });

  it('keeps the empty columns present when only one column is populated', () => {
    /* The empty `completed` column is the visual proof the loop exists before
       anything has closed through it (Req 17.2). */
    const board = groupByStatus([referral('RF_1', 'referred')]);

    expect(board.referred).toHaveLength(1);
    expect(board.in_progress).toEqual([]);
    expect(board.completed).toEqual([]);
  });
});

describe('the board partitions its input', () => {
  const referrals = [
    referral('RF_1', 'referred'),
    referral('RF_2', 'in_progress', 'P_LATA'),
    referral('RF_3', 'completed', 'P_GOPAL'),
    referral('RF_4', 'referred', 'P_LATA'),
    referral('RF_5', 'completed'),
  ];

  it('places every referral in exactly one column', () => {
    const board = groupByStatus(referrals);
    const ids = REFERRAL_COLUMNS.flatMap((status) =>
      board[status].map((row) => row.id),
    );

    expect(ids).toHaveLength(referrals.length);
    expect(new Set(ids).size).toBe(referrals.length);
  });

  it('makes the union of the columns equal to the input', () => {
    const board = groupByStatus(referrals);
    const union = REFERRAL_COLUMNS.flatMap((status) => board[status]);

    expect([...union].sort(byId)).toEqual([...referrals].sort(byId));
  });

  it('files each referral under its own status', () => {
    const board = groupByStatus(referrals);

    for (const status of REFERRAL_COLUMNS) {
      for (const row of board[status]) expect(row.status).toBe(status);
    }
  });
});

describe('each card advances exactly one way', () => {
  it('offers the single legal next state for a non-terminal card', () => {
    expect(nextStatus('referred')).toBe('in_progress');
    expect(nextStatus('in_progress')).toBe('completed');
  });

  it('offers no advance button on a completed card', () => {
    /* Req 17.5 — the card renders no control and stays on the board as closed. */
    expect(nextStatus('completed')).toBeNull();
  });

  it('never offers a status that is not a Referral_Status', () => {
    for (const status of STATUSES) {
      const next = nextStatus(status);
      if (next !== null) expect(STATUSES).toContain(next);
    }
  });
});

function byId(a: Referral, b: Referral): number {
  return a.id.localeCompare(b.id);
}
