'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { MockPlate } from '@/components/system/mock-plate';
import { useConnectivity } from '@/lib/offline/use-queue';

/**
 * The demo control that makes this beat presentable.
 *
 * The offline story is the strongest thing in the product and the hardest thing
 * to show: `navigator.onLine` is read-only, airplane mode kills the projector's
 * wifi, and toggling a system radio mid-demo puts an OS panel on screen for five
 * seconds while everyone waits. So the switch lives in the shell, and effective
 * connectivity is `navigator.onLine && !simulatedOffline` — flipping this
 * demonstrates capture, the hazard-striped banner, the pending badge, and the
 * replay-on-reconnect, in sequence, without touching a radio.
 *
 * Wrapped in `<MockPlate>` because it IS a demo affordance and Req 20.1 says a
 * simulated surface must say so. A control that fakes a network condition and
 * does not admit it is the exact thing the Mock_Badge exists to prevent.
 */
export function SimulateOfflineToggle({ className }: { className?: string }) {
  const { t, locale } = useT();
  const { online, simulated, setSimulated } = useConnectivity();

  /* A genuinely offline device cannot be talked back online by this switch, so
     the switch reports its own flag rather than effective connectivity. */
  const forcedByBrowser = !online && !simulated;

  return (
    <MockPlate className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p lang={locale} className="text-field font-semibold text-ink">
            {t('offline.simulate')}
          </p>
          <p lang={locale} className="mt-0.5 text-caption font-semibold text-ink-muted">
            {simulated ? t('offline.simulate.on') : t('offline.simulate.off')}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={simulated}
          aria-label={t('offline.simulate')}
          disabled={forcedByBrowser}
          onClick={() => setSimulated(!simulated)}
          className={cn(
            /* 44px floor on the whole control, not just the visual track. */
            'inline-flex min-h-touch shrink-0 items-center gap-2 rounded-plate border-2 border-line px-3 shadow-plate',
            'transition-all duration-(--ss-dur-fast) ease-(--ss-ease)',
            'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)]',
            'disabled:pointer-events-none disabled:border-line-soft disabled:bg-sunk disabled:text-ink-muted disabled:shadow-none',
            simulated ? 'bg-med text-ink' : 'bg-surface text-ink',
          )}
        >
          {simulated ? (
            <WifiOff aria-hidden="true" className="size-5 shrink-0" />
          ) : (
            <Wifi aria-hidden="true" className="size-5 shrink-0 text-low" />
          )}
          {/* The track. A flat two-position slot, not a rounded pill: the whole
              product is enamel plates and a pill switch would be the one soft
              object on the screen. */}
          <span
            aria-hidden="true"
            className="relative h-6 w-11 shrink-0 rounded-chip border-2 border-line bg-sunk"
          >
            <span
              className={cn(
                'absolute top-0.5 size-4 rounded-chip border-2 border-line',
                'transition-all duration-(--ss-dur-fast) ease-(--ss-ease)',
                simulated ? 'left-[calc(100%-1.25rem)] bg-ink' : 'left-0.5 bg-surface',
              )}
            />
          </span>
        </button>
      </div>
    </MockPlate>
  );
}
