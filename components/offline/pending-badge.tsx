'use client';

import { CloudUpload, RefreshCw } from 'lucide-react';
import type { QueueCounts } from '@/lib/data/repo';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useQueue } from '@/lib/offline/use-queue';

/**
 * Pending_Badge (Req 19.3) — a chip on the shell's sync icon.
 *
 * Both numbers are DERIVED by `deriveCounts` from the queue's actual contents,
 * never incremented at a call site. A badge maintained by hand drifts the first
 * time a write is enqueued on a path that forgets to bump it, and a badge that
 * lies about unsent patient data is worse than no badge at all.
 *
 * Both run tabular. These digits change in place while a replay drains the queue,
 * and proportional numerals would make the icon jitter sideways as 10 becomes 9.
 *
 * Renders nothing when the queue is empty. An always-visible zero is a permanent
 * piece of chrome that says nothing; the Connectivity_Banner already carries the
 * steady-state signal.
 */

export function PendingBadgeCounts({
  counts,
  syncing = false,
  className,
}: {
  counts: QueueCounts;
  syncing?: boolean;
  className?: string;
}) {
  const { t } = useT();

  if (counts.total === 0) return null;

  const label = [
    `${counts.pending} ${t('offline.pending')}`,
    counts.failed > 0 ? `${counts.failed} ${t('offline.failed')}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      aria-label={label}
      role="status"
    >
      {syncing ? (
        <RefreshCw
          aria-hidden="true"
          className="size-5 shrink-0 animate-spin text-chrome-fg"
        />
      ) : (
        <CloudUpload aria-hidden="true" className="size-5 shrink-0 text-chrome-fg" />
      )}

      {counts.pending > 0 && (
        <span className="tabular rounded-chip border-2 border-line bg-surface px-1.5 py-0.5 text-caption leading-none font-extrabold text-action">
          {counts.pending}
        </span>
      )}
      {counts.failed > 0 && (
        <span className="tabular rounded-chip border-2 border-line bg-surface px-1.5 py-0.5 text-caption leading-none font-extrabold text-high">
          {counts.failed}
        </span>
      )}
    </span>
  );
}

/** The self-subscribing form, for the shell. */
export function PendingBadge({ className }: { className?: string }) {
  const { counts, syncing } = useQueue();
  return (
    <PendingBadgeCounts
      counts={counts}
      syncing={syncing}
      {...(className ? { className } : {})}
    />
  );
}
