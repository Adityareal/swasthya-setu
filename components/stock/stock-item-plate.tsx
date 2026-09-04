'use client';

import type { StockRow } from '@/lib/data/repo';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { StockLevelChip, LEVEL_RAIL } from './stock-level-chip';

/**
 * One medicine at one facility.
 *
 * A PLATE, not a table row. At 360px a four-column table either scrolls
 * sideways or shrinks its type below the floor, and Requirement 22.3 has no
 * exception for tables. Stacked plates cost vertical space, which a phone has.
 *
 * The reorder threshold is shown rather than implied, so `low` is explicable —
 * "18 left, reorder below 30" is a fact a worker can act on, where a bare amber
 * chip is a mood.
 */
export function StockItemPlate({ row }: { row: StockRow }) {
  const { t, locale } = useT();

  return (
    <Plate as="li" state={LEVEL_RAIL[row.level]} className="p-4">
      <div className="flex min-w-0 flex-col gap-3">
        <span
          lang={locale}
          className="block text-title leading-tight font-semibold break-words text-ink"
        >
          {row.medicine}
        </span>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex flex-col items-start leading-none">
            <span className="text-caption font-semibold text-ink-muted uppercase">
              {t('stock.quantity')}
            </span>
            <span className="tabular mt-0.5 text-headline leading-none font-extrabold text-ink">
              {row.quantity}
            </span>
          </span>

          <StockLevelChip level={row.level} />
        </div>

        <p className="tabular text-caption font-semibold text-ink-muted">
          {t('stock.reorder.threshold', { n: row.reorderThreshold })}
        </p>
      </div>
    </Plate>
  );
}
