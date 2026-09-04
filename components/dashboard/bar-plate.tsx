'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';

/**
 * CSS bar plates. No chart library anywhere in this product.
 *
 * A chart library is twenty minutes of configuration for a mocked heuristic, it
 * arrives with its own type scale, its own rounded corners and its own tooltip,
 * and every one of those fights the enamel identity. A bar here is a `<div>`
 * inside a sunk track: two tokens, one computed width, and it reads at 360px.
 *
 * Each bar is `role="img"` with an `aria-label` carrying the REAL count and
 * share, so the chart is not a picture a screen reader has to guess at. The
 * numbers are also printed next to every bar, which is the same information in
 * the visual channel — nobody has to interpret a length.
 */

export interface BarRowDatum {
  key: string;
  label: string;
  /** The other locale, for the signage stack on the row label. */
  secondary?: string;
  count: number;
  percent: number;
  width: number;
  /** A fill class. Defaults to ink: the signal palette means RISK in this
   *  product, and using crimson for "appointments at the district hospital"
   *  would spend a colour that has a job. */
  fill?: string;
}

export function BarRow({ datum }: { datum: BarRowDatum }) {
  const { locale, other } = useT();

  return (
    <li className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span lang={locale} className="text-body font-semibold break-words text-ink">
            {datum.label}
          </span>
          {datum.secondary && datum.secondary !== datum.label && (
            <span
              lang={other}
              aria-hidden="true"
              className="text-caption font-semibold text-ink-muted"
            >
              {datum.secondary}
            </span>
          )}
        </span>
        <span className="tabular shrink-0 text-body font-extrabold text-ink">
          {datum.count}
          <span className="text-caption font-semibold text-ink-muted">
            {' · '}
            {datum.percent}%
          </span>
        </span>
      </div>

      <div
        role="img"
        aria-label={`${datum.label}: ${datum.count} (${datum.percent}%)`}
        className="h-5 w-full overflow-hidden rounded-plate border-2 border-line bg-sunk"
      >
        {/* The width is data, so it is the one inline style on the screen. */}
        <div
          className={cn('h-full', datum.fill ?? 'bg-ink')}
          style={{ width: `${datum.width}%` }}
        />
      </div>
    </li>
  );
}

export function BarPlate({
  titleKey,
  icon: Icon,
  caption,
  bars,
  emptyKey = 'dashboard.empty',
}: {
  titleKey: MessageKey;
  icon?: LucideIcon;
  caption?: ReactNode;
  bars: BarRowDatum[];
  emptyKey?: MessageKey;
}) {
  const nothing = bars.length === 0 || bars.every((bar) => bar.count === 0);

  return (
    <Plate className="p-3" as="section">
      <h2 className="flex items-center gap-2">
        {Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-action" />}
        <BiLabel k={titleKey} className="text-title font-semibold text-ink" />
      </h2>

      {caption && (
        <p className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted">
          {caption}
        </p>
      )}

      {nothing ? (
        <BiLabel
          k={emptyKey}
          className="mt-3 text-caption font-semibold text-ink-muted"
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {bars.map((datum) => (
            <BarRow key={datum.key} datum={datum} />
          ))}
        </ul>
      )}
    </Plate>
  );
}
