'use client';

import { Square, Volume2, VolumeX } from 'lucide-react';
import type { SupportedLanguage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { buildUtterance } from '@/lib/voice/build-utterance';
import { useSpeechSynthesis } from '@/lib/voice/use-speech-synthesis';

/**
 * Voice readback of a Triage_Result (Req 11.1, 11.2, 11.3, 10.3).
 *
 * WHAT IS SPOKEN IS NOT THIS COMPONENT'S DECISION. It passes the summary and the
 * next step to `buildUtterance`, which prepends the advisory notice from the
 * frozen catalogue. That is the whole reason the builder exists: Req 10.3 says
 * spoken output SHALL carry the advisory, and if the string were assembled here
 * the requirement would hold only while every future caller remembered it. There
 * is no code path from this button to `speak()` that omits it.
 *
 * WHICH LANGUAGE IS SPOKEN IS ALSO NOT THE UI'S DECISION. `locale` is the
 * PATIENT's `preferredLanguage`, deliberately a different source from the shell
 * locale (Req 11.2), so an ASHA running the English interface can hand her phone
 * over and play Hindi guidance to the person in front of her. The button's own
 * label stays in the operator's locale, because the operator is the one pressing
 * it. Two locales on one control, each pointed at the person it serves.
 *
 * NO VOICE IS AN ANSWER, NOT A FAILURE (Req 11.3). A missing `hi-IN` voice does
 * not fall back to the device default: an English engine reading Devanagari
 * produces fast confident nonsense for a listener who cannot read the screen
 * either, which is strictly worse than silence. The control disables itself and
 * says so, and the guidance stays on screen as text above it — which is why this
 * component is only ever placed on a surface that already renders the summary
 * and the next step in full.
 */
export function ReadbackButton({
  locale,
  summary,
  nextStep,
  className,
}: {
  /** The patient's `preferredLanguage` (Req 11.2), not the shell locale. */
  locale: SupportedLanguage;
  summary: string | null | undefined;
  nextStep: string | null | undefined;
  className?: string;
}) {
  /* `t` runs in the OPERATOR's locale — the label is for whoever is holding the
     phone. `locale` above is for whoever is listening. */
  const { t, locale: uiLocale } = useT();
  const { ready, speaking, voiceUnavailable, speak, cancel } =
    useSpeechSynthesis(locale);

  const spoken = buildUtterance({ summary, nextStep, locale });
  const blocked = ready && voiceUnavailable;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        lang={uiLocale}
        aria-pressed={speaking}
        /* Until the voice list resolves the answer is genuinely unknown, so the
           control is busy rather than broken. Bounded to 1.5s by the hook. */
        aria-busy={!ready}
        disabled={blocked || !ready}
        onClick={() => {
          if (speaking) cancel();
          else speak(spoken);
        }}
        className={cn(
          'inline-flex min-h-touch-lg items-center justify-center gap-2 rounded-plate border-2 border-line px-5 py-3 text-title font-semibold shadow-plate transition-all duration-(--ss-dur-fast) ease-(--ss-ease) outline-none select-none',
          'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)]',
          'disabled:pointer-events-none disabled:border-line-soft disabled:bg-sunk disabled:text-ink-muted disabled:shadow-none',
          speaking ? 'bg-action text-action-fg' : 'bg-surface text-ink hover:bg-sunk',
        )}
      >
        {blocked ? (
          <VolumeX aria-hidden="true" className="size-6 shrink-0" />
        ) : speaking ? (
          <Square aria-hidden="true" className="size-6 shrink-0" />
        ) : (
          <Volume2 aria-hidden="true" className="size-6 shrink-0" />
        )}
        <span>{speaking ? t('voice.stop') : t('voice.speak')}</span>
      </button>

      {/* Req 11.3 — the unavailable playback is REPORTED, not silently absent.
          `voice.noVoice` also points at the on-screen text, which the surrounding
          surface is already showing. */}
      {blocked && (
        <p
          lang={uiLocale}
          role="status"
          className="plate max-w-[70ch] px-3 py-2 text-caption font-semibold text-ink"
        >
          {t('voice.noVoice')}
        </p>
      )}
    </div>
  );
}
