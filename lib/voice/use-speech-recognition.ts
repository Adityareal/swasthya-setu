'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportedLanguage } from '@/lib/types';
import {
  getSpeechRecognitionConstructor,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from './speech-api';
import {
  endsVoiceSession,
  isSilentError,
  recognitionErrorText,
} from './recognition-error';
import { speechLangFor } from './select-voice';

/**
 * Voice_Module — SpeechRecognition capture (Req 5.6, 5.8).
 *
 * FOUR DECISIONS, each one taken because the obvious alternative fails in the
 * field:
 *
 * 1. THE INSTANCE IS BUILT LAZILY, ON THE FIRST `start()`, NEVER DURING RENDER.
 *    Constructing `webkitSpeechRecognition` during render breaks SSR outright and,
 *    on a real device, makes React's double-invoked development render allocate a
 *    second engine that then races the first for the microphone.
 *
 * 2. `continuous = false`. One press, one utterance. Continuous mode keeps the
 *    engine hot between sentences, drifts as ambient noise accumulates, and on a
 *    field handset drains battery for a session that is answering a three-question
 *    chat. A press-per-answer is also a clearer mental model: the button is a
 *    walkie-talkie, not a tap.
 *
 * 3. `onend` DOES NOT AUTO-RESTART. The usual "keep listening" trick restarts
 *    inside `onend`, which on Chromium re-triggers the permission path, burns
 *    battery, and — worst — produces a mic that cannot be switched off. Ending is
 *    allowed to mean ended.
 *
 * 4. FINAL CHUNKS ARE PUSHED OUT AS DELTAS, INTERIM IS HELD AS STATE. The
 *    composer textarea is the transcript holder; this hook never owns the text.
 *    It hands finalised chunks to `onTranscript` and the caller appends them to
 *    whatever the user has already typed or edited, which is what keeps the field
 *    editable while the mic is live. The interim guess stays here because it is
 *    provisional and must be rendered differently — muted ink and a dashed
 *    underline, NEVER italic: Devanagari has no true italic and a synthesised
 *    oblique mangles the matras.
 *
 * Req 5.8 is the reason `fellBackToText` exists: on any error that is not
 * `no-speech` or `aborted`, the pending interim is flushed to the caller FIRST —
 * so the words already spoken survive — and only then does voice stand down and
 * the textarea become the path.
 */

export interface UseSpeechRecognitionOptions {
  /** The active Supported_Language. Read fresh at each `start()`, so switching
   *  language mid-session takes effect on the next press. */
  locale: SupportedLanguage;
  /**
   * A finalised chunk of speech. Called with the pending interim too, if the
   * session dies while holding one (Req 5.8).
   */
  onTranscript: (chunk: string) => void;
}

export interface SpeechRecognitionHandle {
  /** `false` on Firefox and iOS Safari. The mic renders DISABLED, never hidden. */
  supported: boolean;
  listening: boolean;
  /** The provisional guess for the current utterance. Replaced, never appended. */
  interim: string;
  /** A ready-to-render sentence, or `null` when there is nothing worth saying. */
  errorText: string | null;
  /** The raw code, kept for the caller that wants to branch on it. */
  errorCode: string | null;
  /** Req 5.8 — voice has stood down for this session; the textarea is the path. */
  fellBackToText: boolean;
  start: () => void;
  stop: () => void;
  /** Clears the error and the fallback latch, e.g. when the chat restarts. */
  reset: () => void;
}

export function useSpeechRecognition({
  locale,
  onTranscript,
}: UseSpeechRecognitionOptions): SpeechRecognitionHandle {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [fellBackToText, setFellBackToText] = useState(false);

  /* The live engine. A ref, not state: replacing it must never render. */
  const engineRef = useRef<SpeechRecognitionLike | null>(null);
  /* The pending interim, mirrored outside React so `onerror` can flush it
     without depending on a state value captured in a stale closure. */
  const interimRef = useRef('');
  /* Handlers are bound once per engine, so everything they read that can change
     is read through a ref. */
  const localeRef = useRef(locale);
  const onTranscriptRef = useRef(onTranscript);
  /* Set on unmount, so a late event from an aborting engine cannot call
     `setState` on a dead component. */
  const deadRef = useRef(false);

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  /* Support is a browser reading, so it resolves after hydration. Before that it
     is `false`, which renders the disabled mic — the safe direction: a control
     that starts disabled and becomes usable is fine, one that starts enabled and
     throws is not. */
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  const emit = useCallback((chunk: string) => {
    const text = chunk.replace(/\s+/gu, ' ').trim();
    if (text === '') return;
    onTranscriptRef.current(text);
  }, []);

  /** Hands the engine back to the browser and detaches every handler, so a
   *  queued event from a closing session cannot reach a stale closure. */
  const teardown = useCallback((engine: SpeechRecognitionLike | null) => {
    if (!engine) return;
    engine.onstart = null;
    engine.onend = null;
    engine.onresult = null;
    engine.onerror = null;
    if ('onaudiostart' in engine) engine.onaudiostart = null;
    if ('onspeechend' in engine) engine.onspeechend = null;
    try {
      engine.abort();
    } catch {
      /* Aborting a session that never opened throws on some builds. Nothing to
         recover: the handlers are already detached. */
    }
  }, []);

  const build = useCallback((): SpeechRecognitionLike | null => {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return null;

    const engine = new Ctor();
    engine.continuous = false;
    engine.interimResults = true;
    engine.maxAlternatives = 1;

    engine.onstart = () => {
      if (deadRef.current) return;
      setListening(true);
      setErrorText(null);
      setErrorCode(null);
    };

    /* Walk from `resultIndex`, not from 0: `results` is cumulative for the
       session, and re-reading it from the start is the classic
       every-word-twice bug. */
    engine.onresult = (event: SpeechRecognitionEventLike) => {
      if (deadRef.current) return;

      let finalChunk = '';
      let pending = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalChunk += text;
        else pending += text;
      }

      if (finalChunk.trim() !== '') {
        interimRef.current = '';
        setInterim('');
        emit(finalChunk);
      }
      if (pending !== '' || finalChunk.trim() !== '') {
        /* REPLACED, never appended: the interim string is a fresh guess at the
           same words, not more words. */
        interimRef.current = pending;
        setInterim(pending);
      }
    };

    engine.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (deadRef.current) return;
      const code = String(event?.error ?? 'unknown');

      /* Req 5.8 — the words already spoken survive the failure. Flush BEFORE
         standing down, so the partial transcript is in the textarea by the time
         the user reads why voice stopped. */
      const pending = interimRef.current;
      interimRef.current = '';
      setInterim('');
      if (pending.trim() !== '') emit(pending);

      setErrorCode(code);
      setErrorText(
        isSilentError(code) ? null : recognitionErrorText(code, localeRef.current),
      );
      if (endsVoiceSession(code)) setFellBackToText(true);
      setListening(false);
    };

    /* No auto-restart. Ended means ended. */
    engine.onend = () => {
      if (deadRef.current) return;
      const pending = interimRef.current;
      interimRef.current = '';
      setInterim('');
      /* A `stop()` that lands between the last interim and a final result would
         otherwise silently drop the tail of the sentence. */
      if (pending.trim() !== '') emit(pending);
      setListening(false);
    };

    return engine;
  }, [emit]);

  const start = useCallback(() => {
    if (listening) return;

    let engine = engineRef.current;
    if (!engine) {
      engine = build();
      engineRef.current = engine;
    }

    if (!engine) {
      /* No constructor. Report it in the active locale and leave the textarea as
         the primary path (Req 5.8). */
      setErrorCode('unsupported');
      setErrorText(recognitionErrorText('unsupported', localeRef.current));
      setFellBackToText(true);
      return;
    }

    engine.lang = speechLangFor(localeRef.current);
    interimRef.current = '';
    setInterim('');
    setErrorText(null);
    setErrorCode(null);

    try {
      engine.start();
    } catch {
      /* `InvalidStateError` when an engine is already open. Recycle it rather
         than leaving a button that does nothing on every subsequent press. */
      teardown(engine);
      engineRef.current = null;
      setListening(false);
    }
  }, [build, listening, teardown]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.stop();
    } catch {
      teardown(engine);
      engineRef.current = null;
      setListening(false);
    }
  }, [teardown]);

  const reset = useCallback(() => {
    interimRef.current = '';
    setInterim('');
    setErrorText(null);
    setErrorCode(null);
    setFellBackToText(false);
  }, []);

  /* Unmount: abort and null every handler. A live microphone that outlives its
     screen is the single worst bug this module could ship. */
  useEffect(() => {
    deadRef.current = false;
    return () => {
      deadRef.current = true;
      teardown(engineRef.current);
      engineRef.current = null;
    };
  }, [teardown]);

  return useMemo(
    () => ({
      supported,
      listening,
      interim,
      errorText,
      errorCode,
      fellBackToText,
      start,
      stop,
      reset,
    }),
    [
      supported,
      listening,
      interim,
      errorText,
      errorCode,
      fellBackToText,
      start,
      stop,
      reset,
    ],
  );
}
