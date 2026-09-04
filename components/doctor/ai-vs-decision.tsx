'use client';

import { BadgeCheck, Bot } from 'lucide-react';
import type { ClinicalDecision, HealthRecord } from '@/lib/types';
import { useT } from '@/lib/i18n';
import { BiLabel } from '@/components/system/bi-label';
import { RiskBadge } from '@/components/system/risk-badge';
import { VitalsReadout } from './vitals-readout';
import { formatDateTime } from './format';

/**
 * The AI advises, the clinician decides (Req 10.4, 10.5, 15.4, 15.5).
 *
 * This is the product's central claim and the layout is built to make it
 * unmistakable rather than merely present:
 *
 *  - TWO blocks, each carrying its own explicit label — `decision.doctorDecision`
 *    and `decision.aiSuggestion`. Neither is a subheading of the other.
 *  - The DECISION leads. It is first in reading order, it carries the raised
 *    5px elevation against the AI block's flat 3px, and its title runs a step
 *    larger. Requirement 10.5 asks for prominence equal or greater; equal would
 *    have been enough, and greater is the honest reading of a product whose
 *    whole argument is that clinical authority stays with the clinician.
 *  - Side by side above `lg`, stacked below it. At 360px there is room for one
 *    column and pretending otherwise produces a horizontal scrollbar.
 *  - When the two priorities disagree, a third plate shows BOTH values together
 *    (Req 15.5). Nothing here writes to the record, so the Triage_Engine value
 *    is retained by construction: this component only reads `record.riskLevel`.
 */

export function AiVsDecision({
  record,
  decidedByName,
}: {
  record: HealthRecord;
  /** Resolved from `clinicalDecision.byId`. */
  decidedByName: string | null;
}) {
  const { t, locale } = useT();
  const decision = record.clinicalDecision;
  const diverges =
    decision?.riskLevel !== undefined && decision.riskLevel !== record.riskLevel;

  return (
    <div className="flex flex-col gap-4">
      {diverges && decision?.riskLevel && (
        <RiskComparison record={record} decision={decision} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ——— The doctor's decision. Leading position, raised elevation. ——— */}
        <section
          className="plate plate--raised flex flex-col gap-3 p-4"
          /* Action blue, not a risk colour: a green rail here would read as
             "low risk" and a colour patch in this product means something. */
          data-state={decision ? 'action' : 'neutral'}
        >
          <div className="flex items-start gap-2">
            <BadgeCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-ink" />
            <BiLabel
              k="decision.doctorDecision"
              className="text-headline leading-tight font-extrabold text-ink"
            />
          </div>

          {decision ? (
            <>
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

              {decision.plan.trim() !== '' && (
                <div>
                  <p
                    lang={locale}
                    className="text-caption font-semibold text-ink-muted uppercase"
                  >
                    {t('decision.plan')}
                  </p>
                  <p lang={locale} className="mt-1 max-w-[70ch] text-body text-ink">
                    {decision.plan}
                  </p>
                </div>
              )}

              {decision.riskLevel && (
                <div>
                  <p
                    lang={locale}
                    className="text-caption font-semibold text-ink-muted uppercase"
                  >
                    {t('decision.risk')}
                  </p>
                  {/* Not AI output, so no advisory: the notice would misattribute
                      the doctor's own judgement to a model. */}
                  <RiskBadge
                    risk={decision.riskLevel}
                    showAdvisory={false}
                    className="mt-1"
                  />
                </div>
              )}

              <p lang={locale} className="text-caption font-semibold text-ink-muted">
                {t('decision.by')}: {decidedByName ?? decision.byId} ·{' '}
                {t('timeline.at')} {formatDateTime(decision.at, locale)}
              </p>
            </>
          ) : (
            <p lang={locale} className="max-w-[70ch] text-field text-ink-muted">
              {t('decision.none')}
            </p>
          )}
        </section>

        {/* ——— The AI suggestion. Flat elevation, own label, own advisory. ——— */}
        <section className="plate flex flex-col gap-3 p-4" data-state={record.riskLevel}>
          <div className="flex items-start gap-2">
            <Bot aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-ink" />
            <BiLabel
              k="decision.aiSuggestion"
              className="text-title font-semibold text-ink"
            />
          </div>

          {/* Req 10.1, 10.2, 9.4 all arrive from inside the badge. */}
          <RiskBadge risk={record.riskLevel} triageSource={record.triageSource} />

          {record.aiTriageSummary && (
            <p lang={locale} className="max-w-[70ch] text-body text-ink">
              {record.aiTriageSummary}
            </p>
          )}

          <div>
            <p
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t('doctor.currentComplaint')}
            </p>
            <p lang={locale} className="mt-1 max-w-[70ch] text-body text-ink">
              {record.symptoms}
            </p>
          </div>

          <div>
            <p
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t('vitals.title')}
            </p>
            <VitalsReadout vitals={record.vitals} className="mt-1" />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Req 15.5 — both priorities, side by side, neither replacing the other.
 * `data-state="neutral"` deliberately: an ochre or crimson rail here would read
 * as a risk level of its own and there are already two on the plate.
 */
function RiskComparison({
  record,
  decision,
}: {
  record: HealthRecord;
  decision: ClinicalDecision;
}) {
  const { t, locale } = useT();

  return (
    <section className="plate flex flex-col gap-3 p-4" data-state="neutral">
      <p lang={locale} className="max-w-[70ch] text-field font-semibold text-ink">
        {t('decision.differs')}
      </p>

      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-1">
          <BiLabel
            k="decision.aiSuggestion"
            className="text-caption font-semibold text-ink-muted uppercase"
          />
          {/* The advisory is rendered once on this surface, by the AI block
              below, so the paired badges opt out rather than repeat it. */}
          <RiskBadge
            risk={record.riskLevel}
            triageSource={record.triageSource}
            showAdvisory={false}
          />
        </div>

        <div className="flex flex-col gap-1">
          <BiLabel
            k="decision.doctorDecision"
            className="text-caption font-semibold text-ink-muted uppercase"
          />
          {decision.riskLevel && (
            <RiskBadge risk={decision.riskLevel} showAdvisory={false} />
          )}
        </div>
      </div>
    </section>
  );
}
