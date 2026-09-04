'use client';

import {
  CalendarClock,
  MessageSquare,
  Pill,
  Share2,
  Stethoscope,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  AppointmentStatus,
  Facility,
  HealthRecord,
  Referral,
  Role,
  TimelineEntry,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { AdvisoryNote } from '@/components/system/advisory-note';
import { BiLabel } from '@/components/system/bi-label';
import { RiskBadge } from '@/components/system/risk-badge';
import { Button } from '@/components/ui/button';
import { VitalsReadout } from './vitals-readout';
import { formatDate, formatDateTime } from './format';

/**
 * The merged Shared_Record thread, reverse-chronological (Req 14.1, 4.4, 4.5).
 *
 * One read — `repo.getPatientTimeline` — feeds this, the same read the patient
 * and ASHA screens make. So "all three roles see the same record" is a property
 * of the code rather than a claim about three separate screens.
 *
 * Every record entry is labelled with its Record_Author, which is the point of
 * Requirements 4.4 and 4.5: a doctor must be able to tell an entry the patient
 * typed themselves from one an ASHA measured in a courtyard, because the two
 * carry different weight.
 *
 * `<AdvisoryNote>` is rendered ONCE for the whole section and the per-entry
 * badges opt out — the sanctioned opt-out for a surface that already shows the
 * notice. Repeating the paragraph on every entry in a scrolling list is how a
 * required notice becomes wallpaper nobody reads.
 */

const AUTHOR_KEY: Record<Role, MessageKey> = {
  patient: 'timeline.author.patient',
  asha: 'timeline.author.asha',
  doctor: 'timeline.author.doctor',
};

const REFERRAL_STATUS_KEY: Record<Referral['status'], MessageKey> = {
  referred: 'referral.status.referred',
  in_progress: 'referral.status.in_progress',
  completed: 'referral.status.completed',
};

const APPOINTMENT_STATUS_KEY: Record<AppointmentStatus, MessageKey> = {
  scheduled: 'appointment.status.scheduled',
  checked_in: 'appointment.status.checked_in',
  completed: 'appointment.status.completed',
  cancelled: 'appointment.status.cancelled',
};

export function VisitHistory({
  entries,
  facilities,
  reviewRecordId,
  onReview,
}: {
  entries: TimelineEntry[];
  facilities: Facility[];
  reviewRecordId: string | null;
  onReview: (recordId: string) => void;
}) {
  const { t, locale } = useT();

  const facilityName = (id: string) =>
    facilities.find((f) => f.id === id)?.name ?? id;

  return (
    <section className="flex flex-col gap-3">
      <div className="plate p-4" data-state="neutral">
        <BiLabel
          k="timeline.title"
          className="text-title font-semibold text-ink"
        />
        <AdvisoryNote className="mt-2" />
      </div>

      {entries.length === 0 ? (
        <div className="plate p-4" data-state="action">
          <p lang={locale} className="max-w-[70ch] text-field font-semibold text-ink">
            {t('doctor.noRecords')}
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => {
            if (entry.kind === 'record') {
              return (
                <li key={entry.record.id}>
                  <RecordEntry
                    record={entry.record}
                    underReview={entry.record.id === reviewRecordId}
                    onReview={onReview}
                  />
                </li>
              );
            }

            if (entry.kind === 'prescription') {
              const rx = entry.prescription;
              return (
                <li key={rx.id}>
                  <article className="plate flex flex-col gap-1 p-4" data-state="action">
                    <EntryHead
                      icon={<Pill aria-hidden="true" className="size-5 shrink-0" />}
                      titleKey="timeline.entry.prescription"
                      timestamp={rx.createdAt}
                      authorKey={rx.prescribedBy ? 'timeline.author.doctor' : null}
                    />
                    <p
                      lang={locale}
                      className="text-body font-semibold whitespace-pre-line text-ink"
                    >
                      {rx.medicines}
                    </p>
                    {rx.dosage && (
                      <p lang={locale} className="text-caption font-semibold text-ink">
                        {t('prescription.dosage')}: {rx.dosage}
                      </p>
                    )}
                    {rx.notes && (
                      <p lang={locale} className="text-caption text-ink-muted">
                        {t('prescription.notes')}: {rx.notes}
                      </p>
                    )}
                  </article>
                </li>
              );
            }

            if (entry.kind === 'referral') {
              const referral = entry.referral;
              return (
                <li key={referral.id}>
                  <article className="plate flex flex-col gap-1 p-4" data-state="action">
                    <EntryHead
                      icon={<Share2 aria-hidden="true" className="size-5 shrink-0" />}
                      titleKey="timeline.entry.referral"
                      timestamp={referral.createdAt}
                      authorKey={referral.raisedBy ? 'timeline.author.doctor' : null}
                    />
                    <p lang={locale} className="text-body font-semibold text-ink">
                      {referral.fromFacility} → {referral.toFacilityOrSpecialist}
                    </p>
                    {referral.reason && (
                      <p lang={locale} className="max-w-[70ch] text-caption text-ink-muted">
                        {referral.reason}
                      </p>
                    )}
                    <p
                      lang={locale}
                      className="w-fit rounded-chip border-2 border-line bg-sunk px-2 py-0.5 text-caption font-semibold text-ink"
                    >
                      {t(REFERRAL_STATUS_KEY[referral.status])}
                    </p>
                  </article>
                </li>
              );
            }

            const appointment = entry.appointment;
            return (
              <li key={appointment.id}>
                <article className="plate flex flex-col gap-1 p-4" data-state="action">
                  <EntryHead
                    icon={<CalendarClock aria-hidden="true" className="size-5 shrink-0" />}
                    titleKey="timeline.entry.appointment"
                    timestamp={appointment.createdAt}
                    authorKey={null}
                  />
                  <p lang={locale} className="text-body font-semibold text-ink">
                    {facilityName(appointment.facilityId)}
                  </p>
                  <p lang={locale} className="text-caption font-semibold text-ink-muted">
                    {t('appointment.token')}{' '}
                    <span className="tabular text-ink">{appointment.tokenNumber}</span> ·{' '}
                    {t(APPOINTMENT_STATUS_KEY[appointment.status])}
                  </p>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function EntryHead({
  icon,
  titleKey,
  timestamp,
  authorKey,
}: {
  icon: ReactNode;
  titleKey: MessageKey;
  timestamp: string;
  authorKey: MessageKey | null;
}) {
  const { t, locale } = useT();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-2 text-ink">
        {icon}
        <span lang={locale} className="text-caption font-semibold uppercase">
          {t(titleKey)}
        </span>
      </span>
      <span lang={locale} className="text-caption font-semibold text-ink-muted">
        {formatDateTime(timestamp, locale)}
      </span>
      {authorKey && (
        <span
          lang={locale}
          className="rounded-chip border-2 border-line bg-sunk px-2 py-0.5 text-caption font-semibold text-ink"
        >
          {t(authorKey)}
        </span>
      )}
    </div>
  );
}

function RecordEntry({
  record,
  underReview,
  onReview,
}: {
  record: HealthRecord;
  underReview: boolean;
  onReview: (recordId: string) => void;
}) {
  const { t, locale } = useT();

  return (
    <article
      className={cn('plate flex flex-col gap-3 p-4', underReview && 'plate--raised')}
      data-state={record.riskLevel}
    >
      <EntryHead
        icon={<Stethoscope aria-hidden="true" className="size-5 shrink-0" />}
        titleKey="timeline.entry.record"
        timestamp={record.timestamp}
        authorKey={AUTHOR_KEY[record.authorRole]}
      />

      <div className="flex flex-wrap items-start gap-3">
        {/* The advisory is rendered once for this section, so the per-entry
            badge opts out instead of repeating the paragraph. */}
        <RiskBadge
          risk={record.riskLevel}
          triageSource={record.triageSource}
          showAdvisory={false}
        />
      </div>

      <p lang={locale} className="max-w-[70ch] text-body font-semibold text-ink">
        {record.symptoms}
      </p>

      {record.aiTriageSummary && (
        <div>
          <p
            lang={locale}
            className="text-caption font-semibold text-ink-muted uppercase"
          >
            {t('decision.aiSuggestion')}
          </p>
          <p lang={locale} className="mt-1 max-w-[70ch] text-body text-ink">
            {record.aiTriageSummary}
          </p>
        </div>
      )}

      {/* Req 8.6 — stored Vitals, displayed with the entry that carries them. */}
      <div>
        <p
          lang={locale}
          className="text-caption font-semibold text-ink-muted uppercase"
        >
          {t('vitals.title')}
        </p>
        <VitalsReadout vitals={record.vitals} className="mt-1" />
      </div>

      {/* Req 15.4 — where a decision exists it is a distinctly labelled block,
          never a paragraph appended to the AI summary. */}
      {record.clinicalDecision && (
        <div className="plate plate--sunk flex flex-col gap-1 p-3">
          <BiLabel
            k="decision.doctorDecision"
            className="text-body font-semibold text-ink"
          />
          <p lang={locale} className="max-w-[70ch] text-body font-semibold text-ink">
            {record.clinicalDecision.assessment}
          </p>
          {record.clinicalDecision.plan.trim() !== '' && (
            <p lang={locale} className="max-w-[70ch] text-caption text-ink">
              {record.clinicalDecision.plan}
            </p>
          )}
          <p lang={locale} className="text-caption font-semibold text-ink-muted">
            {t('timeline.at')} {formatDate(record.clinicalDecision.at, locale)}
          </p>
        </div>
      )}

      {/* The intake conversation exists precisely so the reasoning is
          inspectable. Collapsed by default: a doctor wants the conclusion
          first and the derivation on request. */}
      {record.conversation && record.conversation.length > 0 && (
        <details className="plate plate--sunk p-3">
          <summary className="flex min-h-touch cursor-pointer items-center gap-2 text-caption font-semibold text-ink">
            <MessageSquare aria-hidden="true" className="size-4 shrink-0" />
            <span lang={locale}>{t('chat.conversation')}</span>
          </summary>
          <p lang={locale} className="mt-2 text-caption text-ink-muted">
            {t('chat.conversation.hint')}
          </p>
          <ol className="mt-2 flex flex-col gap-2">
            {record.conversation.map((turn, index) => (
              <li key={`${turn.at}-${index}`} className="flex flex-col">
                <span
                  lang={locale}
                  className="text-caption font-semibold text-ink-muted uppercase"
                >
                  {turn.role === 'user' ? t('chat.you') : t('chat.assistant')}
                </span>
                <span lang={locale} className="max-w-[70ch] text-body text-ink">
                  {turn.text}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {underReview ? (
        <p
          lang={locale}
          className="w-fit rounded-chip border-2 border-line bg-action px-3 py-0.5 text-caption font-semibold text-action-fg"
        >
          {t('doctor.review')}
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => onReview(record.id)}
        >
          <span lang={locale}>{t('doctor.review')}</span>
        </Button>
      )}
    </article>
  );
}
