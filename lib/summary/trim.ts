import type { RiskLevel } from '@/lib/types';

/** One trimmed visit, as posted to `/api/summary`. Vitals are deliberately not
 *  sent: paraphrasing a blood pressure through a language model is a way to
 *  introduce an error into the one part of the record that has none. */
export interface HistoryItem {
  date: string;
  risk: RiskLevel;
  symptoms: string;
  summary: string | null;
  medicines?: string;
}

export const MAX_RECORDS = 8;
export const FIELD_CAP = 240;
export const MEDICINES_CAP = 120;
export const PAYLOAD_CAP = 4000;
/** Medicines ride along on the 3 most recent records that have a prescription. */
export const MEDICINES_ON_RECENT = 3;

/** Truncate on a word boundary with an ellipsis. Never fabricates. */
export function truncateAt(value: string, cap: number): string {
  if (value.length <= cap) return value;
  const slice = value.slice(0, cap - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const body = lastSpace > cap * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${body.trimEnd()}…`;
}

function serialisedLength(items: HistoryItem[]): number {
  return JSON.stringify(items).length;
}

/**
 * Deterministic and content-independent, which is what makes it a property
 * test rather than a fixture test.
 *
 * 1. Sort by `date` descending. **The most recent record is never dropped.**
 * 2. Keep at most 8 records.
 * 3. Truncate `symptoms` and `summary` to 240 chars each, `medicines` to 120.
 * 4. Attach `medicines` only to the 3 most recent records that have one.
 * 5. Hard-cap the serialised payload at 4 000 chars. While over cap, drop the
 *    oldest record. If a single record exceeds the cap alone, truncate further.
 */
export function trimHistory(history: HistoryItem[]): HistoryItem[] {
  const source = [...(history ?? [])];

  // 1 — newest first. Stable for equal dates.
  source.sort((a, b) => {
    const at = Date.parse(a.date);
    const bt = Date.parse(b.date);
    const av = Number.isNaN(at) ? -Infinity : at;
    const bv = Number.isNaN(bt) ? -Infinity : bt;
    return bv - av;
  });

  // 2 — cap the count.
  let kept = source.slice(0, MAX_RECORDS);

  // 3 + 4 — field-wise truncation of some input record, never a fabrication.
  let medicinesBudget = MEDICINES_ON_RECENT;
  kept = kept.map((item) => {
    const out: HistoryItem = {
      date: item.date,
      risk: item.risk,
      symptoms: truncateAt(item.symptoms ?? '', FIELD_CAP),
      summary:
        item.summary === null || item.summary === undefined
          ? null
          : truncateAt(item.summary, FIELD_CAP),
    };
    if (item.medicines && item.medicines.trim() !== '' && medicinesBudget > 0) {
      out.medicines = truncateAt(item.medicines, MEDICINES_CAP);
      medicinesBudget -= 1;
    }
    return out;
  });

  // 5 — payload cap. Drop the oldest while over.
  while (kept.length > 1 && serialisedLength(kept) > PAYLOAD_CAP) {
    kept.pop();
  }

  // A single record over the cap alone: truncate its fields further rather than
  // return nothing. The newest record is never dropped.
  if (kept.length === 1 && serialisedLength(kept) > PAYLOAD_CAP) {
    const only = kept[0];
    const overBy = serialisedLength(kept) - PAYLOAD_CAP;
    const room = Math.max(
      0,
      (only.symptoms.length + (only.summary?.length ?? 0)) - overBy,
    );
    const half = Math.floor(room / 2);
    kept = [
      {
        ...only,
        symptoms: truncateAt(only.symptoms, Math.max(1, half)),
        summary:
          only.summary === null || only.summary === undefined
            ? null
            : truncateAt(only.summary, Math.max(1, room - half)),
        ...(only.medicines
          ? { medicines: truncateAt(only.medicines, 40) }
          : {}),
      },
    ];
  }

  return kept;
}
