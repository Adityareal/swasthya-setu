'use client';

import type { Facility } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { BiLabel, BiText } from './bi-label';

/**
 * The Token Chit — the composition of all three signature moves and the one
 * place the product allows itself a flourish: a punched railway chart chit. The
 * perforated leading edge is a single `repeating-radial-gradient` (`.chit-perf`),
 * the facility name sits in a bilingual stack at display size, and the token
 * number runs at 64px in tabular 800.
 *
 * The token number is, culturally, a railway berth number: the audience already
 * knows what a number on a chit means.
 *
 * Reused verbatim for the routing confirmation, appointment cards, and the
 * printable QR sheet.
 */

const TYPE_KEY: Record<Facility['type'], MessageKey> = {
  phc: 'appointment.type.phc',
  chc: 'appointment.type.chc',
  district_hospital: 'appointment.type.district_hospital',
};

export function TokenChit({
  facility,
  tokenNumber,
  distanceKm,
  className,
}: {
  facility: Facility;
  tokenNumber: number;
  distanceKm?: number;
  className?: string;
}) {
  const { t } = useT();

  return (
    <section
      className={cn('plate plate--raised relative overflow-hidden', className)}
      data-state="action"
    >
      {/* The punched edge. Decorative, so it is hidden from assistive tech. */}
      <span
        aria-hidden="true"
        className="chit-perf pointer-events-none absolute inset-y-0 left-0 w-3"
      />

      <div className="flex flex-col gap-4 py-4 pr-4 pl-6">
        <div>
          <BiLabel
            k="appointment.facility"
            className="text-caption font-semibold text-ink-muted uppercase"
          />
          <BiText
            primary={facility.name}
            secondary={facility.locationLabel}
            className="mt-1 text-display leading-tight font-extrabold text-ink"
          />
          <p className="mt-1 text-caption font-semibold text-ink-muted">
            {t(TYPE_KEY[facility.type])}
            {typeof distanceKm === 'number' && (
              <>
                {' · '}
                {t('appointment.distance')} {distanceKm.toFixed(1)} km
              </>
            )}
            {' · '}
            {t('appointment.queue')} {facility.currentQueueLength}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4 border-t-2 border-line pt-3">
          <BiLabel
            k="appointment.token"
            className="text-title font-semibold text-ink"
          />
          <span className="tabular text-token leading-none font-extrabold text-action">
            {tokenNumber}
          </span>
        </div>
      </div>
    </section>
  );
}
