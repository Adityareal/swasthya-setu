import { describe, expect, it } from 'vitest';
import type { SupportedLanguage } from '@/lib/types';
import enIN from '@/lib/i18n/en-IN';
import hiIN from '@/lib/i18n/hi-IN';
import {
  familyOf,
  normaliseLang,
  primarySubtag,
  selectVoice,
  speechLangFor,
  voiceMatchesLocale,
  type VoiceLike,
} from '@/lib/voice/select-voice';
import { buildUtterance, utteranceSegments } from '@/lib/voice/build-utterance';
import {
  endsVoiceSession,
  isSilentError,
  recognitionErrorText,
} from '@/lib/voice/recognition-error';

/**
 * Validates: Requirements 5.8, 10.3, 11.2, 11.3
 *
 * The Voice_Module's pure layer. No `speechSynthesis`, no `SpeechRecognition`, no
 * jsdom, no mocks — `VoiceLike` is structural precisely so a plain object literal
 * is a valid voice and every branch is reachable from a test that runs in Node.
 *
 * Two guarantees are worth more than the rest of this file put together:
 *
 *   selectVoice NEVER RETURNS A MISMATCH. An `en-US` engine reading Devanagari at
 *   speed produces confident nonsense for a listener who cannot read the screen
 *   either. `null` is the correct answer and Req 11.3 renders a notice for it.
 *
 *   buildUtterance ALWAYS CONTAINS THE ADVISORY. Req 10.3 is a property of the
 *   builder rather than of its callers, so it is asserted over every shape of
 *   input the builder can be handed, in both locales.
 */

const LOCALES: readonly SupportedLanguage[] = ['en-IN', 'hi-IN'];

const voice = (name: string, lang: string): VoiceLike => ({ name, lang });

/* ————————————————————————————— normalisation ————————————————————————————— */

describe('normaliseLang', () => {
  it('folds case and underscore forms onto one shape', () => {
    expect(normaliseLang('en_US')).toBe('en-us');
    expect(normaliseLang('HI-IN')).toBe('hi-in');
    expect(normaliseLang('  hi-IN  ')).toBe('hi-in');
  });

  it('leaves an empty tag empty rather than inventing one', () => {
    expect(normaliseLang('')).toBe('');
    expect(normaliseLang('   ')).toBe('');
  });
});

describe('primarySubtag', () => {
  it('takes the language and drops every extension', () => {
    expect(primarySubtag('hi-IN')).toBe('hi');
    expect(primarySubtag('en-GB-oxendict')).toBe('en');
    expect(primarySubtag('hi')).toBe('hi');
  });
});

describe('familyOf and speechLangFor', () => {
  it('derives the family from the locale rather than a second table', () => {
    expect(familyOf('hi-IN')).toBe('hi');
    expect(familyOf('en-IN')).toBe('en');
  });

  it('hands both speech APIs the full BCP-47 tag', () => {
    for (const locale of LOCALES) expect(speechLangFor(locale)).toBe(locale);
  });
});

/* ——————————————————————————————— selection ——————————————————————————————— */

describe('selectVoice over an empty list', () => {
  it('returns null for an empty array, null and undefined alike', () => {
    for (const locale of LOCALES) {
      expect(selectVoice([], locale)).toBeNull();
      expect(selectVoice(null, locale)).toBeNull();
      expect(selectVoice(undefined, locale)).toBeNull();
    }
  });
});

describe('selectVoice exact and partial matches', () => {
  it('prefers an exact tag match over a family match earlier in the list', () => {
    const voices = [voice('Hindi Generic', 'hi'), voice('Google हिन्दी', 'hi-IN')];
    expect(selectVoice(voices, 'hi-IN')?.name).toBe('Google हिन्दी');
  });

  it('accepts a partial match when no exact tag exists', () => {
    /* The common Windows demo-laptop shape: a bare `hi` and a regional variant,
       neither of them `hi-IN`. */
    const voices = [voice('Microsoft Swara', 'hi-IN-x-swara'), voice('Hindi', 'hi')];
    const picked = selectVoice(voices, 'hi-IN');
    expect(picked).not.toBeNull();
    expect(primarySubtag(picked!.lang)).toBe('hi');
  });

  it('matches case-insensitively and across underscore tags', () => {
    expect(selectVoice([voice('a', 'HI_IN')], 'hi-IN')?.name).toBe('a');
    expect(selectVoice([voice('b', 'EN_in')], 'en-IN')?.name).toBe('b');
  });

  it('skips a voice whose lang is blank instead of treating it as a wildcard', () => {
    expect(selectVoice([voice('nameless', '   ')], 'hi-IN')).toBeNull();
  });
});

describe('selectVoice with duplicates', () => {
  it('resolves duplicate exact matches to the first in the supplied order', () => {
    /* Real platforms return both a local and a network `hi-IN`. The winner must
       be deterministic without depending on a sort. */
    const voices = [
      voice('hi-IN local', 'hi-IN'),
      voice('hi-IN network', 'hi-IN'),
      voice('hi-IN extra', 'hi-IN'),
    ];
    expect(selectVoice(voices, 'hi-IN')?.name).toBe('hi-IN local');
  });

  it('resolves duplicate family matches to the first in the supplied order', () => {
    const voices = [voice('first hi', 'hi-Deva'), voice('second hi', 'hi-Latn')];
    expect(selectVoice(voices, 'hi-IN')?.name).toBe('first hi');
  });
});

describe('selectVoice never returns a mismatch', () => {
  /* Every list a real device could plausibly return, including the ones that
     contain nothing usable. */
  const LISTS: readonly VoiceLike[][] = [
    [],
    [voice('Microsoft David', 'en-US')],
    [voice('Microsoft David', 'en-US'), voice('Microsoft Zira', 'en-GB')],
    [voice('Google हिन्दी', 'hi-IN')],
    [voice('Google हिन्दी', 'hi-IN'), voice('Microsoft David', 'en-US')],
    [voice('Marathi', 'mr-IN'), voice('Bengali', 'bn-IN')],
    [voice('Tamil', 'ta-IN'), voice('Hindi', 'hi')],
    [voice('blank', ''), voice('spaces', '  ')],
    [voice('weird', 'x-klingon'), voice('en family', 'en')],
  ];

  it('answers with a language-family match or null for every list and locale', () => {
    for (const list of LISTS) {
      for (const locale of LOCALES) {
        const picked = selectVoice(list, locale);
        /* The invariant, stated twice on purpose: through the predicate the
           product uses, and directly, so a broken predicate cannot hide a
           broken selection. */
        expect(voiceMatchesLocale(picked, locale)).toBe(true);
        if (picked !== null) {
          expect(primarySubtag(picked.lang)).toBe(familyOf(locale));
        }
      }
    }
  });

  it('returns null rather than an English voice when Hindi is unavailable', () => {
    const englishOnly = [voice('Microsoft David', 'en-US'), voice('Zira', 'en-GB')];
    expect(selectVoice(englishOnly, 'hi-IN')).toBeNull();
    /* And the same list DOES serve an English request, so the null above is the
       rule doing its job rather than the function failing. */
    expect(selectVoice(englishOnly, 'en-IN')?.name).toBe('Microsoft David');
  });

  it('returns null for a list of unsupported locales entirely', () => {
    const other = [voice('Marathi', 'mr-IN'), voice('Telugu', 'te-IN')];
    for (const locale of LOCALES) expect(selectVoice(other, locale)).toBeNull();
  });

  it('returns the element type it was given, so a DOM voice stays a DOM voice', () => {
    /* The generic signature is what lets the result assign straight to
       `SpeechSynthesisUtterance.voice` without a cast. A richer object surviving
       selection with its extra field intact is that property, observably. */
    const rich = { name: 'Google हिन्दी', lang: 'hi-IN', localService: false } as const;
    const picked = selectVoice([rich], 'hi-IN');
    expect(picked?.localService).toBe(false);
  });
});

/* ————————————————————————————— the utterance ————————————————————————————— */

const ADVISORY: Record<SupportedLanguage, string> = {
  'en-IN': enIN['advisory.notice'],
  'hi-IN': hiIN['advisory.notice'],
};

describe('buildUtterance always contains the advisory', () => {
  /* Every shape a caller can produce, including the degenerate ones. Req 10.3
     has no exceptions, so neither does this table. */
  const INPUTS: readonly { summary: string | null; nextStep: string | null }[] = [
    { summary: 'Likely a viral fever.', nextStep: 'Visit the PHC today.' },
    { summary: 'तेज़ बुखार तीन दिन से है', nextStep: 'आज ही CHC जाएँ' },
    { summary: 'Only a summary, no next step.', nextStep: null },
    { summary: null, nextStep: 'Only a next step.' },
    { summary: null, nextStep: null },
    { summary: '', nextStep: '   ' },
    { summary: '  spaced   out  summary  ', nextStep: 'trimmed' },
  ];

  it('includes the advisory sentence in both locales for every input', () => {
    for (const locale of LOCALES) {
      for (const input of INPUTS) {
        const spoken = buildUtterance({ ...input, locale });
        expect(spoken).toContain(ADVISORY[locale]);
      }
    }
  });

  it('puts the advisory first, so a listener who stops early still heard it', () => {
    for (const locale of LOCALES) {
      const spoken = buildUtterance({
        summary: 'Summary text',
        nextStep: 'Next step text',
        locale,
      });
      expect(spoken.indexOf(ADVISORY[locale])).toBe(0);
    }
  });

  it('is never empty, even with nothing to report', () => {
    for (const locale of LOCALES) {
      const spoken = buildUtterance({ summary: null, nextStep: null, locale });
      expect(spoken.trim().length).toBeGreaterThan(0);
      expect(spoken).toContain(ADVISORY[locale]);
    }
  });

  it('speaks the summary and the next step when both are present', () => {
    const spoken = buildUtterance({
      summary: 'Likely a viral fever',
      nextStep: 'Visit the PHC today',
      locale: 'en-IN',
    });
    expect(spoken).toContain('Likely a viral fever');
    expect(spoken).toContain('Visit the PHC today');
    /* The next-step label, so the listener hears where description ends and
       instruction begins. */
    expect(spoken).toContain(enIN['triage.nextStep']);
  });

  it('closes Devanagari sentences with a danda rather than a period', () => {
    const segments = utteranceSegments({
      summary: 'तेज़ बुखार है',
      nextStep: 'आज ही CHC जाएँ',
      locale: 'hi-IN',
    });
    expect(segments.some((s) => s.endsWith('।'))).toBe(true);
  });

  it('does not double terminal punctuation the source already carried', () => {
    const spoken = buildUtterance({
      summary: 'Already ends in a period.',
      nextStep: null,
      locale: 'en-IN',
    });
    expect(spoken).not.toContain('period..');
  });

  it('renders the same segments the on-screen fallback shows (Req 11.3)', () => {
    /* One content source for spoken and printed guidance, so the two cannot
       drift. `join` is the whole difference between them. */
    const input = { summary: 'S', nextStep: 'N', locale: 'en-IN' } as const;
    expect(utteranceSegments(input).join(' ')).toBe(buildUtterance(input));
  });
});

/* —————————————————————— recognition error classification —————————————————— */

describe('recognition errors and Req 5.8', () => {
  it('keeps voice usable for no-speech and aborted, and stands down otherwise', () => {
    expect(endsVoiceSession('no-speech')).toBe(false);
    expect(endsVoiceSession('aborted')).toBe(false);
    for (const code of [
      'not-allowed',
      'service-not-allowed',
      'audio-capture',
      'network',
      'language-not-supported',
      'something-nobody-has-shipped-yet',
    ]) {
      expect(endsVoiceSession(code)).toBe(true);
    }
  });

  it('says nothing for aborted, because the user asked for it', () => {
    expect(isSilentError('aborted')).toBe(true);
    expect(recognitionErrorText('aborted', 'en-IN')).toBeNull();
    expect(recognitionErrorText('aborted', 'hi-IN')).toBeNull();
  });

  it('has a non-empty sentence in both locales for every other code', () => {
    for (const locale of LOCALES) {
      for (const code of [
        'no-speech',
        'not-allowed',
        'service-not-allowed',
        'audio-capture',
        'network',
        'unsupported',
        'totally-unknown',
      ]) {
        const text = recognitionErrorText(code, locale);
        expect(text).not.toBeNull();
        expect(text!.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('never reports a Hindi failure in English', () => {
    /* An English sentence in a Hindi UI is a worse failure than the one being
       reported, so the two locales must actually differ. */
    for (const code of ['no-speech', 'not-allowed', 'network']) {
      expect(recognitionErrorText(code, 'hi-IN')).not.toBe(
        recognitionErrorText(code, 'en-IN'),
      );
    }
  });
});
