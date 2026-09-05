'use client';

import type { SummaryResponse, SupportedLanguage } from '@/lib/types';
import { apiUrl } from '@/lib/api-base';
import { trimHistory, type HistoryItem } from '@/lib/summary/trim';
import { composeTemplateSummary } from '@/lib/summary/template';
import { isEffectivelyOnline } from '@/lib/offline/simulate';
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
 * The offline summary: a deterministic restatement of the patient's own stored
 * rows, composed on the device, labelled `source: 'template'` — the panel prints
 * "Composed from recorded visits. No clinical inference." beside it — and
 * reported as a SUCCESS, because with no network it is the best honest answer
 * available and it makes no claim it cannot support.
 *
 * This is the whole reason the connectivity check lives on the CLIENT. The route
 * used to compose this same string whenever `GEMINI_API_KEY` was missing, which
 * meant a doctor with a working network could be shown a template in the AI
 * summary plate and never learn the AI had not run. Same policy as the chat:
 * offline, the deterministic path is honest; online, it hides a real failure.
 */
function templateSummary(body: SummaryRequestBody): SummaryResponse {
  return {
    summary: composeTemplateSummary(body.history, body.patient.preferredLanguage),
    unavailable: false,
    source: 'template',
    reason: 'offline',
  };
}

interface SummaryRequestBody {
  patient: {
    age: number | null;
    gender: string | null;
    preferredLanguage: SupportedLanguage;
  };
  history: HistoryItem[];
}

/**
 * Builds the request body from the Shared_Record. Medicines ride along on the
 * record they were prescribed against, which is what lets the summary name a
 * repeated prescription as a trend. `trimHistory` runs HERE as well as in the
 * route: it is idempotent, and trimming before the wire keeps the payload
 * bounded on the client too.
 */
async function buildBody(patientId: string): Promise<SummaryRequestBody> {
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
  const body = await buildBody(patientId);

  /* Nothing to synthesise is not a failure and not a template either. Answered
     here as well as in the route so the offline branch below cannot compose a
     summary of no visits. */
  if (body.history.length === 0) {
    return {
      summary: null,
      unavailable: true,
      source: 'template',
      reason: 'empty-history',
    };
  }

  /* OFFLINE: no request at all. `isEffectivelyOnline()` is the product's one
     definition of online — browser state AND the demo's simulated switch — and
     nothing here reads `navigator.onLine` directly. */
  if (!isEffectivelyOnline()) return templateSummary(body);

  try {
    const response = await fetch(apiUrl('/api/summary'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    /* A non-200, or a 200 whose body will not parse, is a failure while online.
       It gets the unavailable notice and the one manual Retry, not a template. */
    if (!response.ok) return transportFailure();
    const payload = (await response
      .json()
      .catch(() => null)) as SummaryResponse | null;
    return payload ?? transportFailure();
  } catch {
    /* The same deliberate crossover the chat makes: `fetch` threw, so the
       request never completed and the network dropped after the check above. It
       now truthfully IS offline, so the local template is the honest answer. */
    return templateSummary(body);
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
      /* Everything is cached EXCEPT the offline template. A failure has to be
         cached — that is what stops the panel re-requesting on every remount,
         and it carries a visible Retry. But an offline template is the right
         answer for a moment that has passed: holding it would leave the panel
         restating stored rows for the rest of the session even after the network
         came back, and the template plate has no Retry to escape with. */
      if (response.reason !== 'offline') results.set(patientId, response);
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
