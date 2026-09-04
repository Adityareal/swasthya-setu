export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; reasonKey: 'prescription.error.medicinesRequired' };

/**
 * Rejects any string composed solely of whitespace — spaces, tabs, newlines,
 * non-breaking spaces, and the rest of the Unicode whitespace class — and
 * accepts any string carrying at least one non-whitespace character (Req 16.2).
 *
 * `\s` in JavaScript already covers U+00A0 and U+2000–U+200A; `trim()` uses the
 * same definition, so this is one expression rather than a character table.
 */
export function validatePrescription(medicines: string): ValidationResult {
  const value = (medicines ?? '').trim();
  if (value === '') {
    return { ok: false, reasonKey: 'prescription.error.medicinesRequired' };
  }
  return { ok: true, value };
}

/** Same rule, reused for the Clinical_Decision assessment field (Req 15.6). */
export function validateNonBlank(value: string): boolean {
  return (value ?? '').trim() !== '';
}
