import { describe, expect, it } from 'vitest';
import type { ChatFailureReason, ChatTurn, RiskLevel } from '@/lib/types';
import { detectRedFlag, localAssessment, transcriptOf } from '@/lib/triage/chat-reducer';
import { floorRisk, readChatResponse } from '@/lib/triage/chat-schema';
import { fallbackTriage } from '@/lib/triage/fallback';

/**
 * Validates: Requirements 9.3, 9.4, 21.1, 21.5
 *
 * The honest-output policy, pinned.
 *
 * `fallbackTriage` used to stand in for Gemini on ANY failure, including while
 * the device was online. It now runs in exactly one place — the client's offline
 * branch — and an online failure surfaces as a retryable error instead. These
 * tests hold the three halves of that in place:
 *
 *   1. A failure payload can never be read as an assessment.
 *   2. The red-flag FLOOR and the red-flag SHORT CIRCUIT are untouched. They
 *      also consume the keyword table, they are NOT the fallback assessment, and
 *      a later change must not quietly take them with it.
 *   3. The offline path still produces a complete assessment.
 *
 * No mocks and no network: every module here is pure.
 */

const T = (n: number): string =>
  new Date(Date.UTC(2026, 2, 15, 5, 0, n)).toISOString();

const user = (text: string, n = 0): ChatTurn => ({ role: 'user', text, at: T(n) });
const bot = (text: string, n = 0): ChatTurn => ({
  role: 'assistant',
  text,
  at: T(n),
});

const REASONS: readonly ChatFailureReason[] = [
  'timeout',
  'error',
  'unparseable',
  'no-key',
];

/* ————————————————— 1. A failure is never an assessment ————————————————— */

describe('readChatResponse — a failure payload parses to a failure', () => {
  it('round-trips every failure reason the route can send', () => {
    for (const reason of REASONS) {
      expect(readChatResponse({ ok: false, reason })).toEqual({
        ok: false,
        reason,
      });
    }
  });

  it('reads an unrecognised or absent reason as a generic failure', () => {
    expect(readChatResponse({ ok: false, reason: 'quota-exceeded' })).toEqual({
      ok: false,
      reason: 'error',
    });
    expect(readChatResponse({ ok: false })).toEqual({ ok: false, reason: 'error' });
  });

  it('reads a failure as a failure even when a step rides along with it', () => {
    /* The property that matters. If a payload ever arrives carrying BOTH
       `ok: false` and a well-formed assessment — an older deployment, a proxy
       that merged bodies, a hand-rolled client — the discriminant wins and the
       keyword verdict does not reach the screen wearing an assessment plate. */
    const response = readChatResponse({
      ok: false,
      reason: 'timeout',
      step: {
        kind: 'assessment',
        risk_level: 'low',
        summary: 's',
        recommended_next_step: 'n',
      },
      source: 'fallback',
    });

    expect(response).toEqual({ ok: false, reason: 'timeout' });
    expect('step' in response).toBe(false);
  });

  it('reads a non-object body as a failure', () => {
    for (const body of [null, undefined, 'error', 42, [], [{ ok: true }]]) {
      expect(readChatResponse(body)).toEqual({ ok: false, reason: 'error' });
    }
  });

  it('reads a success whose step will not validate as a failure, not half an answer', () => {
    expect(
      readChatResponse({
        ok: true,
        source: 'gemini',
        step: { kind: 'assessment', risk_level: 'urgent', summary: 's' },
      }),
    ).toEqual({ ok: false, reason: 'unparseable' });

    expect(readChatResponse({ ok: true, source: 'gemini' })).toEqual({
      ok: false,
      reason: 'unparseable',
    });
  });

  it('reads a well-formed success as the assessment it is', () => {
    const response = readChatResponse({
      ok: true,
      source: 'gemini',
      endReason: 'red-flag',
      step: {
        kind: 'assessment',
        risk_level: 'high',
        summary: 'तुरंत का मामला है।',
        recommended_next_step: 'अभी अस्पताल जाएँ।',
      },
    });

    expect(response.ok).toBe(true);
    expect(response.ok && response.step.kind).toBe('assessment');
    expect(response.ok && response.source).toBe('gemini');
    expect(response.ok && response.endReason).toBe('red-flag');
  });

  it('reads a question step as a success that continues the conversation', () => {
    const response = readChatResponse({
      ok: true,
      source: 'gemini',
      step: { kind: 'question', question: 'कितने दिन से?', quickReplies: ['तीन दिन'] },
    });

    expect(response.ok && response.step.kind).toBe('question');
  });
});

/* ——————————————— 2a. The red-flag FLOOR. Deliberately kept. ——————————————— */

describe('floorRisk — raises, never lowers', () => {
  const LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high'];
  const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

  it('raises low and medium to a high floor', () => {
    /* The safety property, stated as the one sentence it protects: when the
       transcript reads `high` deterministically, Gemini supplies the wording and
       cannot talk the urgency down. */
    expect(floorRisk('low', 'high')).toBe('high');
    expect(floorRisk('medium', 'high')).toBe('high');
    expect(floorRisk('high', 'high')).toBe('high');
  });

  it('never returns a level below either input, for every pair', () => {
    for (const model of LEVELS) {
      for (const floor of LEVELS) {
        const result = floorRisk(model, floor);
        expect(RANK[result]).toBeGreaterThanOrEqual(RANK[model]);
        expect(RANK[result]).toBeGreaterThanOrEqual(RANK[floor]);
        /* It is a floor, not a bump: the answer is always one of the two
           inputs, so no pair can invent a level nobody asked for. */
        expect([model, floor]).toContain(result);
      }
    }
  });

  it('leaves a model verdict alone when it already meets the floor', () => {
    expect(floorRisk('high', 'low')).toBe('high');
    expect(floorRisk('high', 'medium')).toBe('high');
    expect(floorRisk('medium', 'low')).toBe('medium');
    expect(floorRisk('low', 'low')).toBe('low');
  });
});

/* ————————— 2b. The red-flag SHORT CIRCUIT. Also deliberately kept. ————————— */

describe('detectRedFlag — both scripts, still firing', () => {
  it('fires on Devanagari emergency terms', () => {
    expect(detectRedFlag([user('सीने में दर्द हो रहा है')])).toBe(true);
    expect(detectRedFlag([user('साँस फूल रही है')])).toBe(true);
    expect(detectRedFlag([user('बहुत खून बह रहा है')])).toBe(true);
  });

  it('fires on Latin-script transliterated emergency terms', () => {
    expect(detectRedFlag([user('seene mein dard ho raha hai')])).toBe(true);
    expect(detectRedFlag([user('saans nahi aa rahi')])).toBe(true);
    expect(detectRedFlag([user('behosh ho gaye')])).toBe(true);
  });

  it('matches the table as CONTIGUOUS text, which is a limitation, not a bug', () => {
    /* "seene mein TEZ dard" does not contain "seene mein dard", so this one
       reads `medium` rather than `high`. Documented in `lib/triage/fallback.ts`:
       matching is substring-based over a fixed phrase table, and a word wedged
       into the middle of a phrase breaks it. Pinned here so the limitation is
       recorded rather than rediscovered — widening the table is a change to the
       safety-critical keyword list and is not made casually. */
    expect(detectRedFlag([user('seene mein tez dard hai')])).toBe(false);
  });

  it('fires on English emergency terms', () => {
    expect(detectRedFlag([user('chest pain since morning')])).toBe(true);
  });

  it('still does not fire on a mild complaint, in either script', () => {
    expect(detectRedFlag([user('जुकाम और हल्की खाँसी है')])).toBe(false);
    expect(detectRedFlag([user('jukam aur halki khansi hai')])).toBe(false);
  });

  it('is unaffected by the locale, which only picks the summary wording', () => {
    const turns = [user('सीने में दर्द')];
    expect(detectRedFlag(turns, 'hi-IN')).toBe(detectRedFlag(turns, 'en-IN'));
  });
});

/* ——————————————— 3. The offline path still assesses ——————————————— */

describe('localAssessment — the offline branch yields a complete assessment', () => {
  it('produces a terminal assessment with every field populated', () => {
    const turns = [
      user('बुखार है', 0),
      bot('कितने दिन से?', 1),
      user('तीन दिन से और कमजोरी है', 2),
    ];

    const step = localAssessment(turns, 'hi-IN');

    expect(step.kind).toBe('assessment');
    if (step.kind !== 'assessment') throw new Error('unreachable');
    expect(['low', 'medium', 'high']).toContain(step.risk_level);
    expect(step.summary.trim()).not.toBe('');
    expect(step.recommended_next_step.trim()).not.toBe('');
  });

  it('assesses from the user transcript alone, matching the classifier exactly', () => {
    const turns = [
      user('सीने में दर्द', 0),
      bot('कब से?', 1),
      user('एक घंटे से', 2),
    ];

    const step = localAssessment(turns, 'hi-IN');
    const direct = fallbackTriage(transcriptOf(turns), 'hi-IN');

    if (step.kind !== 'assessment') throw new Error('unreachable');
    expect(step.risk_level).toBe(direct.risk_level);
    expect(step.summary).toBe(direct.summary);
    expect(step.recommended_next_step).toBe(direct.recommended_next_step);
    expect(step.red_flags).toEqual(direct.matched);
    expect(step.risk_level).toBe('high');
  });

  it('assesses in the requested locale', () => {
    const turns = [user('fever for three days')];

    const hi = localAssessment(turns, 'hi-IN');
    const en = localAssessment(turns, 'en-IN');

    if (hi.kind !== 'assessment' || en.kind !== 'assessment') {
      throw new Error('unreachable');
    }
    expect(hi.risk_level).toBe(en.risk_level);
    expect(hi.summary).not.toBe(en.summary);
  });

  it('still assesses an unclassifiable transcript rather than dead-ending', () => {
    /* No keyword matches. The classifier answers `medium` — the safe reading of
       no information — so the offline conversation terminates either way. */
    const step = localAssessment([user('मन ठीक नहीं लग रहा')], 'hi-IN');

    if (step.kind !== 'assessment') throw new Error('unreachable');
    expect(step.risk_level).toBe('medium');
    expect(step.summary.trim()).not.toBe('');
  });
});

/* —————— 4. The route itself, on the branch that needs no network —————— */

describe('POST /api/triage/chat — an unconfigured deployment is a failure', () => {
  /**
   * The `no-key` branch is the one route path that reaches a verdict without
   * touching the network, so it can be exercised for real: no mock, no fetch
   * interception, no fixture. `GEMINI_API_KEY` is simply absent here, which is
   * the condition being tested.
   *
   * What this pins is the whole policy in one assertion. The route used to
   * answer this branch with a keyword assessment and HTTP 200, and a client had
   * no way to tell it apart from a real one. It now answers with a failure — at
   * HTTP 200, because the client branches on the payload, not the status code.
   */
  const post = async (body: unknown): Promise<Response> => {
    const { POST } = await import('@/app/api/triage/chat/route');
    return POST(
      new Request('http://localhost/api/triage/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  };

  const withoutKey = async <T>(run: () => Promise<T>): Promise<T> => {
    const held = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      return await run();
    } finally {
      if (held !== undefined) process.env.GEMINI_API_KEY = held;
    }
  };

  it('reports no-key at HTTP 200, with no step and no risk level', async () => {
    const response = await withoutKey(() =>
      post({ turns: [user('सीने में दर्द हो रहा है')], locale: 'hi-IN' }),
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: false, reason: 'no-key' });
    /* The point of the whole change: nothing on this branch carries a verdict. */
    expect(body.step).toBeUndefined();
    expect(body.risk_level).toBeUndefined();
    expect(readChatResponse(body)).toEqual({ ok: false, reason: 'no-key' });
  });

  it('reports no-key even on a red-flag transcript, where a keyword high was free', async () => {
    /* The most tempting case to fake. `fallbackTriage` would read `high` off
       this transcript without a network, and the route still declines to dress
       that up as the model's answer — the CLIENT decides whether a keyword
       verdict is honest here, because only the client knows if it is online. */
    const response = await withoutKey(() =>
      post({
        turns: [user('बहुत खून बह रहा है और बेहोश हो गए')],
        locale: 'hi-IN',
        forceAssessment: true,
      }),
    );

    expect(await response.json()).toEqual({ ok: false, reason: 'no-key' });
  });

  it('still rejects an empty conversation as a malformed request', async () => {
    /* Unchanged: a request with no transcript is a 400, not a failure to
       assess. There is nothing to assess and nothing to retry. */
    const response = await withoutKey(() => post({ turns: [], locale: 'hi-IN' }));
    expect(response.status).toBe(400);
  });
});
