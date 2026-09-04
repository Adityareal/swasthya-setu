/**
 * Voice_Module — the Web Speech API surface, declared structurally.
 *
 * `lib.dom.d.ts` ships `SpeechRecognitionResult` and friends but NOT
 * `SpeechRecognition`, `SpeechRecognitionEvent` or `SpeechRecognitionErrorEvent`,
 * because the constructor is still vendor-prefixed and Chromium-only. So the
 * three missing shapes are declared here, once, with `Like` names that cannot
 * collide with a future lib.dom addition.
 *
 * Only the members actually used are declared. A narrower type is a smaller lie:
 * anything not listed here is something this module does not depend on.
 */

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  /** The index of the first result that CHANGED. Walking from 0 on every event
   *  is the classic duplicated-transcript bug. */
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

/**
 * The `error` values this module handles, as the spec names them. `string` is
 * kept in the union because the list is not closed across implementations and an
 * unrecognised code must still be classifiable.
 */
export type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | (string & {});

export interface SpeechRecognitionErrorEventLike {
  readonly error: SpeechRecognitionErrorCode;
  readonly message?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onaudiostart?: ((event: Event) => void) | null;
  onspeechend?: ((event: Event) => void) | null;

  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechCapableWindow {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

/**
 * The constructor, or `null`.
 *
 * `null` is the expected answer on Firefox and on iOS Safari — it is not an
 * error, it is a capability reading, and the UI renders a DISABLED mic with a
 * caption rather than hiding the control. A missing affordance is harder to
 * understand than a disabled one: a user who cannot find the mic assumes the app
 * is broken, and a user who sees it greyed out with one line of text knows to
 * type.
 *
 * Reads `window` defensively so it is safe to call during a server render, where
 * it correctly reports "no support" and the button renders disabled until
 * hydration corrects it.
 */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as SpeechCapableWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/** `speechSynthesis` is far more widely available than recognition, but it is
 *  still absent in some embedded webviews, so it is read the same way. */
export function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis ?? null;
}

export function isSpeechSynthesisSupported(): boolean {
  return getSpeechSynthesis() !== null;
}
