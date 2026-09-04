'use client';

import { Building2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { MockBadge } from '@/components/system/mock-plate';
import { StockItemPlate } from './stock-item-plate';
import { StockLevelChip } from './stock-level-chip';
import type { StockGroup } from './stock-view';

/**
 * One facility's shelves.
 *
 * The header carries the count of what is MISSING, so the all-facilities view is
 * scannable without opening anything: a facility with two crimson chips in its
 * header is the facility not to send anyone to for those medicines.
 */
export function StockGroupPlate({ group }: { group: StockGroup }) {
  const { t } = useT();

  return (
    <section className="flex flex-col gap-2">
      {/* The rail carries the WORST level on these shelves, so a column of
          facility headers is readable before a single name is. The Mock_Badge
          rides on the card as well as on the screen (Req 20.1) — these
          quantities are seeded rows, and a card lifted out of context should
          still say so. */}
      <div className="relative">
        <Plate
          state={group.counts.out > 0 ? 'high' : group.counts.low > 0 ? 'medium' : 'low'}
          mock
          className="p-3 pt-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 className="flex min-w-0 items-center gap-2">
              <Building2 aria-hidden="true" className="size-5 shrink-0 text-action" />
              <span className="text-title leading-tight font-semibold break-words text-ink">
                {group.facilityName}
              </span>
            </h3>
            <span className="tabular text-caption font-semibold text-ink-muted">
              {group.rows.length} · {t('stock.medicine')}
            </span>
          </div>

          {(group.counts.out > 0 || group.counts.low > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {group.counts.out > 0 && (
                <span className="flex items-center gap-1.5">
                  <StockLevelChip level="out" />
                  <span className="tabular text-title font-extrabold text-ink">
                    {group.counts.out}
                  </span>
                </span>
              )}
              {group.counts.low > 0 && (
                <span className="flex items-center gap-1.5">
                  <StockLevelChip level="low" />
                  <span className="tabular text-title font-extrabold text-ink">
                    {group.counts.low}
                  </span>
                </span>
              )}
            </div>
          )}
        </Plate>
        <MockBadge className="absolute -top-2 right-3" />
      </div>

      <ul className="flex flex-col gap-2">
        {group.rows.map((row) => (
          <StockItemPlate key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}
