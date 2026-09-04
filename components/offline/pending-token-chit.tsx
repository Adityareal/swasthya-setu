'use client';

import { Clock } from 'lucide-react';
import type { Facility } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { BiLabel, BiText } from '@/components/system/bi-label';

/**
 * The Token Chit, minus the token.
 *
 * The offline intake path resolves the facility — `selectFacility` is pure and
 * the facility list is cached — but it CANNOT allocate a Token_Number, because
 * `nextTokenFrom` reads the tokens already held at that facility and that set
 * lives in the store. So the chit is the same object as `<TokenChit>` (same
 * plate, same punched leading edge, same bilingual facility stack) with the one
 * slot that genuinely cannot be filled saying so instead of showing a number.
 *
 * Deliberately NOT a zero, a dash, or a spinner. A number in that slot is a
 * promise the system cannot keep: the patient arrives, presents it, and finds it
 * belongs to someone else. The rail runs ochre rather than blue because this is a
 * held state, not a confirmed one, and the two must not look alike at a glance.
 */

const TYPE_KEY: Record<Facility['type'], MessageKey> = {
  phc: 'appointment.type.phc',
  chc: 'appointment.type.chc',
  district_hospital: 'appointment.type.district_hospital',
};

export function PendingTokenChit({
  facility,
  distanceKm,
  className,
}: {
  facility: Facility;
  distanceKm?: number;
  className?: string;
}) {
  const { t, locale } = useT();

  return (
    <section
      className={cn('plate plate--raised relative overflow-hidden', className)}
      data-state="medium"
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
          <p lang={locale} className="mt-1 text-caption font-semibold text-ink-muted">
            {t(TYPE_KEY[facility.type])}
            {typeof distanceKm === 'number' && (
              <>
                {' · '}
                {t('appointment.distance')} {distanceKm.toFixed(1)} km
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BiLabel
              k="appointment.token"
              className="text-title font-semibold text-ink"
            />
            <span className="inline-flex items-center gap-2 rounded-chip border-2 border-line bg-med px-3 py-1.5 text-ink">
              <Clock aria-hidden="true" className="size-5 shrink-0" />
              <BiLabel k="offline.pending" className="text-field font-extrabold" />
            </span>
          </div>
          {/* TODO i18n: offline.token.assignedOnSync */}
          <p lang="en-IN" className="text-caption font-semibold text-ink">
            Token pending — assigned on sync.
          </p>
        </div>
      </div>

      <p className="sr-only" role="status">
        {t('offline.pending')}
      </p>
    </section>
  );
}
