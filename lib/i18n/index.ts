'use client';

import { useEffect } from 'react';
import type { SupportedLanguage } from '@/lib/types';
import enIN from './en-IN';
import hiIN from './hi-IN';
import { useAppStore } from '@/lib/store';

/** `en-IN` is the type source: a key absent from `hi-IN` is a compile error. */
export type MessageKey = keyof typeof enIN;

export const CATALOGUES: Record<SupportedLanguage, Record<MessageKey, string>> = {
  'en-IN': enIN,
  'hi-IN': hiIN,
};

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en-IN', 'hi-IN'];

/** The other locale — the one the Bilingual Signage Stack sets beneath. */
export function otherLocale(locale: SupportedLanguage): SupportedLanguage {
  return locale === 'en-IN' ? 'hi-IN' : 'en-IN';
}

export type TranslateParams = Record<string, string | number>;

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
}

/** Pure lookup, usable outside React (route handlers, pure helpers, tests). */
export function translate(
  locale: SupportedLanguage,
  key: MessageKey,
  params?: TranslateParams,
): string {
  return interpolate(CATALOGUES[locale][key], params);
}

export interface Translator {
  t: (key: MessageKey, params?: TranslateParams) => string;
  /** The same key in the other locale, for the Bilingual Signage Stack. */
  tOther: (key: MessageKey, params?: TranslateParams) => string;
  locale: SupportedLanguage;
  other: SupportedLanguage;
}

/**
 * Reads the locale from the store and keeps `document.documentElement.lang` in
 * step, which is what makes the script-aware Devanagari leading apply without a
 * per-component class.
 */
export function useT(): Translator {
  const locale = useAppStore((s) => s.locale);
  const other = otherLocale(locale);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return {
    locale,
    other,
    t: (key, params) => translate(locale, key, params),
    tOther: (key, params) => translate(other, key, params),
  };
}
