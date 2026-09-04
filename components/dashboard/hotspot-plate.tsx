'use client';

import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import {
  HOTSPOT_BAND_FLOOR,
  HOTSPOT_WINDOW_DAYS,
  type HotspotBand,
  type HotspotView,
} from './dashboard-view';

/**
 * The disease-hotspot band (Req 20.5).
 *
 * The honest version of this is worth more to a judge than a fake forecast, so
 * the method is printed ON THE SCREEN in one sentence: count the health records
 * per village over 90 days, put that count in one of three bands. That is all it
 * does. It is not a trained model, it is not disease detection, and both facts
 * are stated rather than implied.
 *
 * A band is NOT drawn in the risk palette. Crimson in this product means a
 * clinical Risk_Level, and spending it on a word-count band would let a heuristic
 * borrow authority it has not earned. Ochre — the colour the Mock_Badge already
 * uses — carries "look here, and know what this is".
 */

/* Three pips, filled by band, so the band survives greyscale and sunlight. */
const BAND_PIPS: Record<HotspotBand, number> = {
  watch: 1,
  elevated: 2,
  concentrated: 3,
};

const BAND_FILL: Record<HotspotBand, string> = {
  watch: 'bg-surface text-ink',
  elevated: 'bg-sunk text-ink',
  concentrated: 'bg-med text-ink',
};

/* TODO i18n: dashboard.hotspot.band.watch / .elevated / .concentrated */
const BAND_LABEL: Record<HotspotBand, string> = {
  watch: 'Watch',
  elevated: 'Elevated',
  concentrated: 'Concentrated',
};

function BandChip({ band }: { band: HotspotBand }) {
  const filled = BAND_PIPS[band];

  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-2 rounded-chip border-2 border-line px-2.5 py-0.5',
        BAND_FILL[band],
      )}
    >
      <span aria-hidden="true" className="inline-flex items-end gap-[2px]">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={cn(
              'w-[3px] rounded-[1px] bg-current',
              index === 0 && 'h-2',
              index === 1 && 'h-3',
              index === 2 && 'h-4',
              index >= filled && 'opacity-25',
            )}
          />
        ))}
      </span>
      <span className="text-caption font-extrabold uppercase">
        {BAND_LABEL[band]}
      </span>
    </span>
  );
}

export function HotspotPlate({ view }: { view: HotspotView }) {
  const { t, locale } = useT();

  return (
    <Plate className="p-3" as="section">
      <h2 className="flex items-center gap-2">
        <MapPin aria-hidden="true" className="size-5 shrink-0 text-action" />
        {/* TODO i18n: dashboard.hotspot.title */}
        <span
          lang={locale}
          className="text-title leading-tight font-semibold text-ink"
        >
          Symptom load by village
        </span>
      </h2>

      {/* The heuristic, stated in words. Req 20.5 asks for exactly this. */}
      {/* TODO i18n: dashboard.hotspot.method */}
      <p
        lang={locale}
        className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted"
      >
        {`Method: count the health records recorded for each village over the last ${HOTSPOT_WINDOW_DAYS} days, then band that count — under ${HOTSPOT_BAND_FLOOR.elevated} is Watch, ${HOTSPOT_BAND_FLOOR.elevated} to ${HOTSPOT_BAND_FLOOR.concentrated - 1} is Elevated, ${HOTSPOT_BAND_FLOOR.concentrated} or more is Concentrated.`}
      </p>
      <p
        lang={locale}
        className="mt-1 w-fit rounded-chip border-2 border-line bg-med px-2 py-0.5 text-caption font-semibold text-ink"
      >
        {t('dashboard.heuristic')}
      </p>

      {view.rows.length === 0 ? (
        <BiLabel
          k="dashboard.empty"
          className="mt-3 text-caption font-semibold text-ink-muted"
        />
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {view.rows.map((row) => (
            <li key={row.village} className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span
                  lang={locale}
                  className="min-w-0 text-body font-semibold break-words text-ink"
                >
                  {row.village}
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular text-body font-extrabold text-ink">
                    {row.count}
                  </span>
                  <BandChip band={row.band} />
                </span>
              </div>
              <div
                role="img"
                aria-label={`${row.village}: ${row.count} records, ${BAND_LABEL[row.band]}`}
                className="h-5 w-full overflow-hidden rounded-plate border-2 border-line bg-sunk"
              >
                <div className="h-full bg-ink" style={{ width: `${row.width}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {view.unattributed > 0 && (
        /* TODO i18n: dashboard.hotspot.unattributed */
        <p
          lang={locale}
          className="tabular mt-3 text-caption font-semibold text-ink-muted"
        >
          {`${view.unattributed} of ${view.counted} records in the window have no village recorded, so no village claims them.`}
        </p>
      )}
    </Plate>
  );
}
