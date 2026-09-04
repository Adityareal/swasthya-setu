'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Share2 } from 'lucide-react';
import type { Referral } from '@/lib/types';
import { useT, type MessageKey } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { validateNonBlank } from '@/lib/prescriptions/validate';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './field';
import { formatDate } from './format';

/**
 * Raising a referral (Req 17.1).
 *
 * The status is not a field on this form. `repo.createReferral` sets `referred`
 * itself, so a referral cannot be born in progress — the machine in
 * `lib/referral/machine.ts` is the only thing that moves it, and the board that
 * moves it lives at `/doctor/referrals`. This screen links there rather than
 * duplicating it: one board, one place transitions are enforced.
 *
 * `suggestions` are the destinations already present in the seeded record, so
 * the demo's district cardiologist is one tap away without this form inventing
 * clinical vocabulary of its own.
 */
export function ReferralForm({
  patientId,
  fromFacility,
  doctorId,
  existing,
  suggestions,
  onSaved,
}: {
  patientId: string;
  fromFacility: string;
  doctorId: string | null;
  existing: Referral[];
  suggestions: string[];
  onSaved: () => void | Promise<void>;
}) {
  const { t, locale } = useT();

  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const STATUS_KEY: Record<Referral['status'], MessageKey> = {
    referred: 'referral.status.referred',
    in_progress: 'referral.status.in_progress',
    completed: 'referral.status.completed',
  };

  async function submit() {
    if (saving) return;

    if (!validateNonBlank(to)) {
      setErrorKey('referral.error.toRequired');
      setSaved(false);
      return;
    }

    setErrorKey(null);
    setSaving(true);
    setSaved(false);

    await repo.createReferral({
      patientId,
      fromFacility,
      toFacilityOrSpecialist: to.trim(),
      ...(reason.trim() !== '' ? { reason: reason.trim() } : {}),
      raisedBy: doctorId,
    });

    setSaving(false);
    setTo('');
    setReason('');
    setSaved(true);
    await onSaved();
  }

  return (
    <section className="plate flex flex-col gap-4 p-4" data-state="action">
      <div className="flex items-start gap-2">
        <Share2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-ink" />
        <BiLabel
          k="referral.raise.title"
          className="text-title font-semibold text-ink"
        />
      </div>

      {existing.length === 0 ? (
        <p lang={locale} className="text-caption font-semibold text-ink-muted">
          {t('referral.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {existing.map((referral) => (
            <li key={referral.id} className="plate plate--sunk flex flex-col gap-1 p-3">
              <p lang={locale} className="text-body font-semibold text-ink">
                {referral.toFacilityOrSpecialist}
              </p>
              <p lang={locale} className="text-caption font-semibold text-ink-muted">
                {t('referral.from')}: {referral.fromFacility} · {t('timeline.at')}{' '}
                {formatDate(referral.createdAt, locale)}
              </p>
              <p
                lang={locale}
                className="w-fit rounded-chip border-2 border-line bg-surface px-2 py-0.5 text-caption font-semibold text-ink"
              >
                {t(STATUS_KEY[referral.status])}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Field id="referral-to" label="referral.to" errorKey={errorKey}>
        <Input
          id="referral-to"
          value={to}
          disabled={saving}
          aria-invalid={errorKey ? true : undefined}
          aria-describedby={errorKey ? 'referral-to-error' : undefined}
          placeholder={t('referral.to.placeholder')}
          onChange={(event) => {
            setTo(event.target.value);
            if (errorKey) setErrorKey(null);
          }}
        />
      </Field>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={saving}
              onClick={() => {
                setTo(suggestion);
                setErrorKey(null);
              }}
              className="min-h-touch rounded-chip border-2 border-line bg-sunk px-3 text-caption font-semibold text-ink shadow-plate active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <Field id="referral-reason" label="referral.reason" optional>
        <Textarea
          id="referral-reason"
          rows={2}
          value={reason}
          disabled={saving}
          placeholder={t('referral.reason.placeholder')}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>

      {fromFacility !== '' && (
        <p lang={locale} className="text-caption font-semibold text-ink-muted">
          {t('referral.from')}: {fromFacility}
        </p>
      )}

      <Button type="button" size="field" disabled={saving} onClick={() => void submit()}>
        <BiLabel
          k={saving ? 'common.saving' : 'referral.raise'}
          secondaryClassName="text-action-fg/75"
        />
      </Button>

      <p role="status" lang={locale} className="text-caption font-semibold text-ink-muted">
        {saved ? t('referral.status.referred') : ''}
      </p>

      <Button asChild variant="outline">
        <Link href="/doctor/referrals">
          <BiLabel k="nav.board" />
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
