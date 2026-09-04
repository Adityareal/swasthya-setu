import type { SupportedLanguage } from '@/lib/types';

/**
 * Voice_Module — voice selection, as a pure function (Req 11.2, 11.3).
 *
 * `speechSynthesis.getVoices()` returns whatever the operating system happens to
 * have installed. On a Windows demo laptop that is often `en-US`, `en-GB` and
 * nothing else; on an Android handset it is usually `hi-IN` plus a dozen
 * variants. The selection rule therefore has to be total over an arbitrary list
 * and it has to be allowed to fail, because "no Hindi voice on this device" is
 * the common case and Req 11.3 requires it to be reported rather than papered
 * over with the wrong voice.
 *
 * THE ONE INVARIANT: this function never returns a voice from a different
 * language family than the one requested. A `hi-IN` request answered with an
 * `en-US` voice would read Devanagari as gibberish at speed to a patient who
 * cannot read the screen either — strictly worse than silence plus on-screen
 * text. `null` is a correct answer and the caller renders the Req 11.3 notice.
 *
 * PURE. No `speechSynthesis`, no `window`, no DOM types in the signature — the
 * structural `VoiceLike` is what lets Vitest cover every branch with plain
 * object literals and zero mocks.
 */

/**
 * The three fields selection reads, structurally typed so a real
 * `SpeechSynthesisVoice` satisfies it without a cast and a test fixture does
 * too.
 */
export interface VoiceLike {
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
}

/**
 * `en_US` and `en-US` mean the same thing and both turn up in the wild; so do
 * `HI-IN` and `hi-in`. Normalising here means every comparison below is a plain
 * `===` rather than a regex at each site.
 */
export function normaliseLang(lang: string): string {
  return (lang ?? '').trim().replace(/_/g, '-').toLowerCase();
}

/**
 * The primary language subtag — `hi` from `hi-IN`, `en` from `en-GB-oxendict`.
 * This is the unit the family match compares, and it is also the unit the
 * mismatch guarantee is stated in.
 */
export function primarySubtag(lang: string): string {
  const normalised = normaliseLang(lang);
  const cut = normalised.indexOf('-');
  return cut === -1 ? normalised : normalised.slice(0, cut);
}

/** `hi` for `hi-IN`, `en` for `en-IN`. Derived, not a second table to drift. */
export function familyOf(locale: SupportedLanguage): string {
  return primarySubtag(locale);
}

/**
 * The BCP-47 tag handed to `SpeechRecognition.lang` and
 * `SpeechSynthesisUtterance.lang`. Both APIs take the full tag, so this is the
 * identity — it exists as a named function so the two call sites read as
 * intentional rather than as a coincidence, and so a future locale that needs a
 * different speech tag changes one line.
 */
export function speechLangFor(locale: SupportedLanguage): string {
  return locale;
}

/**
 * Selection, in the documented order:
 *
 *   1. exact tag match (`hi-IN` for `hi-IN`)
 *   2. same language family (`hi-IN-x-something`, or `hi`, for `hi-IN`)
 *   3. `null`
 *
 * Within a tier the FIRST match in the supplied order wins, so duplicates —
 * which real platforms do return, e.g. a local and a network `hi-IN` — resolve
 * deterministically instead of depending on a sort. Voices carrying an unusable
 * blank `lang` are skipped rather than treated as wildcards.
 *
 * Generic over the element type rather than fixed to `VoiceLike`, so it RETURNS
 * what it was GIVEN. Handed real `SpeechSynthesisVoice` objects it yields a
 * `SpeechSynthesisVoice`, which is what `SpeechSynthesisUtterance.voice` demands;
 * handed test fixtures it yields the fixture type. Declaring the return as
 * `VoiceLike` would widen away the DOM type on the only path that needs it and
 * force a cast at the call site.
 */
export function selectVoice<V extends VoiceLike>(
  voices: readonly V[] | null | undefined,
  locale: SupportedLanguage,
): V | null {
  const list = voices ?? [];
  const wanted = normaliseLang(locale);
  const family = familyOf(locale);

  let familyMatch: V | null = null;

  for (const voice of list) {
    if (!voice || typeof voice.lang !== 'string') continue;
    const lang = normaliseLang(voice.lang);
    if (lang === '') continue;

    if (lang === wanted) return voice;
    if (familyMatch === null && primarySubtag(lang) === family) {
      familyMatch = voice;
    }
  }

  return familyMatch;
}

/**
 * The guarantee, as a predicate the tests assert directly: a selected voice is
 * either absent or in the requested family. Never a mismatch.
 */
export function voiceMatchesLocale(
  voice: VoiceLike | null,
  locale: SupportedLanguage,
): boolean {
  if (voice === null) return true;
  return primarySubtag(voice.lang) === familyOf(locale);
}
