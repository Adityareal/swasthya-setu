'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { QueuedWrite, QueuedWriteKind } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';

/**
 * The held writes, read-only.
 *
 * Requirement 19.6 excludes a sync management SCREEN, so this is not a route and
 * has no controls: no per-item retry, no delete, no reorder, no conflict
 * resolution. It lives inside the Connectivity_Banner's expanded state, because
 * the honest need it serves is "what exactly is still on this phone" — a question
 * an ASHA_User asks once, standing in a doorway, before walking home. Answering
 * it needs a list. Managing it needs a product decision nobody has made.
 *
 * Ordered oldest-first, matching the order replay will apply them in, so the list
 * doubles as a preview of what happens on reconnect.
 */

const KIND_KEY: Record<QueuedWriteKind, MessageKey> = {
  intake: 'offline.queue.kind.intake',
  referral: 'offline.queue.kind.referral',
  prescription: 'offline.queue.kind.prescription',
  'clinical-decision': 'offline.queue.kind.clinical-decision',
};

/** Compact relative age. `Intl` carries both Supported_Language values, so this
 *  needs no message key and stays correct when the locale flips. */
function formatAge(locale: string, createdAt: string, now: number): string | null {
  const then = Date.parse(createdAt);
  if (!Number.isFinite(then)) return null;

  const seconds = Math.max(0, Math.round((now - then) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (seconds < 60) return rtf.format(-seconds, 'second');
  if (seconds < 3600) return rtf.format(-Math.round(seconds / 60), 'minute');
  if (seconds < 86400) return rtf.format(-Math.round(seconds / 3600), 'hour');
  return rtf.format(-Math.round(seconds / 86400), 'day');
}

export function QueueInspector({
  writes,
  className,
}: {
  writes: QueuedWrite[];
  className?: string;
}) {
  const { t, locale } = useT();

  /* `Date.now()` at render would differ between the server pass and the first
     client pass and trip hydration. Read the clock in an effect instead, and
     leave the age off until it is available. */
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
  }, [writes]);

  if (writes.length === 0) {
    return (
      <p
        lang={locale}
        className={cn('text-caption font-semibold text-ink-muted', className)}
      >
        {t('offline.queue.empty')}
      </p>
    );
  }

  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {writes.map((write) => {
        const age = now === null ? null : formatAge(locale, write.createdAt, now);
        const failed = write.status === 'failed';

        return (
          <li
            key={write.id}
            className="plate flex flex-col gap-1 p-3"
            data-state={failed ? 'high' : 'medium'}
          >
            <div className="flex flex-wrap items-center gap-2">
              {failed ? (
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-high" />
              ) : (
                <Clock aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />
              )}
              <span lang={locale} className="text-caption font-semibold text-ink">
                {t(KIND_KEY[write.kind])}
              </span>
              {age && (
                <span
                  lang={locale}
                  className="tabular text-caption font-semibold text-ink-muted"
                >
                  {age}
                </span>
              )}
              {write.attempts > 0 && (
                <span
                  lang={locale}
                  className="tabular ml-auto text-caption font-semibold text-ink-muted"
                >
                  {t('offline.queue.attempts')} {write.attempts}
                </span>
              )}
            </div>

            {failed && (
              <p lang={locale} className="text-caption font-semibold text-high">
                {t('offline.failed')}
                {write.lastError ? ` · ${write.lastError}` : ''}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
