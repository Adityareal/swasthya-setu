'use client';

import { useState } from 'react';
import { ChevronDown, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { QueueInspector } from '@/components/offline/queue-inspector';
import { SimulateOfflineToggle } from '@/components/offline/simulate-offline-toggle';
import { useConnectivity, useQueue } from '@/lib/offline/use-queue';

/**
 * Connectivity_Banner (Req 19.1) — always rendered, in every workspace.
 *
 * ONLINE it is quiet: a `--ss-low` rail collapsed to one caption line, because a
 * banner that shouts when everything is fine is a banner people learn to stop
 * reading, and then it is useless on the day it matters.
 *
 * OFFLINE it takes the `--ss-med-fill` ground with ink text and a 45° ink
 * hazard-stripe rail. The barrier-tape reading is instant and needs no words,
 * which matters when the person reading it is not reading — an ASHA_User mid-visit
 * glances at the top of the screen, sees stripes, and knows the entry is being
 * held on the phone. The words are there for when she looks properly.
 *
 * Connectivity comes from `lib/offline/simulate.ts`, never from raw
 * `navigator.onLine`: effective state is `navigator.onLine && !simulatedOffline`,
 * and if the banner read the browser directly the demo switch would flip the
 * queue's behaviour while the banner cheerfully claimed everything was online.
 *
 * The expanded state holds the read-only queue inspector and the simulate switch.
 * Req 19.6 excludes a sync management screen, so neither is a route.
 */
export function ConnectivityBanner() {
  const { t, locale } = useT();
  const { online } = useConnectivity();
  const { writes, counts, syncing, retry } = useQueue();
  const [expanded, setExpanded] = useState(false);

  const held = counts.total > 0;

  const statusKey = syncing
    ? 'offline.syncing'
    : online
      ? held
        ? 'offline.pending'
        : 'offline.online'
      : 'offline.offline';

  return (
    <div
      className={cn('plate px-4 py-1.5', !online && 'relative overflow-hidden py-2 pl-5')}
      data-state={online ? 'low' : 'offline'}
    >
      {!online && (
        <span
          aria-hidden="true"
          className="hazard-rail pointer-events-none absolute inset-y-0 left-0 w-2"
        />
      )}

      <div className="mx-auto flex max-w-screen-lg flex-wrap items-center gap-x-2 gap-y-1">
        {online ? (
          <Wifi aria-hidden="true" className="size-4 shrink-0 text-low" />
        ) : (
          <WifiOff aria-hidden="true" className="size-5 shrink-0 text-ink" />
        )}

        <span
          role="status"
          lang={locale}
          className={cn(
            'min-w-0 text-caption font-semibold',
            online ? 'text-ink-muted' : 'text-ink',
          )}
        >
          {t(statusKey)}
        </span>

        {/* Derived from queue contents, never from a counter. */}
        {counts.pending > 0 && (
          <span
            aria-label={`${counts.pending} ${t('offline.pending')}`}
            className="tabular rounded-chip border-2 border-line bg-surface px-2 py-0.5 text-caption leading-none font-extrabold text-action"
          >
            {counts.pending}
          </span>
        )}
        {counts.failed > 0 && (
          <span
            aria-label={`${counts.failed} ${t('offline.failed')}`}
            className="tabular rounded-chip border-2 border-line bg-surface px-2 py-0.5 text-caption leading-none font-extrabold text-high"
          >
            {counts.failed}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Manual retry. Present whenever anything is held, including while
              offline: the browser's own `online` event is unreliable on Android
              after a screen-off, so a person must always be able to force the
              attempt rather than wait for an event that may never arrive. */}
          {held && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncing}
              onClick={retry}
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('size-4', syncing && 'animate-spin')}
              />
              <span lang={locale}>{t('offline.retry')}</span>
            </Button>
          )}

          <button
            type="button"
            aria-expanded={expanded}
            aria-label={t('offline.queue.title')}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'inline-flex min-h-touch min-w-touch items-center justify-center rounded-plate border-2 border-line bg-surface px-2',
              'transition-transform duration-(--ss-dur-fast) ease-(--ss-ease)',
            )}
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-5 text-ink transition-transform duration-(--ss-dur-fast)',
                expanded && 'rotate-180',
              )}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mx-auto mt-3 flex max-w-screen-lg flex-col gap-3 border-t-2 border-line pt-3">
          <SimulateOfflineToggle />

          <section>
            <h2 lang={locale} className="text-caption font-semibold text-ink uppercase">
              {t('offline.queue.title')}
            </h2>
            <QueueInspector writes={writes} className="mt-2" />
          </section>
        </div>
      )}
    </div>
  );
}
