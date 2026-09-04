'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';

/**
 * One labelled field, one error slot. The three doctor forms — decision,
 * prescription, referral — all need exactly this, and writing it once is what
 * keeps `aria-invalid` and `aria-describedby` wired the same way in all three
 * rather than in two of them.
 *
 * The error is rendered HERE, beneath its own control, because Requirements
 * 15.6 and 16.2 both ask for a FIELD-level message: a summary banner at the top
 * of a form does not tell the doctor which box to fix.
 */
export function Field({
  id,
  label,
  optional = false,
  errorKey,
  children,
  className,
}: {
  id: string;
  label: MessageKey;
  optional?: boolean;
  errorKey?: MessageKey | null;
  children: ReactNode;
  className?: string;
}) {
  const { t, locale } = useT();

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={id}
        lang={locale}
        className="text-caption font-semibold text-ink-muted uppercase"
      >
        {t(label)}
        <span className="ml-1 normal-case">
          {optional ? `(${t('common.optional')})` : `(${t('common.required')})`}
        </span>
      </label>

      {children}

      {errorKey && (
        <p
          id={`${id}-error`}
          role="alert"
          lang={locale}
          className="text-caption font-semibold text-high"
        >
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}

/** A plate-shaped skeleton. Loading is never a bare spinner over content. */
export function PlateSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-plate flex flex-col gap-2 p-4', className)}
    >
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className={cn(
            'block h-4 rounded-plate bg-ink/10',
            i % 3 === 0 && 'w-full',
            i % 3 === 1 && 'w-4/5',
            i % 3 === 2 && 'w-3/5',
          )}
        />
      ))}
    </div>
  );
}
