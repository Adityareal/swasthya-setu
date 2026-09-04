'use client';

import { cn } from '@/lib/utils';
import { useT, type MessageKey, type TranslateParams } from '@/lib/i18n';

/**
 * Signature move 3 — The Bilingual Signage Stack.
 *
 * The active locale at full size and weight, with the other locale directly
 * beneath at caption size in muted ink, on a tight leading — exactly the way a
 * railway platform board stacks Devanagari over Latin.
 *
 * Scoped deliberately to DECISION SURFACES: risk verdicts, facility names,
 * token labels, primary actions, nav destinations. Not body prose, not table
 * cells, where doubling the text would cost more than it returns.
 *
 * Requirement 2.2 (icon + label in the active language) is satisfied by the
 * stack, with the second language arriving free.
 */
export function BiLabel({
  k,
  params,
  className,
  secondaryClassName,
  as: Tag = 'span',
}: {
  k: MessageKey;
  params?: TranslateParams;
  className?: string;
  secondaryClassName?: string;
  as?: 'span' | 'div';
}) {
  const { t, tOther, locale, other } = useT();

  return (
    <Tag className={cn('flex flex-col items-start leading-tight', className)}>
      <span lang={locale}>{t(k, params)}</span>
      <span
        lang={other}
        aria-hidden="true"
        className={cn('text-caption font-semibold text-ink-muted', secondaryClassName)}
      >
        {tOther(k, params)}
      </span>
    </Tag>
  );
}

/**
 * The same stack over literal strings rather than message keys — for a facility
 * name or a patient name, which are data and not copy.
 */
export function BiText({
  primary,
  secondary,
  className,
  secondaryClassName,
}: {
  primary: string;
  secondary?: string;
  className?: string;
  secondaryClassName?: string;
}) {
  const { locale, other } = useT();

  return (
    <span className={cn('flex flex-col items-start leading-tight', className)}>
      <span lang={locale}>{primary}</span>
      {secondary && secondary !== primary && (
        <span
          lang={other}
          aria-hidden="true"
          className={cn(
            'text-caption font-semibold text-ink-muted',
            secondaryClassName,
          )}
        >
          {secondary}
        </span>
      )}
    </span>
  );
}
