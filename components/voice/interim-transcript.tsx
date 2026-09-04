'use client';

import type { SupportedLanguage } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The provisional guess for the utterance in flight (Req 5.6).
 *
 * WHY THIS IS NOT INSIDE THE TEXTAREA. A `<textarea>` holds one flat string with
 * one style, so there is no way to show "these words are settled and those are a
 * guess" inside it. Final chunks therefore go into the composer — the editable
 * transcript holder — and the unsettled tail is rendered here, directly beneath
 * it, where it can carry its own treatment and where deleting it costs the user
 * nothing because it was never text they typed.
 *
 * WHY IT IS NEVER ITALIC. `font-style: italic` is the reflex for provisional
 * text and it is wrong for this product. Devanagari has no true italic form, so
 * a browser asked for one synthesises an oblique by shearing the glyphs — which
 * skews the matras and the shirorekha off their baseline and reads as a
 * rendering fault rather than as emphasis. `not-italic` is therefore stated
 * explicitly rather than merely omitted: it is a decision, and an inherited
 * italic from an ancestor must not be able to undo it.
 *
 * The distinction is carried by muted ink plus a dashed underline instead. Both
 * survive Devanagari, both survive a grayscale print, and the dashes read as
 * "not finished" in the same way a dashed border does everywhere else in this
 * design system.
 */
export function InterimTranscript({
  text,
  label,
  locale,
  id,
  className,
}: {
  text: string;
  /** `voice.interim` — "Heard so far", so the dashes are explained in words. */
  label: string;
  locale: SupportedLanguage;
  id?: string;
  className?: string;
}) {
  if (text.trim() === '') return null;

  return (
    <p
      {...(id ? { id } : {})}
      lang={locale}
      /* `aria-live` is deliberately absent. The interim string is replaced on
         every recognition frame, and announcing each revision would talk over
         the person still speaking. The settled text lands in the composer, which
         a screen reader can be moved to at will. */
      className={cn('flex flex-col gap-0.5', className)}
    >
      <span className="text-caption font-semibold text-ink-muted uppercase">
        {label}
      </span>
      <span className="max-w-[70ch] text-field break-words text-ink-muted not-italic underline decoration-dashed decoration-2 underline-offset-4">
        {text}
      </span>
    </p>
  );
}
