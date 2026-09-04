'use client';

import { useState, type ReactNode } from 'react';
import { UserPlus } from 'lucide-react';
import type { Patient, SupportedLanguage } from '@/lib/types';
import { VILLAGE_COORDS } from '@/lib/data/seed';
import { repo } from '@/lib/data/memory-repo';
import { SUPPORTED_LANGUAGES, useT, type MessageKey } from '@/lib/i18n';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Patient registration (Req 7.3, 5.2).
 *
 * Writes a real `patients` row through `repo.createPatient` and then hands the
 * new patient straight to the caller, which opens the Assisted_Session and goes
 * to intake. Registering a patient and then hunting for her in a picker is the
 * wrong flow: registration only ever happens because someone is standing there
 * waiting to be seen.
 *
 * VILLAGE IS NOT COSMETIC. `resolveVillageCoords` turns it into the origin the
 * Routing_Engine measures distance from, so the seeded villages are offered as
 * options while free text stays allowed — a name outside the list resolves to
 * the district centre rather than failing.
 */

const GENDER_OPTIONS = [
  { value: 'female', key: 'patient.register.gender.female' },
  { value: 'male', key: 'patient.register.gender.male' },
  { value: 'other', key: 'patient.register.gender.other' },
] as const satisfies ReadonlyArray<{ value: string; key: MessageKey }>;

const LANGUAGE_KEY: Record<SupportedLanguage, MessageKey> = {
  'en-IN': 'app.language.en',
  'hi-IN': 'app.language.hi',
};

export interface Draft {
  fullName: string;
  age: string;
  gender: string;
  village: string;
  phone: string;
  preferredLanguage: SupportedLanguage;
}

type FieldErrors = Partial<Record<'fullName' | 'age' | 'phone', MessageKey>>;

const VILLAGE_OPTIONS = Object.keys(VILLAGE_COORDS);

/** Pure, so the rules are readable in one place (Req 8.5's sibling for demographics). */
export function validateDraft(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};

  if (draft.fullName.trim().length === 0) errors.fullName = 'validation.required';

  const age = draft.age.trim();
  if (age.length > 0) {
    const parsed = Number(age);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      errors.age = 'validation.numeric';
    } else if (parsed < 0 || parsed > 120) {
      errors.age = 'validation.age';
    }
  }

  const phone = draft.phone.trim();
  if (phone.length > 0 && !/^[+\d][\d\s-]{5,}$/.test(phone)) {
    errors.phone = 'validation.numeric';
  }

  return errors;
}

const EMPTY: Draft = {
  fullName: '',
  age: '',
  gender: '',
  village: '',
  phone: '',
  preferredLanguage: 'hi-IN',
};

export function PatientRegisterForm({
  onRegistered,
}: {
  /** Receives the written row. The caller opens the Assisted_Session. */
  onRegistered: (patient: Patient) => void;
}) {
  const { t, locale } = useT();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  function set<K extends keyof Draft>(field: K, value: Draft[K]) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    /* Re-validate once the form has been submitted, so a corrected field clears
       its message immediately and nothing typed is ever discarded. */
    if (submitted) setErrors(validateDraft(next));
  }

  async function submit() {
    if (saving) return;
    const found = validateDraft(draft);
    setSubmitted(true);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFailed(false);
    try {
      const age = draft.age.trim();
      const patient = await repo.createPatient({
        fullName: draft.fullName,
        age: age.length > 0 ? Number(age) : null,
        gender: draft.gender.length > 0 ? draft.gender : null,
        village: draft.village.trim().length > 0 ? draft.village.trim() : null,
        phone: draft.phone.trim().length > 0 ? draft.phone.trim() : null,
        preferredLanguage: draft.preferredLanguage,
      });
      onRegistered(patient);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <fieldset className="plate flex flex-col gap-4 p-4" disabled={saving}>
        <legend className="sr-only">{t('patient.register.title')}</legend>

        <Field
          id="reg-name"
          labelKey="patient.register.name"
          required
          errorKey={errors.fullName}
        >
          <Input
            id="reg-name"
            name="fullName"
            autoComplete="name"
            value={draft.fullName}
            aria-invalid={errors.fullName ? true : undefined}
            aria-describedby={errors.fullName ? 'reg-name-error' : undefined}
            onChange={(event) => set('fullName', event.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="reg-age" labelKey="patient.register.age" errorKey={errors.age}>
            <Input
              id="reg-age"
              name="age"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="tabular"
              placeholder="34"
              value={draft.age}
              aria-invalid={errors.age ? true : undefined}
              aria-describedby={errors.age ? 'reg-age-error' : undefined}
              onChange={(event) => set('age', event.target.value)}
            />
          </Field>

          <Field id="reg-phone" labelKey="patient.register.phone" errorKey={errors.phone}>
            <Input
              id="reg-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="tabular"
              placeholder="+91 90000 11223"
              value={draft.phone}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? 'reg-phone-error' : undefined}
              onChange={(event) => set('phone', event.target.value)}
            />
          </Field>
        </div>

        {/* Sex — chips rather than a dropdown: three options, one tap each. */}
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-caption font-semibold text-ink-muted uppercase">
            {t('patient.register.gender')}
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {GENDER_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                name="gender"
                value={option.value}
                checked={draft.gender === option.value}
                labelKey={option.key}
                onSelect={() => set('gender', option.value)}
              />
            ))}
          </div>
        </fieldset>

        {/* Village — seeded options offered, free text still accepted, because
            this string feeds facility routing. */}
        <Field id="reg-village" labelKey="patient.register.village">
          <Input
            id="reg-village"
            name="village"
            list="reg-village-options"
            autoComplete="off"
            value={draft.village}
            onChange={(event) => set('village', event.target.value)}
          />
          <datalist id="reg-village-options">
            {VILLAGE_OPTIONS.map((village) => (
              <option key={village} value={village} />
            ))}
          </datalist>
        </Field>

        {/* Preferred language — a decision surface, so the chips carry the
            bilingual stack. Exactly the two Supported_Language values. */}
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-caption font-semibold text-ink-muted uppercase">
            {t('patient.register.language')}
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUPPORTED_LANGUAGES.map((language) => (
              <Chip
                key={language}
                name="preferredLanguage"
                value={language}
                checked={draft.preferredLanguage === language}
                labelKey={LANGUAGE_KEY[language]}
                onSelect={() => set('preferredLanguage', language)}
              />
            ))}
          </div>
        </fieldset>
      </fieldset>

      {failed && (
        <Plate state="error" className="p-4">
          <p lang={locale} className="text-field font-semibold text-ink">
            {t('common.error')}
          </p>
        </Plate>
      )}

      <Button type="submit" size="field" disabled={saving}>
        <UserPlus aria-hidden="true" />
        {saving ? (
          <span lang={locale}>{t('common.saving')}</span>
        ) : (
          <BiLabel
            k="patient.register.save"
            secondaryClassName="text-action-fg/75"
          />
        )}
      </Button>
    </form>
  );
}

/** Label, control, and its field-level message, in one shape. */
function Field({
  id,
  labelKey,
  required = false,
  errorKey,
  children,
}: {
  id: string;
  labelKey: MessageKey;
  required?: boolean;
  errorKey?: MessageKey;
  children: ReactNode;
}) {
  const { t, locale } = useT();

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={id}
        lang={locale}
        className="text-caption font-semibold text-ink-muted uppercase"
      >
        {t(labelKey)}
        <span className="ml-1 normal-case">
          {required ? `(${t('common.required')})` : `(${t('common.optional')})`}
        </span>
      </label>
      {children}
      {errorKey && (
        <p
          id={`${id}-error`}
          lang={locale}
          role="alert"
          className="text-caption font-semibold text-high"
        >
          {t(errorKey)}
        </p>
      )}
    </div>
  );
}

/**
 * A radio wearing a plate. The input stays in the accessibility tree and keeps
 * arrow-key group behaviour; the plate carries the focus ring through
 * `peer-focus-visible` since the input itself is visually hidden.
 */
function Chip({
  name,
  value,
  checked,
  labelKey,
  onSelect,
}: {
  name: string;
  value: string;
  checked: boolean;
  labelKey: MessageKey;
  onSelect: () => void;
}) {
  return (
    <label className="block cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span className="plate flex min-h-touch items-center justify-center px-3 py-2 text-field font-semibold peer-checked:bg-action peer-checked:text-action-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
        <BiLabel
          k={labelKey}
          className="items-center"
          secondaryClassName={checked ? 'text-current opacity-80' : undefined}
        />
      </span>
    </label>
  );
}
