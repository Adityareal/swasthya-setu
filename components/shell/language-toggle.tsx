'use client';

import { Languages } from 'lucide-react';
import type { SupportedLanguage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { SUPPORTED_LANGUAGES, useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';

const LABEL: Record<SupportedLanguage, string> = {
  'en-IN': 'English',
  'hi-IN': 'हिन्दी',
};

/**
 * Exactly the two Supported_Language values (Req 6.1). Selecting one persists it
 * to the patient's `preferredLanguage` (Req 6.2) and re-renders the shell; the
 * store persists `locale`, so a later session opens in the stored language
 * (Req 6.3).
 */
export function LanguageToggle({
  className,
  onChrome = true,
}: {
  className?: string;
  onChrome?: boolean;
}) {
  const { locale, t } = useT();
  const setLocale = useAppStore((s) => s.setLocale);
  const activeRole = useAppStore((s) => s.activeRole);
  const patientSelfId = useAppStore((s) => s.patientSelfId);

  function choose(next: SupportedLanguage) {
    setLocale(next);
    if (activeRole === 'patient') {
      void repo.setPreferredLanguage(patientSelfId, next);
    }
  }

  return (
    <div
      role="group"
      aria-label={t('app.language')}
      className={cn('flex items-center gap-1', className)}
    >
      <Languages
        aria-hidden="true"
        className={cn('size-4 shrink-0', onChrome ? 'text-chrome-muted' : 'text-ink-muted')}
      />
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
              'min-h-touch rounded-plate border-2 px-2 text-caption font-semibold transition-colors duration-(--ss-dur-fast)',
              active
                ? 'border-line bg-surface text-ink'
                : onChrome
                  ? 'border-chrome-muted bg-transparent text-chrome-fg'
                  : 'border-line bg-sunk text-ink-muted',
            )}
          >
            {LABEL[lang]}
          </button>
        );
      })}
    </div>
  );
}
