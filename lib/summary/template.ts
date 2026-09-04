import type { RiskLevel, SupportedLanguage } from '@/lib/types';
import { normaliseTranscript, TRIAGE_KEYWORDS } from '@/lib/triage/fallback';
import type { HistoryItem } from './trim';

/**
 * `composeTemplateSummary` — pure, deterministic, and every sentence is a
 * restatement of stored data. There is no synthesis, no trend claim, and no
 * inference, which is precisely why it is safe to show a doctor without a model
 * behind it, and why it carries the `source: 'template'` label and the same
 * advisory notice.
 *
 * It runs over the SAME `trimHistory` output the Gemini path uses, so both
 * paths summarise exactly the same records.
 */

const RISK_WORD: Record<SupportedLanguage, Record<RiskLevel, string>> = {
  'en-IN': { low: 'LOW', medium: 'MEDIUM', high: 'HIGH' },
  'hi-IN': { low: 'कम', medium: 'मध्यम', high: 'उच्च' },
};

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function formatDate(iso: string, locale: SupportedLanguage): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Term extraction reuses the fallback normaliser and keyword table, so it
 *  needs no new vocabulary and inherits the bilingual matching. */
function recurringTerms(items: HistoryItem[]): string[] {
  const vocabulary = [
    ...TRIAGE_KEYWORDS.high,
    ...TRIAGE_KEYWORDS.medium,
    ...TRIAGE_KEYWORDS.low,
  ];
  const counts = new Map<string, number>();

  for (const item of items) {
    const text = normaliseTranscript(item.symptoms ?? '');
    const seen = new Set<string>();
    for (const term of vocabulary) {
      const needle = normaliseTranscript(term);
      if (needle !== '' && text.includes(needle) && !seen.has(term)) {
        seen.add(term);
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([term]) => term);
}

export function composeTemplateSummary(
  trimmed: HistoryItem[],
  locale: SupportedLanguage,
): string {
  if (trimmed.length === 0) {
    return locale === 'hi-IN'
      ? 'कोई पिछली विज़िट दर्ज नहीं है।'
      : 'No prior visits are recorded.';
  }

  const newest = trimmed[0];
  const oldest = trimmed[trimmed.length - 1];
  const highest = [...trimmed].sort(
    (a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk],
  )[0];
  const terms = recurringTerms(trimmed);
  const withMedicines = trimmed.filter((i) => i.medicines).length;

  const lines: string[] = [];

  if (locale === 'hi-IN') {
    lines.push(
      `${formatDate(oldest.date, locale)} से ${formatDate(newest.date, locale)} के बीच ${trimmed.length} विज़िट दर्ज हैं।`,
    );
    lines.push(
      `सबसे ऊँची दर्ज प्राथमिकता: ${RISK_WORD[locale][highest.risk]}, ${formatDate(highest.date, locale)} को।`,
    );
    if (terms.length > 0) {
      lines.push(`एक से अधिक विज़िट में आए लक्षण: ${terms.join(', ')}।`);
    }
    lines.push(`वर्तमान शिकायत: ${newest.symptoms}`);
    if (withMedicines > 0) {
      lines.push(`इनमें ${withMedicines} विज़िट पर दवाइयाँ दर्ज हैं।`);
    }
    lines.push('दर्ज विज़िट से बनाया गया। कोई क्लीनिकल अनुमान नहीं।');
  } else {
    lines.push(
      `${trimmed.length} visit${trimmed.length === 1 ? '' : 's'} recorded between ${formatDate(oldest.date, locale)} and ${formatDate(newest.date, locale)}.`,
    );
    lines.push(
      `Highest recorded triage priority: ${RISK_WORD[locale][highest.risk]}, on ${formatDate(highest.date, locale)}.`,
    );
    if (terms.length > 0) {
      lines.push(`Complaint terms appearing in more than one visit: ${terms.join(', ')}.`);
    }
    lines.push(`Current complaint: ${newest.symptoms}`);
    if (withMedicines > 0) {
      lines.push(
        `Medicines recorded at ${withMedicines} of these visits.`,
      );
    }
    lines.push('Composed from recorded visits. No clinical inference.');
  }

  return lines.join(' ');
}
