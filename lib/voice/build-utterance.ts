import type { SupportedLanguage } from '@/lib/types';
import enIN from '@/lib/i18n/en-IN';
import hiIN from '@/lib/i18n/hi-IN';

/**
 * Voice_Module — the spoken text, assembled once (Req 10.3, 11.1).
 *
 * WHY THIS IS A BUILDER AND NOT A TEMPLATE AT THE CALL SITE:
 *
 * Requirement 10.3 says that when the Voice_Module reads a Triage_Result aloud
 * it SHALL include the advisory notice in the spoken output. If the readback
 * button passed a string to `speak()`, that requirement would hold only as long
 * as every caller remembered it — and the one caller that forgot would ship a
 * machine confidently narrating a risk level to a patient who cannot read the
 * disclaimer printed next to it.
 *
 * So the advisory is not a parameter. This function sources it from the frozen
 * catalogue itself and puts it FIRST, ahead of the assessment, because a
 * listener who stops halfway must not have heard a diagnosis-shaped sentence
 * without the frame that qualifies it. A caller cannot construct spoken output
 * without the advisory, because there is no other way to construct spoken
 * output.
 *
 * PURE. Reads two dictionary objects and nothing else — no `speechSynthesis`,
 * no `window`, no clock.
 */

/** Read straight off the frozen catalogues, so there is one advisory string in
 *  the product and the spoken one cannot drift from the printed one. */
const ADVISORY: Record<SupportedLanguage, string> = {
  'en-IN': enIN['advisory.notice'],
  'hi-IN': hiIN['advisory.notice'],
};

/** "What to do next" / "अब क्या करें" — spoken, not just printed, so the
 *  listener hears where the description ends and the instruction begins. */
const NEXT_STEP_LABEL: Record<SupportedLanguage, string> = {
  'en-IN': enIN['triage.nextStep'],
  'hi-IN': hiIN['triage.nextStep'],
};

/** Devanagari closes a sentence with a danda, not a period. */
const FULL_STOP: Record<SupportedLanguage, string> = {
  'en-IN': '.',
  'hi-IN': '।',
};

/** Anything that already ends a sentence — including both Devanagari dandas —
 *  so termination is never doubled. */
const TERMINATED = /[.!?:;…।॥]$/u;

export interface UtteranceInput {
  /** `ai_triage_summary` — the plain-language assessment (Req 11.1). */
  summary: string | null | undefined;
  /** `recommended_next_step` (Req 11.1). */
  nextStep: string | null | undefined;
  /** The PATIENT's `preferredLanguage`, not the device locale (Req 11.2). */
  locale: SupportedLanguage;
}

/**
 * The segments, in spoken order. Exported because Req 11.3 requires the same
 * guidance to appear as on-screen text when no voice is available, and rendering
 * it from this array means the read-aloud text and the printed fallback are the
 * same content by construction rather than by copy-paste.
 */
export function utteranceSegments(input: UtteranceInput): string[] {
  const locale = input.locale;
  const stop = FULL_STOP[locale];

  const segments: string[] = [terminate(ADVISORY[locale], stop)];

  const summary = clean(input.summary);
  if (summary !== '') segments.push(terminate(summary, stop));

  const nextStep = clean(input.nextStep);
  if (nextStep !== '') {
    segments.push(terminate(NEXT_STEP_LABEL[locale], stop));
    segments.push(terminate(nextStep, stop));
  }

  return segments;
}

/**
 * The single string handed to `SpeechSynthesisUtterance`.
 *
 * Segments are joined with a space after their own terminal punctuation, which
 * is what every engine tested reads as a sentence boundary and therefore as a
 * pause. An utterance is never empty: with no summary and no next step it is
 * still the advisory, and a caller that somehow reaches playback with nothing to
 * say says the honest thing instead of falling silent.
 */
export function buildUtterance(input: UtteranceInput): string {
  return utteranceSegments(input).join(' ');
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/gu, ' ').trim();
}

function terminate(text: string, stop: string): string {
  const trimmed = clean(text);
  if (trimmed === '') return trimmed;
  return TERMINATED.test(trimmed) ? trimmed : `${trimmed}${stop}`;
}
