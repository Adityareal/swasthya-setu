'use client';

import { ArrowRight, CircleCheckBig } from 'lucide-react';
import type { Referral, ReferralStatus } from '@/lib/types';
import { nextStatus } from '@/lib/referral/machine';
import { useT, type MessageKey } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { REFERRAL_STATE, REFERRAL_STATUS_KEY } from './status';

/**
 * One referral, as a card on the board (Req 17).
 *
 * The card renders EXACTLY ONE advance button and its label comes from
 * `nextStatus(referral.status)` — the same pure function the enforcement layer
 * is built on. So the only transition the UI can ask for is the only one the
 * machine accepts, and a `completed` card renders no button at all while
 * staying visible as closed (Req 17.5).
 *
 * The rejection path is still wired, because "the UI only offers legal moves"
 * is a property of a fresh snapshot: if the stored status moved on while this
 * board was open, `advanceReferral` rejects the stale request, nothing is
 * written, and the returned reason key is rendered here (Req 17.4).
 */

/** The reason keys `advanceReferral` and the repo can return. */
const REASON_KEYS = [
  'referral.error.same',
  'referral.error.terminal',
  'referral.error.illegal',
  'referral.error.notFound',
] as const satisfies readonly MessageKey[];

function isReasonKey(key: string): key is (typeof REASON_KEYS)[number] {
  return (REASON_KEYS as readonly string[]).includes(key);
}

export function ReferralCard({
  referral,
  patientName,
  busy = false,
  rejectionReasonKey,
  onAdvance,
}: {
  referral: Referral;
  patientName?: string;
  busy?: boolean;
  rejectionReasonKey?: string;
  onAdvance: (referral: Referral, to: ReferralStatus) => void;
}) {
  const { t, tOther, locale, other } = useT();
  const next = nextStatus(referral.status);

  const raised = formatDate(referral.createdAt, locale);
  const updated = formatDate(referral.updatedAt, locale);

  return (
    <Plate as="li" state={REFERRAL_STATE[referral.status]} className="p-3">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span lang={locale} className="text-title font-semibold text-ink">
            {patientName ?? referral.patientId}
          </span>
          <p className="text-caption font-semibold text-ink-muted">
            {t('referral.from')}: {referral.fromFacility}
          </p>
        </div>

        {/* Destination — the decision surface of the card, so it takes the
            bilingual stack and the arrow that reads without any language. */}
        <div className="flex min-w-0 items-start gap-2 border-t-2 border-line pt-2">
          <ArrowRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-action" />
          <div className="min-w-0">
            <BiLabel
              k="referral.to"
              className="text-caption font-semibold text-ink-muted uppercase"
            />
            <span
              lang={locale}
              className="mt-0.5 block text-field font-semibold break-words text-ink"
            >
              {referral.toFacilityOrSpecialist}
            </span>
          </div>
        </div>

        {referral.reason && (
          <div className="min-w-0">
            <span
              lang={locale}
              className="text-caption font-semibold text-ink-muted uppercase"
            >
              {t('referral.reason')}
            </span>
            <p
              lang={locale}
              className="mt-0.5 max-w-[70ch] text-caption font-semibold break-words text-ink"
            >
              {referral.reason}
            </p>
          </div>
        )}

        <p className="tabular text-caption font-semibold text-ink-muted">
          {t('timeline.at')} {raised}
          {updated !== raised && (
            <>
              {' · '}
              {t('referral.updatedAt')} {updated}
            </>
          )}
        </p>

        {/* Req 17.4 — the reason, displayed on the card whose write was
            refused. No status changed, because the repo checks before it
            writes. */}
        {rejectionReasonKey && (
          <Plate state="error" className="p-2">
            <BiLabel
              k="referral.rejected"
              className="text-caption font-semibold text-ink uppercase"
            />
            <p lang={locale} className="mt-1 text-caption font-semibold text-ink">
              {isReasonKey(rejectionReasonKey)
                ? t(rejectionReasonKey)
                : rejectionReasonKey}
            </p>
          </Plate>
        )}

        {next ? (
          <Button
            type="button"
            size="field"
            /* Wrapping is allowed here: at 360px a column is ~300px wide and
               "Move to in progress" in either script must not clip. */
            className="whitespace-normal"
            disabled={busy}
            onClick={() => onAdvance(referral, next)}
          >
            <ArrowRight aria-hidden="true" />
            <span className="flex flex-col items-start leading-tight">
              <span lang={locale}>
                {t('referral.advance')} {t(REFERRAL_STATUS_KEY[next])}
              </span>
              <span
                lang={other}
                aria-hidden="true"
                className="text-caption font-semibold text-action-fg/75"
              >
                {tOther('referral.advance')} {tOther(REFERRAL_STATUS_KEY[next])}
              </span>
            </span>
          </Button>
        ) : (
          /* Req 17.5 — closed, and still on the board. */
          <p
            lang={locale}
            className="flex w-fit items-center gap-2 rounded-chip border-2 border-line bg-low px-3 py-1 text-caption font-semibold text-white"
          >
            <CircleCheckBig aria-hidden="true" className="size-4" />
            {t('referral.closed')}
          </p>
        )}
      </div>
    </Plate>
  );
}

/** Dates are data, not copy: one short numeric form in the active locale. */
function formatDate(iso: string, locale: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
