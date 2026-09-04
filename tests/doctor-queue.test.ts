import { describe, expect, it } from 'vitest';
import type { HealthRecord, Patient, RiskLevel } from '@/lib/types';
import {
  complaintSnippet,
  compareQueueRows,
  orderQueue,
  RISK_WEIGHT,
  type QueueRow,
} from '@/components/doctor/queue-order';
import { buildSeed, DEMO_PATIENT_ID } from '@/lib/data/seed';

/**
 * The doctor queue's ordering rule.
 *
 * Validates: Requirements 14.1, 10.2
 *
 * The claim under test has a clinical consequence rather than a cosmetic one: a
 * `high` patient must never be rendered below a `low` one. Everything else in
 * this file exists to pin down the edges of that claim.
 */

function patient(id: string, fullName = id): Patient {
  return {
    id,
    fullName,
    age: 40,
    gender: 'F',
    village: 'Sevagram',
    district: 'Wardha',
    phone: null,
    preferredLanguage: 'hi-IN',
    qrId: `QR-${id}`,
  };
}

function record(
  id: string,
  patientId: string,
  riskLevel: RiskLevel,
  timestamp: string,
): HealthRecord {
  return {
    id,
    patientId,
    symptoms: 'test complaint',
    aiTriageSummary: null,
    riskLevel,
    triageSource: 'fallback',
    authorRole: 'asha',
    authorId: 'W_SUNITA',
    timestamp,
  };
}

function row(id: string, riskLevel: RiskLevel, timestamp: string): QueueRow {
  return {
    patient: patient(id),
    latest: record(`HR_${id}`, id, riskLevel, timestamp),
    decided: false,
  };
}

describe('orderQueue', () => {
  it('sorts risk descending before anything else', () => {
    const ordered = orderQueue([
      row('low-1', 'low', '2026-03-14T00:00:00.000Z'),
      row('med-1', 'medium', '2026-03-13T00:00:00.000Z'),
      row('high-1', 'high', '2026-03-01T00:00:00.000Z'),
    ]);

    expect(ordered.map((r) => r.patient.id)).toEqual(['high-1', 'med-1', 'low-1']);
  });

  it('breaks a risk tie by recency, newest first', () => {
    const ordered = orderQueue([
      row('older', 'high', '2026-03-01T00:00:00.000Z'),
      row('newest', 'high', '2026-03-14T00:00:00.000Z'),
      row('middle', 'high', '2026-03-07T00:00:00.000Z'),
    ]);

    expect(ordered.map((r) => r.patient.id)).toEqual(['newest', 'middle', 'older']);
  });

  /* The property that matters. Checked over every ordering of a mixed set
     rather than over one fixture, because a comparator that happens to work on
     a sorted input is the classic way this bug survives a test. */
  it('never places a high patient below a low one, for any input ordering', () => {
    const base = [
      row('a', 'low', '2026-03-20T00:00:00.000Z'),
      row('b', 'high', '2026-03-02T00:00:00.000Z'),
      row('c', 'medium', '2026-03-18T00:00:00.000Z'),
      row('d', 'high', '2026-03-19T00:00:00.000Z'),
      row('e', 'low', '2026-03-21T00:00:00.000Z'),
    ];

    /* All 120 permutations of five rows: exhaustive, so no seed to record. */
    const permutations = (items: QueueRow[]): QueueRow[][] =>
      items.length <= 1
        ? [items]
        : items.flatMap((item, i) =>
            permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
              item,
              ...rest,
            ]),
          );

    for (const permutation of permutations(base)) {
      const ordered = orderQueue(permutation);
      const weights = ordered.map((r) => RISK_WEIGHT[r.latest!.riskLevel]);

      for (let i = 1; i < weights.length; i += 1) {
        expect(weights[i]).toBeLessThanOrEqual(weights[i - 1]);
      }

      /* And it is a permutation: nothing dropped, nothing duplicated. */
      expect([...ordered.map((r) => r.patient.id)].sort()).toEqual([
        'a',
        'b',
        'c',
        'd',
        'e',
      ]);
    }
  });

  it('sorts a patient with no record last', () => {
    const none: QueueRow = { patient: patient('nobody'), latest: null, decided: false };
    const ordered = orderQueue([none, row('low-1', 'low', '2020-01-01T00:00:00.000Z')]);

    expect(ordered.map((r) => r.patient.id)).toEqual(['low-1', 'nobody']);
  });

  it('treats two record-less patients as equal', () => {
    const a: QueueRow = { patient: patient('a'), latest: null, decided: false };
    const b: QueueRow = { patient: patient('b'), latest: null, decided: false };
    expect(compareQueueRows(a, b)).toBe(0);
  });

  it('does not mutate its input', () => {
    const input = [
      row('low-1', 'low', '2026-03-20T00:00:00.000Z'),
      row('high-1', 'high', '2026-03-02T00:00:00.000Z'),
    ];
    const before = input.map((r) => r.patient.id);
    orderQueue(input);
    expect(input.map((r) => r.patient.id)).toEqual(before);
  });

  it('tolerates an unparseable timestamp without dropping the row', () => {
    const ordered = orderQueue([
      row('good', 'medium', '2026-03-02T00:00:00.000Z'),
      row('bad', 'medium', 'not-a-date'),
    ]);
    expect(ordered).toHaveLength(2);
    expect(ordered[0].patient.id).toBe('good');
  });

  /* The queue the demo actually opens with. Kamla's newest seeded record is
     `high`, so she has to be at the top of the list on stage. */
  it('puts the seeded high-risk patient first', () => {
    const db = buildSeed();
    const rows: QueueRow[] = db.patients.map((p) => {
      const records = db.healthRecords
        .filter((r) => r.patientId === p.id)
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      return {
        patient: p,
        latest: records[0] ?? null,
        decided: records[0]?.clinicalDecision !== undefined,
      };
    });

    const ordered = orderQueue(rows);
    expect(ordered[0].latest?.riskLevel).toBe('high');
    expect(ordered[0].patient.id).toBe(DEMO_PATIENT_ID);
  });
});

describe('complaintSnippet', () => {
  it('collapses newlines and tabs into single spaces', () => {
    expect(complaintSnippet('fever\n\nand\tchills')).toBe('fever and chills');
  });

  it('returns a short complaint unchanged', () => {
    expect(complaintSnippet('सीने में दर्द')).toBe('सीने में दर्द');
  });

  it('never exceeds the cap', () => {
    const long = 'chest pain radiating to the left arm '.repeat(10);
    expect(complaintSnippet(long, 40).length).toBeLessThanOrEqual(40);
  });

  it('handles an empty complaint', () => {
    expect(complaintSnippet('')).toBe('');
    expect(complaintSnippet('    ')).toBe('');
  });
});
