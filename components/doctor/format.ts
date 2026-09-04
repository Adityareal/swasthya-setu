import type { SupportedLanguage } from '@/lib/types';

/**
 * Date formatting for the doctor surfaces. Both helpers fall back to the raw
 * string on an unparseable value rather than rendering `Invalid Date`, which is
 * the one output a clinician must never see next to a vital.
 */

export function formatDate(iso: string, locale: SupportedLanguage): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string, locale: SupportedLanguage): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const at = new Date(parsed);
  return `${at.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}, ${at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}
