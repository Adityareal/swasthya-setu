'use client';

import { Sparkles, Stethoscope } from 'lucide-react';
import type { ClinicalDecision, HealthRecord, RiskLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { RiskBadge } from '@/components/system/risk-badge';
import { BiLabel } from '@/components/system/bi-label';
import { formatStamp } from './timeline-model';

/**
 * The AI-advises / clinician-decides pairing, as the patient sees it
 * (Req 10.4–10.6, 15.4, 15.5, 15.7).
 *
 * The doctor's decision is rendered FIRST and RAISED. Requirement 10.5 asks for
 * prominence equal to or greater than the AI suggestion, and the honest reading
 * of "greater" on a patient screen is order: a patient scrolling for four
 * seconds reads the top block, and the top block should be the one a qualified
 * human signed. The AI suggestion keeps its full risk badge and its advisory
 * notice directly beneath.
 *
 * The advisory notice is rendered exactly once per surface, by the AI block —
 * `<RiskBadge>` renders it internally, so it cannot be forgotten (Req 10.1).
 * The doctor's risk badge opts out because a clinician's judgement is not
 * AI-generated decision support and labelling it as such would be a lie.
 *
 * `embedded` drops the outer plate for use inside a timeline entry, which is
 * already a plate carrying the risk rail. The two screens then share one
 * definition of how a visit reads instead of two that drift.
 */

/* ————————————————————————— The AI suggestion ————————————————————————— */

export function AiSuggestion({
  record,
  embedded = false,
  className,
}: {
  record: HealthRecord;
  embedded?: boolean;
  className?: string;
}) {
  const { t, locale } = useT();

  return (
    <section
      className={cn(
        'flex flex-col gap-3',
        embedded ? undefined : 'plate p-4',
        className,
      )}
      {...(embedded ? {} : { 'data-state': record.riskLevel })}
    >
      <h3 className="flex items-start gap-2">
        <Sparkles aria-hidden="true" className="mt-1 size-5 shrink-0 text-ink-muted" />
        <BiLabel
          k="decision.aiSuggestion"
          className="text-title font-semibold text-ink"
        />
      </h3>

      <RiskBadge risk={record.riskLevel} triageSource={record.triageSource} />

      {record.aiTriageSummary && (
        <p lang={locale} className="max-w-[70ch] text-field text-ink">
          {record.aiTriageSummary}
        </p>
      )}

      <div>
        <p
          lang={locale}
          className="text-caption font-semibold text-ink-muted uppercase"
        >
          {t('chat.transcript')}
        </p>
        <p lang={locale} className="mt-1 max-w-[70ch] text-field text-ink">
          {record.symptoms}
        </p>
      </div>
    </section>
  );
}

/* ————————————————————————— The doctor's decision ————————————————————————— */

export function DoctorDecision({
  decision,
  doctorName,
  /** The Triage_Engine's Risk_Level for the same row, for the Req 15.5 pairing. */
  aiRisk,
  embedded = false,
  className,
}: {
  decision: ClinicalDecision;
  doctorName?: string | null;
  aiRisk?: RiskLevel;
  embedded?: boolean;
  className?: string;
}) {
  const { t, locale } = useT();
  const differs =
    decision.riskLevel !== undefined &&
    aiRisk !== undefined &&
    decision.riskLevel !== aiRisk;

  return (
    <section
      className={cn(
        'flex flex-col gap-3',
        embedded
          ? /* A sunk inner block: still the enamel plate, no shadow, no rail —
               so it reads as more prominent than the flat AI text below it
               without nesting one drop shadow inside another. */
            'rounded-plate border-2 border-line bg-sunk p-3'
          : 'plate plate--raised p-4',
        className,
      )}
      {...(embedded ? {} : { 'data-state': 'action' })}
    >
      <h3 className="flex items-start gap-2">
        <Stethoscope
          aria-hidden="true"
          className={cn('mt-1 shrink-0 text-action', embedded ? 'size-5' : 'size-6')}
        />
        <BiLabel
          k="decision.doctorDecision"
          className={cn(
            'text-ink',
            embedded ? 'text-title font-extrabold' : 'text-headline font-extrabold',
          )}
        />
      </h3>

      <div>
        <p
          lang={locale}
          className="text-caption font-semibold text-ink-muted uppercase"
        >
          {t('decision.assessment')}
        </p>
        <p
          lang={locale}
          className="mt-1 max-w-[70ch] text-field font-semibold text-ink"
        >
          {decision.assessment}
        </p>
      </div>

      {decision.plan && (
        <div>
          <p
            lang={locale}
            className="text-caption font-semibold text-ink-muted uppercase"
          >
            {t('decision.plan')}
          </p>
          <p lang={locale} className="mt-1 max-w-[70ch] text-field text-ink">
            {decision.plan}
          </p>
        </div>
      )}

      {decision.riskLevel && (
        <div className="flex flex-col gap-2 border-t-2 border-line pt-3">
          <BiLabel
            k="decision.risk"
            className="text-caption font-semibold text-ink-muted uppercase"
          />
          {/* Not AI output, so no advisory notice: see the note at the top. */}
          <RiskBadge risk={decision.riskLevel} showAdvisory={false} />
          {differs && (
            <p
              lang={locale}
              className="max-w-[70ch] text-caption font-semibold text-ink"
            >
              {t('decision.differs')}
            </p>
          )}
        </div>
      )}

      <p lang={locale} className="text-caption font-semibold text-ink-muted">
        {t('decision.by')}: {doctorName ?? t('role.doctor')} ·{' '}
        {formatStamp(decision.at, locale)}
      </p>
    </section>
  );
}

/* ——————————————————————————— The pairing ——————————————————————————— */

/**
 * One record, both readings, in the order that puts the clinician's judgement
 * on top. Used on the patient home for the newest visit and on every `record`
 * entry in the thread, so the two screens cannot drift apart.
 */
export function ClinicalGuidance({
  record,
  doctorName,
  embedded = false,
  className,
}: {
  record: HealthRecord;
  doctorName?: string | null;
  embedded?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {record.clinicalDecision && (
        <DoctorDecision
          decision={record.clinicalDecision}
          doctorName={doctorName}
          aiRisk={record.riskLevel}
          embedded={embedded}
        />
      )}
      <AiSuggestion record={record} embedded={embedded} />
    </div>
  );
}
