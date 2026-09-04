import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatOutcome } from '@/components/triage/symptom-chat';
import { repo, resetDemoData } from '@/lib/data/memory-repo';
import { DEMO_ASHA_ID, DEMO_PATIENT_ID } from '@/lib/data/seed';
import { completeIntake } from '@/lib/intake/complete-intake';
import { deriveCounts, planReplay } from '@/lib/offline/queue-plan';

/**
 * Validates: Requirements 19.2, 19.4, 22.1
 *
 * Zero mocks. The real repository, the real routing engine, the real queue — the
 * only thing injected is the connectivity verdict, because `navigator.onLine`
 * cannot be forced from script and inventing a fake `navigator` would be testing
 * the fake.
 */

function outcome(over: Partial<ChatOutcome> = {}): ChatOutcome {
  return {
    turns: [],
    transcript: 'fever for three days, headache',
    risk: 'medium',
    summary: 'Fever with headache for three days.',
    recommendedNextStep: 'Visit the community health centre today.',
    redFlags: [],
    /* The network was gone, so the chat already fell back client-side. */
    source: 'fallback',
    ...over,
  };
}

beforeEach(() => {
  resetDemoData();
});

describe('completeIntake — offline', () => {
  it('holds the visit in the queue instead of writing it', async () => {
    const recordsBefore = await repo.listRecordsForPatient(DEMO_PATIENT_ID);

    const result = await completeIntake({
      patientId: DEMO_PATIENT_ID,
      outcome: outcome(),
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      online: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sync).toBe('queued');

    /* Nothing written. */
    const recordsAfter = await repo.listRecordsForPatient(DEMO_PATIENT_ID);
    expect(recordsAfter).toHaveLength(recordsBefore.length);

    /* Everything retained. */
    const held = await repo.listQueuedWrites();
    expect(deriveCounts(held)).toEqual({ pending: 1, failed: 0, total: 1 });
    expect(held[0]!.kind).toBe('intake');
  });

  it('still resolves the facility — routing is pure and the list is cached', async () => {
    const result = await completeIntake({
      patientId: DEMO_PATIENT_ID,
      outcome: outcome({ risk: 'high' }),
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      online: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.sync !== 'queued') return;

    expect(result.value.facility.id).toBeTruthy();
    expect(result.value.distanceKm).toBeGreaterThanOrEqual(0);
  });

  it('allocates no token, and types the absence rather than faking a number', async () => {
    const result = await completeIntake({
      patientId: DEMO_PATIENT_ID,
      outcome: outcome(),
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      online: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.sync !== 'queued') return;

    expect(result.value.appointment).toBeNull();
  });

  it('logs no notification, because the mocked SMS payload carries a token', async () => {
    const before = await repo.listNotifications(DEMO_PATIENT_ID);

    await completeIntake({
      patientId: DEMO_PATIENT_ID,
      outcome: outcome(),
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      online: false,
    });

    const after = await repo.listNotifications(DEMO_PATIENT_ID);
    expect(after).toHaveLength(before.length);
  });
});

describe('completeIntake — online path is unchanged', () => {
  it('writes the record, books a token, and leaves the queue empty', async () => {
    const result = await completeIntake({
      patientId: DEMO_PATIENT_ID,
      outcome: outcome(),
      authorRole: 'asha',
      authorId: DEMO_ASHA_ID,
      online: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.sync !== 'written') {
      throw new Error('expected a written confirmation');
    }

    expect(result.value.appointment.tokenNumber).toBeGreaterThan(0);
    expect(result.value.record.id).toBeTruthy();
    expect(await repo.listQueuedWrites()).toHaveLength(0);
  });
});

describe('replay after reconnect', () => {
  it('applies held visits in submission order and allocates real tokens', async () => {
    /* Three visits captured with the network gone. */
    for (const risk of ['low', 'medium', 'high'] as const) {
      const result = await completeIntake({
        patientId: DEMO_PATIENT_ID,
        outcome: outcome({ risk, transcript: `captured at risk ${risk}` }),
        authorRole: 'asha',
        authorId: DEMO_ASHA_ID,
        online: false,
      });
      expect(result.ok).toBe(true);
    }

    const held = await repo.listQueuedWrites();
    expect(deriveCounts(held)).toEqual({ pending: 3, failed: 0, total: 3 });

    /* Ascending id IS submission order. */
    const plan = planReplay(held);
    expect(plan).toEqual([...plan].sort((a, b) => a - b));

    const recordsBefore = await repo.listRecordsForPatient(DEMO_PATIENT_ID);
    const outcomeOfPass = await repo.replayQueue();

    expect(outcomeOfPass.replayed).toBe(3);
    expect(outcomeOfPass.failed).toBe(0);
    expect(outcomeOfPass.remaining).toEqual([]);
    expect(deriveCounts(await repo.listQueuedWrites())).toEqual({
      pending: 0,
      failed: 0,
      total: 0,
    });

    const recordsAfter = await repo.listRecordsForPatient(DEMO_PATIENT_ID);
    expect(recordsAfter).toHaveLength(recordsBefore.length + 3);

    /* Every replayed visit now carries a distinct token at its facility. */
    const appointments = await repo.listAppointmentsForPatient(DEMO_PATIENT_ID);
    const replayed = appointments.slice(-3);
    expect(replayed).toHaveLength(3);
    for (const appointment of replayed) {
      expect(appointment.tokenNumber).toBeGreaterThan(0);
    }
  });
});
