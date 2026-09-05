'use client';

import { Search } from 'lucide-react';
import type { StockLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { Input } from '@/components/ui/input';
import { StockLevelChip } from './stock-level-chip';
import type { StockFilter } from './stock-view';

/**
 * The two controls that turn a stock list into an answer: a name search, and a
 * toggle that hides everything that is fine.
 *
 * Both are 44px minimum. The toggle is a `<button aria-pressed>` rather than a
 * checkbox because it reads as a filter chip and a checkbox at 44px next to an
 * 18px label is a wider target than it looks.
 */

const SHORTAGE_LEVELS: readonly StockLevel[] = ['out', 'low'];

export function StockFilterBar({
  filter,
  onChange,
  shown,
  total,
  counts,
}: {
  filter: StockFilter;
  onChange: (next: StockFilter) => void;
  shown: number;
  total: number;
  counts: Record<StockLevel, number>;
}) {
  const { t, locale } = useT();

  return (
    <Plate className="p-4" as="section">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span
            lang={locale}
            className="text-caption font-semibold text-ink-muted uppercase"
          >
            {t('stock.search')}
          </span>
          <span className="relative flex items-center">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 size-5 shrink-0 text-ink-muted"
            />
            <Input
              type="search"
              inputMode="search"
              value={filter.query}
              onChange={(event) =>
                onChange({ ...filter, query: event.target.value })
              }
              placeholder={t('stock.search.placeholder')}
              className="pl-11"
            />
          </span>
        </label>

        <button
          type="button"
          aria-pressed={filter.onlyShortages}
          onClick={() => onChange({ ...filter, onlyShortages: !filter.onlyShortages })}
          className={cn(
            'flex min-h-touch items-center justify-between gap-3 rounded-plate border-2 border-line px-3 py-2 text-left transition-colors duration-(--ss-dur-fast)',
            filter.onlyShortages
              ? 'bg-action text-action-fg shadow-plate'
              : 'bg-sunk text-ink',
          )}
        >
          <span lang={locale} className="text-field font-semibold">
            {t('stock.filter.onlyShortages')}
          </span>
          <span
            aria-hidden="true"
            className="tabular shrink-0 rounded-chip border-2 border-line bg-surface px-2 text-caption font-extrabold text-ink"
          >
            {counts.out + counts.low}
          </span>
        </button>

        {/* What is on screen versus what exists, so a filtered list is never
            mistaken for an empty store room. */}
        <p
          role="status"
          className="tabular text-caption font-semibold text-ink-muted"
        >
          {t('stock.shownOfTotal', { shown, total })}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {SHORTAGE_LEVELS.map((level) => (
            <span key={level} className="flex items-center gap-1.5">
              <StockLevelChip level={level} />
              <span className="tabular text-title font-extrabold text-ink">
                {counts[level]}
              </span>
            </span>
          ))}
        </div>
      </div>
    </Plate>
  );
}
