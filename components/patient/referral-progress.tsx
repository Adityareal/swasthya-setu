'use client';

import { ArrowRight, Check, Share2 } from 'lucide-react';
import type { Referral } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { BiLabel } from '@/components/system/bi-label';
import {
  REFERRAL_STATUS_KEY,
  REFERRAL_STEPS,
  formatStamp,
  referralProgress,
  referralRailState,
} from './timeline-model';

/**
 * Req 13.2 — the Referral_Status, as a progress reading rather than as a word.
 *
 * `in_progress` is a state name, not an answer. A patient asking about a
 * referral is asking how far along it is, so the three states are drawn as the
 * three steps of a closed loop with the reached ones filled — the same
 * `referred → in_progress → completed` sequence the state machine enforces
 * (Req 17.3), read left to right.
 *
 * The step rail is redundant with the text label on purpose: shape and fill
 * carry the reading when the panel is washed out by sunlight.
 */
export function ReferralProgressBar({
  status,
  className,
}: {
  status: Referral['status'];
  className?: string;
}) {
  const { t, locale } = useT();
  const { step } = referralProgress(status);

  return (
    <ol
      className={cn('flex items-stretch gap-1', className)}
      aria-label={`${t('referral.title')}: ${t(REFERRAL_STATUS_KEY[status])}`}
    >
      {REFERRAL_STEPS.map((value, index) => {
        const reached = index < step;
        const current = index === step - 1;
        return (
          <li
            key={value}
            aria-current={current ? 'step' : undefined}
            className={cn(
              'flex min-h-touch flex-1 flex-col items-center justify-center gap-1 rounded-plate border-2 px-1 py-1',
              reached ? 'border-line bg-action text-action-fg' : 'border-line bg-sunk text-ink-muted',
              current && 'shadow-plate',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-chip border-2',
                reached ? 'border-action-fg bg-action-fg text-action' : 'border-ink-muted',
              )}
            >
              {reached && <Check className="size-3" strokeWidth={3} />}
            </span>
            <span
              lang={locale}
              className="text-center text-caption leading-tight font-semibold"
            >
              {t(REFERRAL_STATUS_KEY[value])}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One referral, as a patient reads it: where it is going, how far it has got,
 * and why. `fromFacility` and the destination are shown as names — a patient
 * never sees a facility id.
 *
 * `embedded` drops the plate and the rail so the same reading can sit inside a
 * timeline entry that already is a plate. One component, two surfaces: how a
 * referral reads is defined once, and the home screen and the thread cannot
 * drift apart.
 */
export function ReferralCard({
  referral,
  embedded = false,
  className,
}: {
  referral: Referral;
  embedded?: boolean;
  className?: string;
}) {
  const { t, locale } = useT();
  const { step, total, complete } = referralProgress(referral.status);
  const Tag = embedded ? 'div' : 'article';

  return (
    <Tag
      className={cn(
        'flex flex-col gap-3',
        embedded ? undefined : 'plate p-4',
        className,
      )}
      {...(embedded ? {} : { 'data-state': referralRailState(referral.status) })}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-start gap-2">
          <Share2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-ink-muted" />
          <BiLabel k="referral.to" className="text-title font-semibold text-ink" />
        </h3>
        <p
          lang={locale}
          className="tabular shrink-0 rounded-chip border-2 border-line bg-surface px-2 py-0.5 text-caption font-semibold text-ink"
        >
          {step} / {total}
        </p>
      </div>

      <p lang={locale} className="text-field font-extrabold text-ink">
        {referral.toFacilityOrSpecialist}
      </p>

      {/* Where it came from. The destination is the line above, so it is named
          once and the arrow carries the direction. */}
      <p
        lang={locale}
        className="flex flex-wrap items-center gap-1 text-caption font-semibold text-ink-muted"
      >
        {t('referral.from')}: {referral.fromFacility}
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </p>

      <ReferralProgressBar status={referral.status} />

      {referral.reason && (
        <div>
          <p
            lang={locale}
            className="text-caption font-semibold text-ink-muted uppercase"
          >
            {t('referral.reason')}
          </p>
          <p lang={locale} className="mt-1 max-w-[70ch] text-field text-ink">
            {referral.reason}
          </p>
        </div>
      )}

      <p lang={locale} className="text-caption font-semibold text-ink-muted">
        {complete ? t('referral.closed') : t(REFERRAL_STATUS_KEY[referral.status])} ·{' '}
        {formatStamp(referral.updatedAt, locale)}
      </p>
    </Tag>
  );
}
