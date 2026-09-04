'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import type { Appointment, Facility, Patient } from '@/lib/types';
import { haversineKm, parseLatLng } from '@/lib/routing/haversine';
import { resolveVillageCoords } from '@/lib/data/seed';
import { repo } from '@/lib/data/memory-repo';
import { useT, type MessageKey } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel, BiText } from '@/components/system/bi-label';
import { TokenChit } from '@/components/system/token-chit';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Explicit appointment booking by an ASHA_User (Req 12.6, 12.7).
 *
 * This is the SEPARATE path from the automatic assignment that follows a
 * persisted Triage_Result: no triage runs here, no health record is written, the
 * ASHA picks the facility herself. It exists because a follow-up visit, a
 * referral escort, or an antenatal check needs a token without a new complaint.
 *
 * The Token_Number is NOT computed here. `repo.createAppointment` reads the
 * tokens already held at that facility and calls `nextTokenFrom` inside one
 * synchronous turn, which is the only place in the product allowed to decide a
 * token. The confirmation then reuses `<TokenChit>` verbatim.
 *
 * A dialog rather than a route: the ASHA is already looking at the patient she
 * means, and a navigation would cost her that context.
 */

const TYPE_KEY: Record<Facility['type'], MessageKey> = {
  phc: 'appointment.type.phc',
  chc: 'appointment.type.chc',
  district_hospital: 'appointment.type.district_hospital',
};

interface Option {
  facility: Facility;
  distanceKm: number | null;
}

export function BookAppointmentDialog({
  patient,
  facilities,
  open,
  onOpenChange,
  onBooked,
}: {
  patient: Patient | null;
  facilities: Facility[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a written appointment so the caller can re-read the repo. */
  onBooked?: () => void;
}) {
  const { t, locale } = useT();
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [booked, setBooked] = useState<{
    appointment: Appointment;
    facility: Facility;
    distanceKm: number | null;
  } | null>(null);

  /* The village supplies the origin — the same resolution the automatic router
     uses — so the nearest option is offered first instead of the seed order. */
  const options = useMemo<Option[]>(() => {
    const origin = resolveVillageCoords(patient?.village ?? null);
    return facilities
      .map((facility) => {
        const coords = parseLatLng(facility.location);
        return {
          facility,
          distanceKm: coords ? haversineKm(origin, coords) : null,
        };
      })
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }, [facilities, patient?.village]);

  /* Every open starts clean: a previous token left on screen is how the wrong
     appointment gets read out. Deliberately keyed on `open` and the subject
     ONLY — a facility re-read after the write must not wipe the confirmation
     the ASHA is still reading. */
  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setFailed(false);
    setBooked(null);
  }, [open, patient?.id]);

  /* Hold a valid selection: default to the nearest, keep the ASHA's choice. */
  useEffect(() => {
    setFacilityId((current) =>
      current && options.some((o) => o.facility.id === current)
        ? current
        : (options[0]?.facility.id ?? null),
    );
  }, [options]);

  async function book() {
    if (!patient || !facilityId || saving) return;
    const chosen = options.find((o) => o.facility.id === facilityId);
    if (!chosen) return;

    setSaving(true);
    setFailed(false);
    try {
      const appointment = await repo.createAppointment({
        patientId: patient.id,
        facilityId: chosen.facility.id,
      });
      /* Re-read the facility: booking lengthened its queue, and a chit that
         shows the count from before her own booking is a chit that lies. */
      const fresh = await repo.getFacility(chosen.facility.id);
      setBooked({
        appointment,
        facility: fresh ?? chosen.facility,
        distanceKm: chosen.distanceKm,
      });
      onBooked?.();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title leading-tight font-semibold text-ink">
            {t('appointment.book')}
          </DialogTitle>
          <DialogDescription className="text-caption font-semibold text-ink-muted">
            {patient ? patient.fullName : t('patient.select')}
          </DialogDescription>
        </DialogHeader>

        {booked ? (
          <div className="flex flex-col gap-4">
            <Plate state="low" className="p-3">
              <BiLabel
                k="appointment.confirmed"
                className="text-title font-semibold text-ink"
              />
            </Plate>

            <TokenChit
              facility={booked.facility}
              tokenNumber={booked.appointment.tokenNumber}
              {...(booked.distanceKm !== null
                ? { distanceKm: booked.distanceKm }
                : {})}
            />

            <Button type="button" size="field" onClick={() => onOpenChange(false)}>
              <BiLabel k="common.done" secondaryClassName="text-action-fg/75" />
            </Button>
            <p className="sr-only" role="status">
              {t('appointment.confirmed')} — {t('appointment.token')}{' '}
              {booked.appointment.tokenNumber}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <fieldset
              className="flex flex-col gap-2"
              disabled={saving || !patient}
            >
              <legend className="mb-1">
                <BiLabel
                  k="appointment.facility"
                  className="text-caption font-semibold text-ink-muted uppercase"
                />
              </legend>

              {options.map(({ facility, distanceKm }) => (
                <label key={facility.id} className="block cursor-pointer">
                  <input
                    type="radio"
                    name="facility"
                    value={facility.id}
                    checked={facilityId === facility.id}
                    onChange={() => setFacilityId(facility.id)}
                    className="peer sr-only"
                  />
                  <span className="plate flex min-h-touch-lg flex-col justify-center gap-0.5 p-3 peer-checked:bg-action peer-checked:text-action-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                    <BiText
                      primary={facility.name}
                      secondary={facility.locationLabel}
                      className="text-field font-semibold"
                      secondaryClassName="text-current opacity-80"
                    />
                    <span className="tabular text-caption font-semibold opacity-80">
                      {t(TYPE_KEY[facility.type])}
                      {distanceKm !== null && (
                        <>
                          {' · '}
                          {t('appointment.distance')} {distanceKm.toFixed(1)} km
                        </>
                      )}
                      {' · '}
                      {t('appointment.queue')} {facility.currentQueueLength}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {failed && (
              <Plate state="error" className="p-3">
                <p lang={locale} className="text-caption font-semibold text-ink">
                  {t('common.error')}
                </p>
              </Plate>
            )}

            <Button
              type="button"
              size="field"
              disabled={saving || !patient || !facilityId}
              onClick={() => void book()}
            >
              <CalendarPlus aria-hidden="true" />
              {saving ? (
                <span lang={locale}>{t('common.saving')}</span>
              ) : (
                <BiLabel
                  k="appointment.book"
                  secondaryClassName="text-action-fg/75"
                />
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
