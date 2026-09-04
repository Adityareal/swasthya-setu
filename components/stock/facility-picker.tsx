'use client';

import { Building2, Layers } from 'lucide-react';
import type { Facility } from '@/lib/types';
import { useT, type MessageKey } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiText } from '@/components/system/bi-label';

/**
 * Which facility's shelves to read.
 *
 * Defaults to the worker's OWN posting, because that is the answer she needs
 * twenty times a day, and the all-facilities option exists for the other
 * question: "if not here, then where". Radio plates rather than a dropdown —
 * three options are worth three 56px targets, and a native select on Android
 * hands the choice to a modal the design system does not control.
 */

export const ALL_FACILITIES = 'all';

const TYPE_KEY: Record<Facility['type'], MessageKey> = {
  phc: 'appointment.type.phc',
  chc: 'appointment.type.chc',
  district_hospital: 'appointment.type.district_hospital',
};

export function FacilityPicker({
  facilities,
  selected,
  homeFacilityId,
  onSelect,
}: {
  facilities: Facility[];
  /** A facility id, or `ALL_FACILITIES`. */
  selected: string;
  /** The signed-in worker's posting, marked so she can see it is her own. */
  homeFacilityId: string | null;
  onSelect: (facilityId: string) => void;
}) {
  const { t, locale } = useT();

  return (
    <Plate className="p-4" as="section">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1">
          {/* TODO i18n: stock.facility */}
          <span
            lang={locale}
            className="text-caption font-semibold text-ink-muted uppercase"
          >
            Facility
          </span>
        </legend>

        {facilities.map((facility) => {
          const isHome = facility.id === homeFacilityId;
          return (
            <label key={facility.id} className="block cursor-pointer">
              <input
                type="radio"
                name="stock-facility"
                value={facility.id}
                checked={selected === facility.id}
                onChange={() => onSelect(facility.id)}
                className="peer sr-only"
              />
              <span className="plate flex min-h-touch-lg flex-col justify-center gap-0.5 p-3 peer-checked:bg-action peer-checked:text-action-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                <span className="flex items-center gap-2">
                  <Building2 aria-hidden="true" className="size-5 shrink-0" />
                  <BiText
                    primary={facility.name}
                    secondary={facility.locationLabel}
                    className="min-w-0 text-field font-semibold"
                    secondaryClassName="text-current opacity-80"
                  />
                </span>
                <span className="text-caption font-semibold opacity-80">
                  {t(TYPE_KEY[facility.type])}
                  {/* TODO i18n: stock.facility.home */}
                  {isHome && ' · Your posting'}
                </span>
              </span>
            </label>
          );
        })}

        <label className="block cursor-pointer">
          <input
            type="radio"
            name="stock-facility"
            value={ALL_FACILITIES}
            checked={selected === ALL_FACILITIES}
            onChange={() => onSelect(ALL_FACILITIES)}
            className="peer sr-only"
          />
          <span className="plate flex min-h-touch-lg items-center gap-2 p-3 peer-checked:bg-action peer-checked:text-action-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
            <Layers aria-hidden="true" className="size-5 shrink-0" />
            {/* TODO i18n: stock.facility.all */}
            <span lang={locale} className="text-field font-semibold">
              All facilities
            </span>
          </span>
        </label>
      </fieldset>
    </Plate>
  );
}
