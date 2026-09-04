'use client';

import { CalendarClock, ClipboardList, Pill, Share2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TimelineEntry } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { BiLabel } from '@/components/system/bi-label';
import type { Directory } from './directory';
import { AuthorChip } from './author-chip';
import { ClinicalGuidance } from './guidance';
import { ReferralCard } from './referral-progress';
import { VitalsReadout } from './vitals-readout';
import {
  APPOINTMENT_STATUS_KEY,
  ENTRY_TITLE_KEY,
  dayKeyOf,
  entryAuthorRole,
  formatDay,
  formatStamp,
  railStateFor,
} from './timeline-model';

/**
 * One entry in the patient's own Shared_Record thread (Req 4.4, 13.3).
 *
 * The entry is the plate; the rail carries its state. Four kinds, one shape:
 * icon + kind title + timestamp, then the Record_Author, then kind-appropriate
 * content. Because the author chip sits in the fixed header of every entry, a
 * thread mixing a patient's own words, an ASHA's vitals and a doctor's decision
 * reads as one continuous record with three named hands in it — which is the
 * product claim, made visible rather than asserted.
 *
 * Nothing here reaches for the repo. Ids become names through `Directory`,
 * resolved once by the screen.
 */

const KIND_ICON: Record<TimelineEntry['kind'], LucideIcon> = {
  record: ClipboardList,
  prescription: Pill,
  referral: Share2,
  appointment: CalendarClock,
};

export function RecordEntry({
  entry,
  directory,
  recordTimestamps,
  className,
}: {
  entry: TimelineEntry;
  directory: Directory;
  /** `record.id → timestamp`, so a prescription can name its visit by date. */
  recordTimestamps?: ReadonlyMap<string, string>;
  className?: string;
}) {
  const { locale } = useT();
  const Icon = KIND_ICON[entry.kind];
  const authorRole = entryAuthorRole(entry, directory.workerRole);
  const authorName =
    entry.kind === 'prescription'
      ? directory.workerName(entry.prescription.prescribedBy)
      : entry.kind === 'referral'
        ? directory.workerName(entry.referral.raisedBy)
        : entry.kind === 'record' && entry.record.authorRole !== 'patient'
          ? directory.workerName(entry.record.authorId)
          : null;

  return (
    <article
      className={cn('plate flex flex-col gap-3 p-4', className)}
      data-state={railStateFor(entry)}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-start gap-2">
          <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-ink" />
          <BiLabel
            k={ENTRY_TITLE_KEY[entry.kind]}
            className="text-title font-semibold text-ink"
          />
        </h3>
        <p
          lang={locale}
          className="tabular text-caption font-semibold text-ink-muted"
        >
          {formatStamp(entry.timestamp, locale)}
        </p>
      </header>

      {/* Req 4.4 — every entry names the hand that wrote it. */}
      {authorRole && <AuthorChip role={authorRole} name={authorName} />}

      <EntryBody
        entry={entry}
        directory={directory}
        {...(recordTimestamps ? { recordTimestamps } : {})}
      />
    </article>
  );
}

function EntryBody({
  entry,
  directory,
  recordTimestamps,
}: {
  entry: TimelineEntry;
  directory: Directory;
  recordTimestamps?: ReadonlyMap<string, string>;
}) {
  const { t, locale } = useT();

  switch (entry.kind) {
    /* A visit: the AI suggestion, the doctor's decision when one exists, and
       the Vitals an ASHA measured (Req 8.6, 15.7). */
    case 'record':
      return (
        <div className="flex flex-col gap-3">
          <ClinicalGuidance
            record={entry.record}
            doctorName={directory.workerName(entry.record.clinicalDecision?.byId)}
            embedded
          />
          <VitalsReadout vitals={entry.record.vitals} />
        </div>
      );

    case 'prescription': {
      const { medicines, dosage, notes, recordId } = entry.prescription;
      const visitAt = recordTimestamps?.get(recordId);
      return (
        <div className="flex flex-col gap-3">
          {/* Which visit this came out of, named by date rather than by id
              (Req 13.3, 16.3). */}
          {visitAt && (
            <p lang={locale} className="text-caption font-semibold text-ink-muted">
              {t('timeline.entry.record')} · {formatDay(dayKeyOf(visitAt), locale)}
            </p>
          )}

          <div>
            <p
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t('prescription.medicines')}
            </p>
            <p
              lang={locale}
              className="mt-1 max-w-[70ch] text-field font-extrabold text-ink"
            >
              {medicines}
            </p>
          </div>

          {dosage && (
            <div>
              <p
                lang={locale}
                className="text-caption font-semibold text-ink-muted uppercase"
              >
                {t('prescription.dosage')}
              </p>
              <p lang={locale} className="mt-1 max-w-[70ch] text-field text-ink">
                {dosage}
              </p>
            </div>
          )}

          {notes && (
            <div>
              <p
                lang={locale}
                className="text-caption font-semibold text-ink-muted uppercase"
              >
                {t('prescription.notes')}
              </p>
              <p lang={locale} className="mt-1 max-w-[70ch] text-field text-ink">
                {notes}
              </p>
            </div>
          )}
        </div>
      );
    }

    /* Embedded, so the referral reads exactly as it does on the home screen. */
    case 'referral':
      return <ReferralCard referral={entry.referral} embedded />;

    case 'appointment': {
      const { facilityId, tokenNumber, status, isTeleconsult } = entry.appointment;
      const facility = directory.facility(facilityId);
      return (
        <div className="flex items-end justify-between gap-3">
          <div>
            <p
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t('appointment.facility')}
            </p>
            {/* A patient never sees a facility id. If the row cannot be
                resolved the line is omitted rather than filled with the id or
                with a misleading stand-in — the token below is still true. */}
            {facility && (
              <p lang={locale} className="mt-1 text-field font-extrabold text-ink">
                {facility.name}
              </p>
            )}
            <p lang={locale} className="text-caption font-semibold text-ink-muted">
              {t(APPOINTMENT_STATUS_KEY[status])}
              {isTeleconsult && ` · ${t('appointment.teleconsult')}`}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t('appointment.token')}
            </p>
            <p className="tabular text-display leading-none font-extrabold text-action">
              {tokenNumber}
            </p>
          </div>
        </div>
      );
    }
  }
}
