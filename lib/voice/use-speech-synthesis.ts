'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportedLanguage } from '@/lib/types';
import { getSpeechSynthesis } from './speech-api';
import { selectVoice, speechLangFor } from './select-voice';

/**
 * Voice_Module — SpeechSynthesis readback (Req 11.1, 11.2, 11.3).
 *
 * THE ASYNCHRONOUS VOICE LIST IS THE WHOLE PROBLEM. `speechSynthesis.getVoices()`
 * returns `[]` on the first call in every Chromium build: the list is populated
 * out of band and announced with a `voiceschanged` event. Code that selects a
 * voice on mount therefore selects nothing, concludes "no Hindi voice", and shows
 * the Req 11.3 unavailable notice on a device that has one installed.
 *
 * So selection waits. `ready` stays `false` until either the list arrives or a
 * bounded wait expires — and `voiceUnavailable` is `ready && voice === null`,
 * never just `voice === null`, so the notice cannot flash during the wait. The
 * timeout matters as much as the event: a browser whose voices are ALREADY loaded
 * may never fire `voiceschanged` at all, and without the timeout that device
 * would sit in an unresolved state forever.
 *
 * A `null` voice DOES NOT FALL BACK TO THE DEFAULT VOICE. Speaking Devanagari
 * through an `en-US` engine produces fast confident nonsense for a listener who
 * cannot read the screen either — strictly worse than the honest outcome
 * Req 11.3 asks for: show the guidance as text, and say plainly that audio is
 * unavailable on this device. `speak()` returns `false` and the caller renders
 * both.
 */

export interface SpeechSynthesisHandle {
  /** `speechSynthesis` exists at all. */
  supported: boolean;
  /** The voice list has resolved, so `voice` is a real answer. */
  ready: boolean;
  /** The chosen voice, or `null` when nothing in the requested family exists. */
  voice: SpeechSynthesisVoice | null;
  /** Req 11.3 — show the guidance as text and say audio is unavailable. */
  voiceUnavailable: boolean;
  speaking: boolean;
  /** `false` when nothing was spoken, so the caller can show the text instead. */
  speak: (text: string) => boolean;
  cancel: () => void;
}

/** Long enough for a cold voice list on a slow handset, short enough that the
 *  Req 11.3 notice appears while the user is still looking at the screen. */
const VOICE_WAIT_MS = 1500;

export function useSpeechSynthesis(locale: SupportedLanguage): SpeechSynthesisHandle {
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  /* Chromium garbage-collects an utterance that nothing references, which cuts
     playback off mid-sentence. Holding it here keeps it alive. */
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const deadRef = useRef(false);

  useEffect(() => {
    deadRef.current = false;
    const synth = getSpeechSynthesis();
    if (!synth) {
      /* No engine. `ready` is true because the answer is settled: there is no
         voice, and Req 11.3 applies immediately. */
      setSupported(false);
      setReady(true);
      return;
    }
    setSupported(true);

    const read = () => {
      const list = synth.getVoices() ?? [];
      if (deadRef.current) return;
      setVoices(list);
      if (list.length > 0) setReady(true);
    };

    read();

    const onVoicesChanged = () => read();
    synth.addEventListener?.('voiceschanged', onVoicesChanged);

    /* The list may already be loaded, in which case `voiceschanged` never
       fires. Settle anyway rather than waiting forever. */
    const timer = window.setTimeout(() => {
      if (!deadRef.current) {
        read();
        setReady(true);
      }
    }, VOICE_WAIT_MS);

    return () => {
      deadRef.current = true;
      window.clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', onVoicesChanged);
      try {
        synth.cancel();
      } catch {
        /* Cancelling an idle queue throws on some builds; nothing to recover. */
      }
    };
  }, []);

  /* Req 11.2 — the locale here is the PATIENT's `preferredLanguage`, passed in by
     the caller, deliberately not the device locale. */
  const voice = useMemo(() => selectVoice(voices, locale), [voices, locale]);

  const cancel = useCallback(() => {
    const synth = getSpeechSynthesis();
    if (!synth) return;
    try {
      synth.cancel();
    } catch {
      /* Idle queue. */
    }
    utteranceRef.current = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string): boolean => {
      const synth = getSpeechSynthesis();
      const body = (text ?? '').trim();
      if (!synth || body === '' || voice === null) return false;

      try {
        synth.cancel();
      } catch {
        /* Idle queue. */
      }

      const utterance = new SpeechSynthesisUtterance(body);
      utterance.voice = voice;
      utterance.lang = speechLangFor(locale);
      /* Slightly under natural pace. The listener is being told what to do about
         their own health, in a second language as often as not. */
      utterance.rate = 0.92;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => {
        if (deadRef.current) return;
        utteranceRef.current = null;
        setSpeaking(false);
      };
      utterance.onerror = () => {
        if (deadRef.current) return;
        utteranceRef.current = null;
        setSpeaking(false);
      };

      utteranceRef.current = utterance;
      setSpeaking(true);
      try {
        synth.speak(utterance);
      } catch {
        utteranceRef.current = null;
        setSpeaking(false);
        return false;
      }
      return true;
    },
    [locale, voice],
  );

  return useMemo(
    () => ({
      supported,
      ready,
      voice,
      voiceUnavailable: ready && voice === null,
      speaking,
      speak,
      cancel,
    }),
    [supported, ready, voice, speaking, speak, cancel],
  );
}
