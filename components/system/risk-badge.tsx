'use client';

import type { RiskLevel, TriageSource } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { AdvisoryNote } from './advisory-note';

/**
 * Risk encoded FOUR redundant ways at once, because a red/amber/green scheme
 * fails twice over here — for red-green colour vision deficiency, which is
 * never rare in a population this size, and for everyone when sunlight washes
 * the panel. Any single channel is sufficient to read the state.
 *
 *   Shape  circle | triangle | OCTAGON (the stop sign)
 *   Bars   one    | two      | three
 *   Fill   outlined ink-on-white | solid ochre with INK text | solid crimson,
 *          white text, double rule
 *   Text   कम/LOW | मध्यम/MEDIUM | उच्च/HIGH   (bilingual, both scripts)
 *
 * The octagon is doing real work: it is the one geometry in the set that means
 * *stop* pre-linguistically.
 *
 * The component renders `<AdvisoryNote>` itself, and the fallback label when
 * `triageSource === 'fallback'`, so Requirements 10.1, 10.2 and 9.4 are
 * satisfied by USING the component rather than by remembering to.
 */

/* One inline SVG, three `d` paths swapped by variant. No icon library. */
const SHAPE_PATH: Record<RiskLevel, string> = {
  /* circle */
  low: 'M12 2.4a9.6 9.6 0 1 0 0 19.2a9.6 9.6 0 0 0 0-19.2Z',
  /* triangle */
  medium: 'M12 2.6 22.4 21.4H1.6Z',
  /* octagon — the stop sign */
  high: 'M8.2 2.2h7.6L21.8 8.2v7.6L15.8 21.8H8.2L2.2 15.8V8.2Z',
};

const BAR_COUNT: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

const RISK_KEY: Record<RiskLevel, MessageKey> = {
  low: 'triage.risk.low',
  medium: 'triage.risk.medium',
  high: 'triage.risk.high',
};

/**
 * The ochre rule, enforced in code rather than left to judgement:
 * `--ss-med-fill` NEVER appears as a foreground — as a glyph on white it
 * measures 2.2 : 1 and fails the 3 : 1 non-text minimum. Medium glyphs on light
 * grounds take `--ss-med-fg` (7.5 : 1).
 */
const FILL: Record<RiskLevel, string> = {
  low: 'bg-surface text-ink',
  medium: 'bg-med text-ink',
  high: 'bg-high text-white',
};

const GLYPH_ON_LIGHT: Record<RiskLevel, string> = {
  low: 'text-low',
  medium: 'text-med-fg',
  high: 'text-high',
};

function RiskShape({
  risk,
  onLight,
  className,
}: {
  risk: RiskLevel;
  onLight: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-6 shrink-0', onLight && GLYPH_ON_LIGHT[risk], className)}
    >
      <path
        d={SHAPE_PATH[risk]}
        fill={risk === 'low' ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RiskBars({ risk, onLight }: { risk: RiskLevel; onLight: boolean }) {
  const total = BAR_COUNT[risk];
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-end gap-[2px]"
      data-bars={total}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-[1px]',
            i === 0 && 'h-2',
            i === 1 && 'h-3',
            i === 2 && 'h-4',
            i < total
              ? onLight
                ? cn('bg-current', GLYPH_ON_LIGHT[risk])
                : 'bg-current'
              : 'bg-current opacity-25',
          )}
        />
      ))}
    </span>
  );
}

export function RiskBadge({
  risk,
  triageSource,
  size = 'default',
  showAdvisory = true,
  className,
}: {
  risk: RiskLevel;
  triageSource?: TriageSource;
  size?: 'default' | 'display';
  /** Only a surface that already renders `<AdvisoryNote>` once may opt out. */
  showAdvisory?: boolean;
  className?: string;
}) {
  const { t, tOther, locale, other } = useT();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="img"
        aria-label={`${t('triage.risk')}: ${t(RISK_KEY[risk])}`}
        className={cn(
          'inline-flex w-fit items-center gap-3 rounded-plate border-2 border-line px-3 py-2',
          FILL[risk],
          /* The double rule is the high level's fourth distinguishing mark. */
          risk === 'high' && 'outline outline-2 outline-offset-2 outline-high',
        )}
      >
        <RiskShape risk={risk} onLight={risk === 'low'} />
        <RiskBars risk={risk} onLight={risk === 'low'} />
        <span className="flex flex-col items-start leading-tight">
          <span
            lang={locale}
            className={cn(
              'font-extrabold',
              size === 'display' ? 'text-display' : 'text-title',
            )}
          >
            {t(RISK_KEY[risk])}
          </span>
          <span
            lang={other}
            aria-hidden="true"
            className={cn(
              'text-caption font-semibold',
              risk === 'high' ? 'text-white/85' : 'text-ink/70',
            )}
          >
            {tOther(RISK_KEY[risk])}
          </span>
        </span>
      </div>

      {/* Req 9.4 — the fallback label, rendered from inside the badge. */}
      {triageSource === 'fallback' && (
        <p
          lang={locale}
          className="w-fit rounded-chip border-2 border-line bg-sunk px-2 py-0.5 text-caption font-semibold text-ink"
        >
          {t('triage.source.fallback')}
        </p>
      )}

      {/* Req 10.1 — a caller cannot show AI output without the advisory. */}
      {showAdvisory && <AdvisoryNote />}
    </div>
  );
}
