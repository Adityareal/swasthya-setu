'use client';

import { Mic, MicOff, Square } from 'lucide-react';
import type { SupportedLanguage } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The Voice_Module capture control (Req 5.6, 5.8).
 *
 * ONE PRESS, ONE UTTERANCE — a walkie-talkie, not a toggle that stays hot. The
 * hook behind it runs `continuous = false` and does not restart on `onend`, so
 * the button's two states are the whole model: press to listen, press to stop.
 *
 * 56px, not 44px. `--ss-touch-field` is the floor for one-handed field actions,
 * and this is the most one-handed action in the product: an ASHA holding a phone
 * in one hand and a patient's wrist in the other, outdoors, standing up.
 *
 * IT IS DISABLED, NEVER HIDDEN, WHEN `SpeechRecognition` IS ABSENT. Hiding it
 * would leave a user who was told the app listens hunting for a control that is
 * not there and concluding the app is broken; a greyed-out mic with one line of
 * caption underneath says what happened and what to do instead in the time it
 * takes to read it. The caption is the caller's job — see `VoiceCaption` — so
 * the button stays a button.
 */
export function MicButton({
  listening,
  supported,
  disabled = false,
  labels,
  locale,
  describedBy,
  onStart,
  onStop,
  className,
}: {
  listening: boolean;
  /** `false` on Firefox and iOS Safari. Renders disabled. */
  supported: boolean;
  /** Independently disabled — e.g. a request is in flight. */
  disabled?: boolean;
  labels: { listen: string; stop: string; unsupported: string };
  locale: SupportedLanguage;
  /** Ids of the caption and interim text, so the state is announced with it. */
  describedBy?: string;
  onStart: () => void;
  onStop: () => void;
  className?: string;
}) {
  const off = !supported || disabled;
  const label = !supported
    ? labels.unsupported
    : listening
      ? labels.stop
      : labels.listen;
  const Icon = !supported ? MicOff : listening ? Square : Mic;

  return (
    <button
      type="button"
      lang={locale}
      /* A toggle, so the state is in the accessibility tree rather than only in
         the fill colour. */
      aria-pressed={listening}
      aria-label={label}
      title={label}
      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
      disabled={off}
      onClick={listening ? onStop : onStart}
      data-listening={listening ? 'true' : undefined}
      className={cn(
        /* The plate identity, by hand rather than through `<Button>`, because a
           56px square icon control with a live state needs its own fill rule and
           two variants would be a worse abstraction than one element. */
        'inline-flex size-touch-lg shrink-0 items-center justify-center rounded-plate border-2 border-line shadow-plate transition-all duration-(--ss-dur-fast) ease-(--ss-ease) outline-none select-none',
        'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)]',
        'disabled:pointer-events-none disabled:border-line-soft disabled:bg-sunk disabled:text-ink-muted disabled:shadow-none',
        listening ? 'bg-action text-action-fg' : 'bg-surface text-ink hover:bg-sunk',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-6" />
    </button>
  );
}

/**
 * The line under the composer that says what voice is doing, or why it is not
 * doing anything.
 *
 * Req 5.8's user-visible half. A recognition failure is reported here and the
 * textarea above it keeps the words already spoken, so the error is a note beside
 * a usable field rather than a dead end. The plate rail carries the reading
 * before the sentence is parsed: action-blue while listening, crimson on a
 * failure, no rail for the plain unsupported notice — which is information, not
 * an error, and should not look like one.
 */
export function VoiceCaption({
  text,
  tone,
  locale,
  id,
  className,
}: {
  text: string;
  tone: 'listening' | 'error' | 'note';
  locale: SupportedLanguage;
  id?: string;
  className?: string;
}) {
  if (text.trim() === '') return null;

  return (
    <p
      {...(id ? { id } : {})}
      lang={locale}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'plate max-w-[70ch] px-3 py-2 text-caption font-semibold text-ink',
        className,
      )}
      {...(tone === 'listening'
        ? { 'data-state': 'action' as const }
        : tone === 'error'
          ? { 'data-state': 'error' as const }
          : {})}
    >
      {text}
    </p>
  );
}
