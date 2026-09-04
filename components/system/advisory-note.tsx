'use client';

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

/**
 * The advisory notice of Requirement 10.1. It is rendered from INSIDE
 * `<RiskBadge>` and `<AiSummary>` rather than beside them at each call site, so
 * a caller cannot render AI output without it. Structural, not a convention.
 *
 * Measure is capped at 65–75ch, which is where prose stays readable.
 */
export function AdvisoryNote({ className }: { className?: string }) {
  const { t, locale } = useT();

  return (
    <p
      lang={locale}
      className={cn(
        'flex max-w-[70ch] items-start gap-2 text-caption font-semibold text-ink-muted',
        className,
      )}
    >
      <Info aria-hidden="true" className="mt-px size-4 shrink-0" />
      <span>{t('advisory.notice')}</span>
    </p>
  );
}
