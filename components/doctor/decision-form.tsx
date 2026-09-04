'use client';

import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import type { HealthRecord, RiskLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { validateNonBlank } from '@/lib/prescriptions/validate';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './field';

/**
 * Clinical_Decision authoring (Req 15.1, 15.2, 15.6).
 *
 * The write goes through `repo.setClinicalDecision`, which takes the decision
 * object and NOTHING else — so `aiTriageSummary` and `riskLevel` survive
 * untouched because the method has no parameter that could reach them
 * (Req 15.3). That is a property of the seam, not a rule this form remembers.
 *
 * The priority override is three toggles rather than a select with a "same as
 * the AI" option: no selection IS no override, and the absence needs no copy to
 * explain it. Pressing the selected toggle again clears it.
 */

const RISK_KEY: Record<RiskLevel, MessageKey> = {
  low: 'triage.risk.low',
  medium: 'triage.risk.medium',
  high: 'triage.risk.high',
};

const RISK_ORDER: readonly RiskLevel[] = ['low', 'medium', 'high'];

export function DecisionForm({
  record,
  doctorId,
  onSaved,
}: {
  record: HealthRecord;
  doctorId: string;
  onSaved: () => void | Promise<void>;
}) {
  const { t, locale } = useT();
  const existing = record.clinicalDecision;

  const [assessment, setAssessment] = useState(existing?.assessment ?? '');
  const [plan, setPlan] = useState(existing?.plan ?? '');
  const [risk, setRisk] = useState<RiskLevel | null>(existing?.riskLevel ?? null);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (saving) return;

    /* Req 15.6 — an empty assessment is rejected before the write, with a
       message under the field that caused it. */
    if (!validateNonBlank(assessment)) {
      setErrorKey('decision.error.assessmentRequired');
      setSaved(false);
      return;
    }

    setErrorKey(null);
    setSaving(true);
    setSaved(false);

    const written = await repo.setClinicalDecision(record.id, {
      assessment,
      plan,
      ...(risk ? { riskLevel: risk } : {}),
      byId: doctorId,
      at: new Date().toISOString(),
    });

    setSaving(false);

    if (!written.ok) {
      setErrorKey('common.error');
      return;
    }

    setSaved(true);
    await onSaved();
  }

  return (
    <section className="plate flex flex-col gap-4 p-4" data-state="action">
      <div className="flex items-start gap-2">
        <BadgeCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-ink" />
        <BiLabel
          k="decision.title"
          className="text-title font-semibold text-ink"
        />
      </div>

      <Field id="decision-assessment" label="decision.assessment" errorKey={errorKey}>
        <Textarea
          id="decision-assessment"
          rows={3}
          value={assessment}
          disabled={saving}
          aria-invalid={errorKey ? true : undefined}
          aria-describedby={errorKey ? 'decision-assessment-error' : undefined}
          placeholder={t('decision.assessment.placeholder')}
          onChange={(event) => {
            setAssessment(event.target.value);
            if (errorKey) setErrorKey(null);
          }}
        />
      </Field>

      <Field id="decision-plan" label="decision.plan" optional>
        <Textarea
          id="decision-plan"
          rows={3}
          value={plan}
          disabled={saving}
          placeholder={t('decision.plan.placeholder')}
          onChange={(event) => setPlan(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <p
          lang={locale}
          className="text-caption font-semibold text-ink-muted uppercase"
        >
          {t('decision.risk')}
          <span className="ml-1 normal-case">({t('common.optional')})</span>
        </p>
        <div role="group" aria-label={t('decision.risk')} className="flex flex-wrap gap-2">
          {RISK_ORDER.map((level) => {
            const active = risk === level;
            return (
              <button
                key={level}
                type="button"
                disabled={saving}
                aria-pressed={active}
                onClick={() => setRisk(active ? null : level)}
                className={cn(
                  'min-h-touch rounded-plate border-2 border-line px-4 text-body font-semibold shadow-plate',
                  'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)]',
                  active ? 'bg-action text-action-fg' : 'bg-surface text-ink',
                )}
              >
                <span lang={locale}>{t(RISK_KEY[level])}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Button type="button" size="field" disabled={saving} onClick={() => void submit()}>
        <BiLabel
          k={saving ? 'common.saving' : 'decision.save'}
          secondaryClassName="text-action-fg/75"
        />
      </Button>

      <p role="status" lang={locale} className="text-caption font-semibold text-ink-muted">
        {saved ? t('decision.recorded') : ''}
      </p>
    </section>
  );
}
