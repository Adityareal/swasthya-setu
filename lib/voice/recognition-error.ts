import type { SupportedLanguage } from '@/lib/types';
import enIN from '@/lib/i18n/en-IN';
import hiIN from '@/lib/i18n/hi-IN';
import type { SpeechRecognitionErrorCode } from './speech-api';

/**
 * Voice_Module — what a recognition error means (Req 5.8).
 *
 * Two questions, answered separately because they have different answers:
 *
 *   1. DOES VOICE STOP? `no-speech` and `aborted` do not end the session — the
 *      first means nobody spoke and the second means the user (or an unmount)
 *      stopped it deliberately. Everything else does: a denied microphone, an
 *      absent microphone or an unreachable recognition service will not fix
 *      itself on a retry, and Req 5.8 requires the text field to take over with
 *      the partial transcript intact rather than a dead mic button.
 *
 *   2. WHAT DOES THE USER READ? A code like `service-not-allowed` is engineer
 *      vocabulary. Every message here names the CONSEQUENCE and the next action,
 *      because the person reading it wants to finish the intake, not diagnose the
 *      browser.
 *
 * PURE, and reads its strings off the frozen catalogues so the wording is the
 * product's own.
 */

/** Codes that leave voice usable. Everything else hands over to text (Req 5.8). */
const RECOVERABLE: ReadonlySet<string> = new Set(['no-speech', 'aborted']);

/**
 * Req 5.8's condition, as one predicate. `true` means: disable the mic for this
 * session, keep the partial transcript in the textarea, and let the user finish
 * by typing.
 */
export function endsVoiceSession(code: SpeechRecognitionErrorCode): boolean {
  return !RECOVERABLE.has(String(code));
}

/**
 * `aborted` is deliberate — the user pressed stop, or the component unmounted
 * mid-utterance. Announcing "voice was aborted" for an action the user just took
 * is noise, so this is the one error that says nothing at all.
 */
export function isSilentError(code: SpeechRecognitionErrorCode): boolean {
  return String(code) === 'aborted';
}

/**
 * The sentence to show, or `null` when there is nothing worth saying.
 *
 * `audio-capture`, `network` and any unrecognised code all resolve to
 * `voice.unsupported` — "Voice is not available on this browser. Type instead."
 * The first clause is imprecise for a missing microphone; the second is the only
 * part that changes what the user does, and it is correct in every one of those
 * cases.
 */
export function recognitionErrorText(
  code: SpeechRecognitionErrorCode,
  locale: SupportedLanguage,
): string | null {
  const catalogue = locale === 'hi-IN' ? hiIN : enIN;

  switch (String(code)) {
    case 'aborted':
      return null;
    case 'no-speech':
      return catalogue['voice.error.noSpeech'];
    case 'not-allowed':
    case 'service-not-allowed':
      return catalogue['voice.error.notAllowed'];
    case 'audio-capture':
    case 'network':
    default:
      return catalogue['voice.unsupported'];
  }
}
