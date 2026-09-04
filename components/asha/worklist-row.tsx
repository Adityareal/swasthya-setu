'use client';

import { CalendarPlus, ClipboardList, Stethoscope } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { SignalState } from '@/components/system/plate';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { RiskBadge } from '@/components/system/risk-badge';
import { Button } from '@/components/ui/button';
import type { WorklistRow as Row } from './worklist';

/**
 * One patient on the ASHA worklist.
 *
 * The Signal Rail carries the newest record's risk, so the column of rails is
 * readable before a single name is. `<RiskBadge>` opts out of its own advisory
 * note here because the list renders one `<AdvisoryNote>` above all the rows —
 * the badge's contract allows that only for a surface that already shows the
 * notice once, and repeating it on every row would bury it.
 *
 * Three actions, and the first one is the point of the screen: Assist opens the
 * Assisted_Session (Req 7.1) rather than making the ASHA re-find the patient
 * inside the intake picker.
 */
export function WorklistRow({
  row,
  onAssist,
  onHistory,
  onBook,
}: {
  row: Row;
  onAssist: () => void;
  onHistory: () => void;
  onBook: () => void;
}) {
  const { t, locale } = useT();
  const { patient, latest, recentHighAt, recordCount } = row;

  const state: SignalState = latest ? latest.riskLevel : 'neutral';

  const meta = [
    patient.age !== null ? `${t('intake.age')} ${patient.age}` : null,
    patient.gender,
    patient.village,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Plate as="li" state={state} className="p-4">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <span
            lang={locale}
            className="block text-title leading-tight font-semibold break-words text-ink"
          >
            {patient.fullName}
          </span>
          {meta && (
            <p className="mt-0.5 text-caption font-semibold text-ink-muted">{meta}</p>
          )}
        </div>

        {latest ? (
          <div className="flex min-w-0 flex-col gap-2">
            <RiskBadge
              risk={latest.riskLevel}
              triageSource={latest.triageSource}
              showAdvisory={false}
            />
            <p
              lang={locale}
              className="max-w-[70ch] text-caption font-semibold break-words text-ink"
            >
              {latest.symptoms}
            </p>
            <p className="tabular text-caption font-semibold text-ink-muted">
              {t('timeline.at')} {formatDate(latest.timestamp, locale)}
              {recordCount > 1 && (
                <>
                  {' · '}
                  {t('doctor.priorVisits')}: {recordCount - 1}
                </>
              )}
            </p>
            {/* A `high` visit inside the recent window that is no longer the
                newest one. This is why the row sorted where it did, so the
                reason is on the row rather than implied by its position. */}
            {recentHighAt && latest.riskLevel !== 'high' && (
              <p
                lang={locale}
                className="tabular w-fit rounded-chip border-2 border-line bg-high px-3 py-1 text-caption font-semibold text-white"
              >
                {t('triage.risk.high')} · {formatDate(recentHighAt, locale)}
              </p>
            )}
          </div>
        ) : (
          <p lang={locale} className="text-caption font-semibold text-ink-muted">
            {t('timeline.empty')}
          </p>
        )}

        {/* One column at 360px, three across once there is room. Every control
            clears the 44px floor through the button's own `min-h-touch`. */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" className="whitespace-normal" onClick={onAssist}>
            <Stethoscope aria-hidden="true" />
            <BiLabel k="nav.intake" secondaryClassName="text-action-fg/75" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="whitespace-normal"
            onClick={onHistory}
          >
            <ClipboardList aria-hidden="true" />
            <BiLabel k="timeline.title" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="whitespace-normal"
            onClick={onBook}
          >
            <CalendarPlus aria-hidden="true" />
            <BiLabel k="appointment.book" />
          </Button>
        </div>
      </div>
    </Plate>
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
