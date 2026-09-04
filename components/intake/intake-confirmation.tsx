'use client';

import Link from 'next/link';
import type { RiskLevel, TriageSource } from '@/lib/types';
import { useT } from '@/lib/i18n';
import type { IntakeConfirmation } from '@/lib/intake/complete-intake';
import { TokenChit } from '@/components/system/token-chit';
import { RiskBadge } from '@/components/system/risk-badge';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { PendingTokenChit } from '@/components/offline/pending-token-chit';

/**
 * The intake confirmation, shared by both intake paths (Req 12.4).
 *
 * Reuses `<TokenChit>` verbatim — the punched railway chart chit — because the
 * token number is culturally a berth number and the audience already knows what
 * a number on a chit means.
 *
 * When the visit was captured offline the chit has no number to show, so the
 * pending variant renders instead. The branch is on `confirmation.sync` and the
 * compiler enforces it: the queued variant types `appointment` as `null`, so
 * there is no way to reach for a token that was never allocated.
 */
export function IntakeConfirmationView({
  confirmation,
  risk,
  source,
  summary,
  recommendedNextStep,
  homeHref,
  className,
}: {
  confirmation: IntakeConfirmation;
  risk: RiskLevel;
  source: TriageSource;
  summary: string;
  recommendedNextStep: string;
  homeHref: string;
  className?: string;
}) {
  const { t, locale } = useT();
  const { facility, distanceKm } = confirmation;

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        <section className="plate p-4" data-state="low">
          <BiLabel
            k="appointment.confirmed"
            className="text-headline font-extrabold text-ink"
          />
        </section>

        {confirmation.sync === 'written' ? (
          <TokenChit
            facility={facility}
            tokenNumber={confirmation.appointment.tokenNumber}
            distanceKm={distanceKm}
          />
        ) : (
          <PendingTokenChit facility={facility} distanceKm={distanceKm} />
        )}

        <section className="plate flex flex-col gap-3 p-4" data-state={risk}>
          <BiLabel
            k="decision.aiSuggestion"
            className="text-title font-semibold text-ink"
          />
          <RiskBadge risk={risk} triageSource={source} />
          <p lang={locale} className="max-w-[70ch] text-field text-ink">
            {summary}
          </p>
          <div>
            <BiLabel
              k="chat.assessment.nextStep"
              className="text-caption font-semibold text-ink-muted uppercase"
            />
            <p
              lang={locale}
              className="mt-1 max-w-[70ch] text-field font-semibold text-ink"
            >
              {recommendedNextStep}
            </p>
          </div>
        </section>

        <Button asChild size="field">
          <Link href={homeHref}>
            <BiLabel k="common.done" secondaryClassName="text-action-fg/75" />
          </Link>
        </Button>
      </div>
      <p className="sr-only" role="status">
        {t('appointment.confirmed')}
      </p>
    </div>
  );
}
