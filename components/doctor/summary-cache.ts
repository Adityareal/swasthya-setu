'use client';

import type { SummaryResponse } from '@/lib/types';
import { apiUrl } from '@/lib/api-base';
import { trimHistory, type HistoryItem } from '@/lib/summary/trim';
import { repo } from '@/lib/data/memory-repo';

/**
 * The Longitudinal_Summary cache (Req 14.2).
 *
 * A module singleton, so it is a SESSION cache that survives the route
 * transition from the queue into the panel. That is the whole point: the queue
 * row starts the request on click, the panel finds it already resolved on
 * mount, and the ten-second wait that would otherwise land in the middle of a
 * live demo lands under the presenter's own click instead.
 *
 * Two maps rather than one:
 *   `results`  — settled responses, including failures. A cached failure is
 *                what stops the panel re-requesting on every remount. Requesting
 *                again is a deliberate act: `load(id, { force: true })`, wired to
 *                ONE manual Retry button (Req 14.3). There is no retry loop.
 *   `inFlight` — dedupes concurrent callers, so a click followed immediately by
 *                the panel's own mount request is one network call.
 */

const results = new Map<string, SummaryResponse>();
const inFlight = new Map<string, Promise<SummaryResponse>>();

/** A transport-level failure reported in the same shape the route returns. */
function transportFailure(): SummaryResponse {
  return { summary: null, unavailable: true, source: 'gemini', reason: 'error' };
}

/**
 * Builds the request body from the Shared_Record. Medicines ride along on the
 * record they were prescribed against, which is what lets the summary name a
 * repeated prescription as a trend. `trimHistory` runs HERE as well as in the
 * route: it is idempotent, and trimming before the wire keeps the payload
 * bounded on the client too.
 */
async function buildBody(patientId: string): Promise<unknown> {
  const [patient, records, prescriptions] = await Promise.all([
    repo.getPatient(patientId),
    repo.listRecordsForPatient(patientId),
    repo.listPrescriptionsForPatient(patientId),
  ]);

  const medicinesByRecord = new Map<string, string>();
  for (const rx of prescriptions) {
    if (!medicinesByRecord.has(rx.recordId)) {
      medicinesByRecord.set(rx.recordId, rx.medicines);
    }
  }

  const history: HistoryItem[] = records.map((record) => {
    const medicines = medicinesByRecord.get(record.id);
    return {
      date: record.timestamp,
      risk: record.riskLevel,
      symptoms: record.symptoms,
      summary: record.aiTriageSummary,
      ...(medicines ? { medicines } : {}),
    };
  });

  return {
    patient: {
      age: patient?.age ?? null,
      gender: patient?.gender ?? null,
      preferredLanguage: patient?.preferredLanguage ?? 'hi-IN',
    },
    history: trimHistory(history),
  };
}

async function request(patientId: string): Promise<SummaryResponse> {
  try {
    const response = await fetch(apiUrl('/api/summary'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(await buildBody(patientId)),
    });
    if (!response.ok) return transportFailure();
    return (await response.json()) as SummaryResponse;
  } catch {
    return transportFailure();
  }
}

/** A settled response if one is held, without starting a request. */
export function peekSummary(patientId: string): SummaryResponse | undefined {
  return results.get(patientId);
}

/**
 * Resolves from the cache when warm, otherwise issues one request and caches
 * whatever it settles to. `force` discards the held response first — the Retry
 * button, and nothing else, passes it.
 */
export function loadSummary(
  patientId: string,
  options: { force?: boolean } = {},
): Promise<SummaryResponse> {
  if (options.force) results.delete(patientId);

  const held = results.get(patientId);
  if (held) return Promise.resolve(held);

  const pending = inFlight.get(patientId);
  if (pending) return pending;

  const started = request(patientId)
    .then((response) => {
      results.set(patientId, response);
      return response;
    })
    .finally(() => {
      inFlight.delete(patientId);
    });

  inFlight.set(patientId, started);
  return started;
}

/**
 * Fire-and-forget warm-up, called from the queue row. Deliberately returns
 * nothing: a caller that could await it would be tempted to block navigation on
 * it, and the entire value here is that navigation does not wait.
 */
export function prefetchSummary(patientId: string): void {
  if (patientId === '' || results.has(patientId) || inFlight.has(patientId)) return;
  void loadSummary(patientId);
}
