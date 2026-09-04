import { describe, expect, it } from 'vitest';
import type { ChatTurn } from '@/lib/types';
import {
  MAX_QUESTIONS,
  appendTurn,
  countAssistantQuestions,
  detectRedFlag,
  nextAction,
  questionOrdinal,
  shouldForceAssessment,
  transcriptOf,
} from '@/lib/triage/chat-reducer';
import { floorRisk, parseChatStep } from '@/lib/triage/chat-schema';

/**
 * Validates: Requirements 9.1, 9.3, 21.5
 *
 * The Convergence_Contract is the reason this reducer exists, so these are the
 * assertions that matter: it terminates, it terminates EARLY on a red flag, and
 * it never loses the user's words. No mocks, no network, no clock — the reducer
 * takes its timestamps as arguments, which is what makes that possible.
 */

/** Fixed timestamps. A clock inside a test is a flake waiting to happen. */
const T = (n: number): string =>
  new Date(Date.UTC(2026, 2, 15, 5, 0, n)).toISOString();

const user = (text: string, n = 0): ChatTurn => ({ role: 'user', text, at: T(n) });
const bot = (text: string, n = 0): ChatTurn => ({
  role: 'assistant',
  text,
  at: T(n),
});

describe('countAssistantQuestions', () => {
  it('counts nothing in an empty transcript', () => {
    expect(countAssistantQuestions([])).toBe(0);
  });

  it('counts only assistant turns in a mixed transcript', () => {
    const turns = [
      user('बुखार है', 0),
      bot('कितने दिन से?', 1),
      user('तीन दिन', 2),
      bot('और कोई तकलीफ़?', 3),
      user('कमजोरी', 4),
    ];
    expect(countAssistantQuestions(turns)).toBe(2);
  });

  it('counts a transcript of user turns alone as zero', () => {
    expect(countAssistantQuestions([user('a', 0), user('b', 1)])).toBe(0);
  });
});

describe('shouldForceAssessment', () => {
  it('is false below the cap and true at or above it', () => {
    const q = (n: number): ChatTurn[] =>
      Array.from({ length: n }, (_, i) => bot(`q${i}`, i));

    expect(shouldForceAssessment(q(0))).toBe(false);
    expect(shouldForceAssessment(q(1))).toBe(false);
    expect(shouldForceAssessment(q(2))).toBe(false);
    expect(shouldForceAssessment(q(3))).toBe(true);
    /* A fourth question can only arrive from a model that ignored the prompt.
       The reducer still reports the cap as spent. */
    expect(shouldForceAssessment(q(4))).toBe(true);
  });

  it('honours an explicit cap', () => {
    expect(shouldForceAssessment([bot('q', 0)], 1)).toBe(true);
    expect(shouldForceAssessment([bot('q', 0)], 2)).toBe(false);
  });
});

describe('detectRedFlag', () => {
  it('fires on Devanagari chest pain', () => {
    expect(detectRedFlag([user('सीने में दर्द हो रहा है', 0)])).toBe(true);
  });

  it('fires on Latin-script transliterated chest pain', () => {
    expect(detectRedFlag([user('seene mein dard ho raha hai', 0)])).toBe(true);
  });

  it('does not fire on a mild cold', () => {
    expect(detectRedFlag([user('जुकाम और हल्की खाँसी है', 0)])).toBe(false);
  });

  it('does not fire on an empty transcript', () => {
    expect(detectRedFlag([])).toBe(false);
    expect(detectRedFlag([user('   ', 0)])).toBe(false);
  });

  it('reads the whole transcript, not only the newest turn', () => {
    /* "साँस फूल रही है" arrives in turn three. A per-message check that only
       looked at the newest turn would still catch this one — but a check that
       only looked at the FIRST turn would not, and the danger is that the
       transcript accumulates meaning. */
    const turns = [
      user('कमजोरी लग रही है', 0),
      bot('कब से?', 1),
      user('दो दिन से, और साँस फूल रही है', 2),
    ];
    expect(detectRedFlag(turns)).toBe(true);
  });

  it('ignores assistant turns, so the model cannot trigger its own red flag', () => {
    const turns = [
      user('जुकाम है', 0),
      bot('क्या सीने में दर्द है?', 1),
    ];
    expect(detectRedFlag(turns)).toBe(false);
  });
});

describe('nextAction', () => {
  it('assesses on a red flag in the FIRST message, at question zero', () => {
    const action = nextAction([user('सीने में दर्द और साँस फूल रही है', 0)]);
    expect(action).toEqual({ kind: 'assess', reason: 'red-flag' });
  });

  it('assesses once the question cap is spent', () => {
    const turns = [
      user('जुकाम है', 0),
      bot('q1', 1),
      user('तीन दिन', 2),
      bot('q2', 3),
      user('हल्का', 4),
      bot('q3', 5),
      user('नहीं', 6),
    ];
    expect(countAssistantQuestions(turns)).toBe(MAX_QUESTIONS);
    expect(nextAction(turns)).toEqual({ kind: 'assess', reason: 'turn-cap' });
  });

  it('keeps asking below the cap with no red flag', () => {
    expect(nextAction([user('जुकाम है', 0)])).toEqual({ kind: 'ask' });
    expect(
      nextAction([user('जुकाम है', 0), bot('q1', 1), user('तीन दिन', 2)]),
    ).toEqual({ kind: 'ask' });
  });

  it('prefers the red flag over the cap when both apply', () => {
    /* Precedence is safety first: the REASON matters, because it is what the
       route reports and what decides whether the risk floor is applied. */
    const turns = [
      user('सीने में दर्द', 0),
      bot('q1', 1),
      user('a', 2),
      bot('q2', 3),
      user('b', 4),
      bot('q3', 5),
      user('c', 6),
    ];
    expect(nextAction(turns)).toEqual({ kind: 'assess', reason: 'red-flag' });
  });
});

describe('transcriptOf', () => {
  it('concatenates only user turns, in order', () => {
    const turns = [
      user('बुखार है', 0),
      bot('कितने दिन से?', 1),
      user('तीन दिन से', 2),
      bot('और कोई तकलीफ़?', 3),
      user('कमजोरी', 4),
    ];
    expect(transcriptOf(turns)).toBe('बुखार है\nतीन दिन से\nकमजोरी');
  });

  it('is empty for an empty transcript and for assistant-only turns', () => {
    expect(transcriptOf([])).toBe('');
    expect(transcriptOf([bot('q', 0)])).toBe('');
  });

  it('drops whitespace-only user turns', () => {
    expect(transcriptOf([user('बुखार', 0), user('   ', 1)])).toBe('बुखार');
  });
});

describe('appendTurn', () => {
  it('does not mutate its input', () => {
    const original: ChatTurn[] = [user('बुखार है', 0)];
    const snapshot = JSON.stringify(original);

    const next = appendTurn(original, bot('कितने दिन से?', 1));

    expect(original).toHaveLength(1);
    expect(JSON.stringify(original)).toBe(snapshot);
    expect(next).toHaveLength(2);
    expect(next).not.toBe(original);
  });

  it('appends at the end, preserving order', () => {
    const turns = appendTurn(appendTurn([], user('a', 0)), user('b', 1));
    expect(turns.map((turn) => turn.text)).toEqual(['a', 'b']);
  });
});

describe('questionOrdinal', () => {
  it('is 1-based and clamped to the cap', () => {
    expect(questionOrdinal([])).toBe(1);
    expect(questionOrdinal([bot('q1', 0)])).toBe(2);
    expect(questionOrdinal([bot('q1', 0), bot('q2', 1)])).toBe(3);
    /* Never "question 4 of up to 3". */
    expect(
      questionOrdinal([bot('q1', 0), bot('q2', 1), bot('q3', 2)]),
    ).toBe(MAX_QUESTIONS);
  });
});

describe('parseChatStep', () => {
  it('narrows a well-formed question', () => {
    const result = parseChatStep(
      '{"kind":"question","question":"कितने दिन से?","quickReplies":["एक दिन","तीन दिन"]}',
    );
    expect(result).toEqual({
      ok: true,
      value: {
        kind: 'question',
        question: 'कितने दिन से?',
        quickReplies: ['एक दिन', 'तीन दिन'],
      },
    });
  });

  it('narrows a well-formed assessment', () => {
    const result = parseChatStep(
      '{"kind":"assessment","risk_level":"high","summary":"s","recommended_next_step":"n","red_flags":["f"]}',
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({
      kind: 'assessment',
      risk_level: 'high',
      summary: 's',
      recommended_next_step: 'n',
      red_flags: ['f'],
    });
  });

  it('unwraps a fenced code block', () => {
    const result = parseChatStep('```json\n{"kind":"question","question":"q"}\n```');
    expect(result.ok).toBe(true);
  });

  it('rejects empty, truncated, out-of-enum, and kindless bodies', () => {
    expect(parseChatStep('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseChatStep('{"kind":"question","')).toEqual({
      ok: false,
      reason: 'not-json',
    });
    expect(
      parseChatStep(
        '{"kind":"assessment","risk_level":"urgent","summary":"s","recommended_next_step":"n"}',
      ),
    ).toEqual({ ok: false, reason: 'enum' });
    expect(parseChatStep('{"foo":"bar"}')).toEqual({ ok: false, reason: 'kind' });
  });

  it('rejects a question when an assessment is mandatory', () => {
    expect(
      parseChatStep('{"kind":"question","question":"q"}', {
        requireAssessment: true,
      }),
    ).toEqual({ ok: false, reason: 'expected-assessment' });
  });

  it('cleans quick replies rather than failing the whole step', () => {
    const result = parseChatStep(
      '{"kind":"question","question":"q","quickReplies":["a","a","",null,"b","c","d","e"]}',
    );
    expect(result.ok && result.value.kind === 'question' && result.value.quickReplies)
      .toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('floorRisk', () => {
  it('raises to the floor and never lowers below it', () => {
    expect(floorRisk('low', 'high')).toBe('high');
    expect(floorRisk('medium', 'high')).toBe('high');
    expect(floorRisk('high', 'high')).toBe('high');
    expect(floorRisk('high', 'low')).toBe('high');
    expect(floorRisk('medium', 'low')).toBe('medium');
  });
});
