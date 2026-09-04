'use client';

import { AlertTriangle, CheckCircle2, XOctagon } from 'lucide-react';
import type { StockLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import type { SignalState } from '@/components/system/plate';

/**
 * A stock level, encoded three redundant ways: GLYPH, TEXT, and fill.
 *
 * `out` is the state this matters for. A crimson chip alone fails twice over —
 * for red-green colour vision deficiency, and for everyone when sunlight washes
 * the panel — and "out of stock" is precisely the fact a worker must not miss
 * before sending someone on a two-hour journey. So the octagon (the one
 * geometry that means *stop* pre-linguistically) and the words carry the state
 * without any colour at all.
 */

const LEVEL_KEY: Record<StockLevel, MessageKey> = {
  in_stock: 'stock.level.in_stock',
  low: 'stock.level.low',
  out: 'stock.level.out',
};

/** Onto the Signal Rail's existing vocabulary: low-green, ochre, crimson. */
export const LEVEL_RAIL: Record<StockLevel, SignalState> = {
  in_stock: 'low',
  low: 'medium',
  out: 'high',
};

/** Ochre is a FILL and never a foreground, so `low` takes ink on ochre. */
const FILL: Record<StockLevel, string> = {
  in_stock: 'bg-low text-white',
  low: 'bg-med text-ink',
  out: 'bg-high text-white',
};

const GLYPH: Record<StockLevel, typeof CheckCircle2> = {
  in_stock: CheckCircle2,
  low: AlertTriangle,
  out: XOctagon,
};

export function StockLevelChip({
  level,
  className,
}: {
  level: StockLevel;
  className?: string;
}) {
  const { t, tOther, locale, other } = useT();
  const Glyph = GLYPH[level];

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-chip border-2 border-line px-3 py-1',
        FILL[level],
        /* The double rule is `out`'s fourth channel, matching the risk badge. */
        level === 'out' && 'outline outline-2 outline-offset-2 outline-high',
        className,
      )}
    >
      <Glyph aria-hidden="true" className="size-5 shrink-0" />
      <span className="flex flex-col items-start leading-none">
        <span lang={locale} className="text-caption font-extrabold uppercase">
          {t(LEVEL_KEY[level])}
        </span>
        <span
          lang={other}
          aria-hidden="true"
          className={cn(
            'text-caption font-semibold',
            level === 'low' ? 'text-ink/70' : 'text-white/85',
          )}
        >
          {tOther(LEVEL_KEY[level])}
        </span>
      </span>
    </span>
  );
}
