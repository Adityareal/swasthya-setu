'use client';

import { useState } from 'react';
import { Pill } from 'lucide-react';
import type { Prescription } from '@/lib/types';
import { useT, type MessageKey } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { validatePrescription } from '@/lib/prescriptions/validate';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from './field';
import { formatDateTime } from './format';

/**
 * Prescription authoring against the visit under review (Req 16.1–16.3).
 *
 * `medicines` is validated with `validatePrescription`, the same pure function
 * the repository re-checks on write — so a whitespace-only value is rejected at
 * the field (Req 16.2) AND unwritable through the seam. Two layers, one rule,
 * no second definition of "blank".
 *
 * Existing prescriptions for this record render above the form (Req 16.3): the
 * doctor writing a second prescription needs to see the first.
 */
export function PrescriptionForm({
  recordId,
  doctorId,
  existing,
  onSaved,
}: {
  recordId: string;
  doctorId: string | null;
  existing: Prescription[];
  onSaved: () => void | Promise<void>;
}) {
  const { t, locale } = useT();

  const [medicines, setMedicines] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (saving) return;

    const checked = validatePrescription(medicines);
    if (!checked.ok) {
      setErrorKey(checked.reasonKey);
      setSaved(false);
      return;
    }

    setErrorKey(null);
    setSaving(true);
    setSaved(false);

    const written = await repo.createPrescription({
      recordId,
      medicines: checked.value,
      ...(dosage.trim() !== '' ? { dosage: dosage.trim() } : {}),
      ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
      prescribedBy: doctorId,
    });

    setSaving(false);

    if (!written.ok) {
      setErrorKey('prescription.error.medicinesRequired');
      return;
    }

    setMedicines('');
    setDosage('');
    setNotes('');
    setSaved(true);
    await onSaved();
  }

  return (
    <section className="plate flex flex-col gap-4 p-4" data-state="action">
      <div className="flex items-start gap-2">
        <Pill aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-ink" />
        <BiLabel
          k="prescription.title"
          className="text-title font-semibold text-ink"
        />
      </div>

      {/* Req 16.3 — what has already been prescribed for this visit. */}
      {existing.length === 0 ? (
        <p lang={locale} className="text-caption font-semibold text-ink-muted">
          {t('prescription.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {existing.map((rx) => (
            <li key={rx.id} className="plate plate--sunk flex flex-col gap-1 p-3">
              <p lang={locale} className="text-body font-semibold whitespace-pre-line text-ink">
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
              <p lang={locale} className="text-caption font-semibold text-ink-muted">
                {t('timeline.at')} {formatDateTime(rx.createdAt, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Field
        id="rx-medicines"
        label="prescription.medicines"
        errorKey={errorKey}
      >
        <Textarea
          id="rx-medicines"
          rows={3}
          value={medicines}
          disabled={saving}
          aria-invalid={errorKey ? true : undefined}
          aria-describedby={errorKey ? 'rx-medicines-error' : undefined}
          placeholder={t('prescription.medicines.placeholder')}
          onChange={(event) => {
            setMedicines(event.target.value);
            if (errorKey) setErrorKey(null);
          }}
        />
      </Field>

      <Field id="rx-dosage" label="prescription.dosage" optional>
        <Input
          id="rx-dosage"
          value={dosage}
          disabled={saving}
          placeholder={t('prescription.dosage.placeholder')}
          onChange={(event) => setDosage(event.target.value)}
        />
      </Field>

      <Field id="rx-notes" label="prescription.notes" optional>
        <Input
          id="rx-notes"
          value={notes}
          disabled={saving}
          placeholder={t('prescription.notes.placeholder')}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      <Button type="button" size="field" disabled={saving} onClick={() => void submit()}>
        <BiLabel
          k={saving ? 'common.saving' : 'prescription.save'}
          secondaryClassName="text-action-fg/75"
        />
      </Button>

      <p role="status" lang={locale} className="text-caption font-semibold text-ink-muted">
        {saved ? t('common.done') : ''}
      </p>
    </section>
  );
}
