'use client';

import { useEffect, useState } from 'react';
import type {
  Facility,
  Patient,
  RiskLevel,
  Role,
  TimelineEntry,
  TimelineKind,
  Vitals,
} from '@/lib/types';
import { repo } from '@/lib/data/memory-repo';
import { useT, type MessageKey } from '@/lib/i18n';
import type { SignalState } from '@/components/system/plate';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { AdvisoryNote } from '@/components/system/advisory-note';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The subject's Shared_Record, read from the ASHA worklist (Req 4.5, 7.5).
 *
 * One read — `repo.getPatientTimeline` — the same read the patient's own screen
 * and the doctor panel use. So "all three roles see the same record" holds
 * because there is one query, not because three screens were kept in step
 * (Req 4.6). Entries authored by the patient and by the doctor appear here
 * labelled with their Record_Author, which is the whole point of showing this to
 * the ASHA at all.
 */

const KIND_KEY: Record<TimelineKind, MessageKey> = {
  record: 'timeline.entry.record',
  prescription: 'timeline.entry.prescription',
  referral: 'timeline.entry.referral',
  appointment: 'timeline.entry.appointment',
};

const AUTHOR_KEY: Record<Role, MessageKey> = {
  patient: 'timeline.author.patient',
  asha: 'timeline.author.asha',
  doctor: 'timeline.author.doctor',
};

const RISK_KEY: Record<RiskLevel, MessageKey> = {
  low: 'triage.risk.low',
  medium: 'triage.risk.medium',
  high: 'triage.risk.high',
};

const REFERRAL_KEY = {
  referred: 'referral.status.referred',
  in_progress: 'referral.status.in_progress',
  completed: 'referral.status.completed',
} as const satisfies Record<string, MessageKey>;

export function PatientHistoryDialog({
  patient,
  facilities,
  open,
  onOpenChange,
}: {
  patient: Patient | null;
  facilities: Facility[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useT();
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    if (!open || !patient) {
      setEntries(null);
      return;
    }
    let live = true;
    setEntries(null);
    void repo.getPatientTimeline(patient.id).then((rows) => {
      if (live) setEntries(rows);
    });
    return () => {
      live = false;
    };
  }, [open, patient]);

  const facilityName = (id: string) =>
    facilities.find((f) => f.id === id)?.name ?? id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title leading-tight font-semibold text-ink">
            {t('timeline.title')}
          </DialogTitle>
          <DialogDescription className="text-caption font-semibold text-ink-muted">
            {patient ? patient.fullName : t('patient.select')}
          </DialogDescription>
        </DialogHeader>

        {/* Req 10.1 — the timeline renders AI risk levels and summaries, so the
            advisory sits above them once. */}
        <AdvisoryNote />

        {entries === null ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <div className="skeleton-plate h-20" />
            <div className="skeleton-plate h-20" />
          </div>
        ) : entries.length === 0 ? (
          <Plate className="p-3">
            <p lang={locale} className="text-caption font-semibold text-ink-muted">
              {t('timeline.empty')}
            </p>
          </Plate>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <Plate
                as="li"
                key={entryKey(entry)}
                state={entryState(entry)}
                className="p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <BiLabel
                      k={KIND_KEY[entry.kind]}
                      className="text-caption font-semibold text-ink uppercase"
                    />
                    <span className="tabular text-caption font-semibold text-ink-muted">
                      {formatDate(entry.timestamp, locale)}
                    </span>
                  </div>

                  {entry.kind === 'record' && (
                    <>
                      <p
                        lang={locale}
                        className="text-field font-semibold break-words text-ink"
                      >
                        {entry.record.symptoms}
                      </p>
                      <p className="text-caption font-semibold text-ink-muted">
                        {t('triage.risk')}: {t(RISK_KEY[entry.record.riskLevel])}
                        {' · '}
                        {t(AUTHOR_KEY[entry.record.authorRole])}
                      </p>
                      {entry.record.vitals && (
                        <VitalsLine vitals={entry.record.vitals} />
                      )}
                      {entry.record.aiTriageSummary && (
                        <p
                          lang={locale}
                          className="max-w-[70ch] text-caption font-semibold break-words text-ink-muted"
                        >
                          {entry.record.aiTriageSummary}
                        </p>
                      )}
                      {entry.record.clinicalDecision && (
                        <div className="mt-1 border-t-2 border-line pt-1">
                          <BiLabel
                            k="decision.doctorDecision"
                            className="text-caption font-semibold text-ink uppercase"
                          />
                          <p
                            lang={locale}
                            className="mt-0.5 max-w-[70ch] text-field font-semibold break-words text-ink"
                          >
                            {entry.record.clinicalDecision.assessment}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {entry.kind === 'prescription' && (
                    <p
                      lang={locale}
                      className="text-field font-semibold break-words whitespace-pre-line text-ink"
                    >
                      {entry.prescription.medicines}
                      {entry.prescription.dosage && (
                        <span className="block text-caption font-semibold text-ink-muted">
                          {entry.prescription.dosage}
                        </span>
                      )}
                    </p>
                  )}

                  {entry.kind === 'referral' && (
                    <p
                      lang={locale}
                      className="text-field font-semibold break-words text-ink"
                    >
                      {entry.referral.toFacilityOrSpecialist}
                      <span className="block text-caption font-semibold text-ink-muted">
                        {t(REFERRAL_KEY[entry.referral.status])}
                      </span>
                    </p>
                  )}

                  {entry.kind === 'appointment' && (
                    <p lang={locale} className="text-field font-semibold text-ink">
                      {facilityName(entry.appointment.facilityId)}
                      <span className="tabular block text-caption font-semibold text-ink-muted">
                        {t('appointment.token')} {entry.appointment.tokenNumber}
                      </span>
                    </p>
                  )}
                </div>
              </Plate>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="field"
          onClick={() => onOpenChange(false)}
        >
          <BiLabel k="common.close" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function entryKey(entry: TimelineEntry): string {
  if (entry.kind === 'record') return entry.record.id;
  if (entry.kind === 'prescription') return entry.prescription.id;
  if (entry.kind === 'referral') return entry.referral.id;
  return entry.appointment.id;
}

/** The rail carries risk on a record, and wayfinding blue on everything the
 *  record led to. */
function entryState(entry: TimelineEntry): SignalState {
  if (entry.kind === 'record') return entry.record.riskLevel;
  if (entry.kind === 'referral') {
    return entry.referral.status === 'completed' ? 'low' : 'action';
  }
  return 'action';
}

/** Req 8.6 — recorded Vitals travel with the entry. Renders nothing when the
 *  record carried no measurement, which is a valid intake (Req 8.4). */
function VitalsLine({ vitals }: { vitals: Vitals }) {
  const { t } = useT();

  const parts = [
    vitals.bloodPressure
      ? `${t('vitals.bloodPressure')} ${vitals.bloodPressure}`
      : null,
    vitals.pulse !== undefined ? `${vitals.pulse} ${t('vitals.pulse.unit')}` : null,
    vitals.temperature !== undefined
      ? `${vitals.temperature} ${t('vitals.temperature.unit')}`
      : null,
    vitals.spo2 !== undefined
      ? `${t('vitals.spo2')} ${vitals.spo2}${t('vitals.spo2.unit')}`
      : null,
    vitals.weight !== undefined ? `${vitals.weight} ${t('vitals.weight.unit')}` : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <p className="tabular text-caption font-semibold text-ink-muted">
      {parts.join(' · ')}
    </p>
  );
}

function formatDate(iso: string, locale: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  return new Date(at).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
