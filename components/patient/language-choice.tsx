'use client';

import { useState } from 'react';
import { Check, Languages } from 'lucide-react';
import type { SupportedLanguage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { SUPPORTED_LANGUAGES, useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';

/**
 * Req 6.1–6.3 — the patient's language control, and the first thing on the
 * screen because it gates comprehension of everything below it.
 *
 * The shell already carries a compact toggle in the chrome. This is the same
 * choice at patient scale: two 56px plates, the language written in its own
 * script, and no dependence on reading the label of the language you cannot
 * read. A first-time user should be able to fix the language of the whole app
 * without knowing where the chrome is.
 *
 * Selecting a language does two writes, and both matter:
 *   `setLocale`                  — re-renders the shell now (Req 6.2)
 *   `repo.updatePatientLanguage` — persists to `patients.preferred_language`,
 *                                  so a later session opens in it (Req 6.3)
 *
 * Exactly the two Supported_Language values, taken from `SUPPORTED_LANGUAGES`
 * rather than written out here, so a third locale cannot appear by omission.
 */

/** Each language named in its own script: the point is recognition, not reading. */
const ENDONYM: Record<SupportedLanguage, string> = {
  'en-IN': 'English',
  'hi-IN': 'हिन्दी',
};

export function LanguageChoice({
  patientId,
  className,
}: {
  patientId: string;
  className?: string;
}) {
  const { t, locale } = useT();
  const setLocale = useAppStore((s) => s.setLocale);
  const [saved, setSaved] = useState(false);

  function choose(next: SupportedLanguage) {
    setLocale(next);
    setSaved(true);
    void repo.updatePatientLanguage(patientId, next);
  }

  return (
    <section className={cn('plate p-4', className)} data-state="action">
      <h2 className="flex items-center gap-2">
        <Languages aria-hidden="true" className="size-6 shrink-0 text-ink" />
        <span lang={locale} className="text-title font-semibold text-ink">
          {t('patient.language.select')}
        </span>
      </h2>

      <div
        role="group"
        aria-label={t('patient.language.select')}
        className="mt-3 grid grid-cols-2 gap-3"
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = lang === locale;
          return (
            <button
              key={lang}
              type="button"
              lang={lang}
              aria-pressed={active}
              onClick={() => choose(lang)}
              className={cn(
                'flex min-h-touch-lg items-center justify-center gap-2 rounded-plate border-2 border-line px-3 py-2 text-title font-semibold transition-all duration-(--ss-dur-fast) ease-(--ss-ease)',
                'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)]',
                active
                  ? 'bg-action text-action-fg shadow-plate'
                  : 'bg-surface text-ink shadow-plate',
              )}
            >
              {active && <Check aria-hidden="true" className="size-5 shrink-0" />}
              {ENDONYM[lang]}
            </button>
          );
        })}
      </div>

      {/* Announced, not just drawn: the confirmation is for the person who just
          tapped and is watching the two buttons, not reading a caption. */}
      <p
        role="status"
        lang={locale}
        className={cn(
          'mt-2 text-caption font-semibold text-ink-muted',
          !saved && 'sr-only',
        )}
      >
        {saved ? t('patient.language.saved') : ''}
      </p>
    </section>
  );
}
