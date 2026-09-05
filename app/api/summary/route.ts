import { NextResponse } from 'next/server';
import type { SummaryResponse, SupportedLanguage } from '@/lib/types';
import { trimHistory, type HistoryItem } from '@/lib/summary/trim';
import { extractText } from '@/lib/triage/parse';
import { GEMINI_TIMEOUT_MS, generateContent } from '@/lib/gemini';

export const runtime = 'nodejs';

/**
 * Longitudinal_Summary.
 *
 * Plain-text output, not JSON — there is only one field, and a schema for one
 * string is ceremony. No diagnosis, no new clinical claims, visits referenced
 * by date, and any cross-visit trend named explicitly.
 *
 * ALWAYS HTTP 200. Every outcome this route can reach with a request in hand is
 * either a Gemini summary or `{ summary: null, unavailable: true, reason }` —
 * a timeout, an empty body, an HTTP error, or a missing key. It never composes
 * a local template: reaching this handler at all proves the client had a
 * network, and a restatement of stored rows shown in the summary plate while the
 * network is fine hides a real failure from the presenter (Req 14.3). The
 * template lives on the client now, behind `isEffectivelyOnline()`.
 *
 * Vitals are deliberately not accepted here. Paraphrasing a blood pressure
 * through a language model is a way to introduce an error into the one part of
 * the record that has none.
 */

const SYSTEM_INSTRUCTION = `You are a clinical summarisation assistant for doctors at a rural health centre in India.
You summarise a patient's recorded visit history. You do not diagnose.

Rules:
- Never name a disease or condition and never introduce a clinical claim that is not
  already in the records provided.
- Reference visits by their date.
- Name any trend visible ACROSS visits (a recurring complaint, a rising or falling
  triage priority, a repeated prescription). If no trend is visible, say so.
- Three to five sentences. Plain text only, no markdown, no headings, no lists.
- Write in the language of the LOCALE field.`;

interface SummaryBody {
  patient?: {
    age?: unknown;
    gender?: unknown;
    preferredLanguage?: unknown;
  };
  history?: unknown;
}

function asLocale(value: unknown): SupportedLanguage {
  return value === 'en-IN' ? 'en-IN' : 'hi-IN';
}

function asHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  const out: HistoryItem[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.date !== 'string') continue;
    const risk = item.risk;
    if (risk !== 'low' && risk !== 'medium' && risk !== 'high') continue;
    out.push({
      date: item.date,
      risk,
      symptoms: typeof item.symptoms === 'string' ? item.symptoms : '',
      summary: typeof item.summary === 'string' ? item.summary : null,
      ...(typeof item.medicines === 'string' ? { medicines: item.medicines } : {}),
    });
  }
  return out;
}

function buildUserText(
  trimmed: HistoryItem[],
  locale: SupportedLanguage,
  age: unknown,
  gender: unknown,
): string {
  const patient = [
    typeof age === 'number' && Number.isFinite(age) ? `age ${age}` : null,
    typeof gender === 'string' && gender.trim() !== '' ? gender.trim() : null,
  ]
    .filter(Boolean)
    .join(', ');

  const visits = trimmed
    .map((item, i) => {
      const parts = [
        `${i + 1}. DATE: ${item.date}`,
        `   TRIAGE PRIORITY: ${item.risk}`,
        `   COMPLAINT: ${item.symptoms}`,
      ];
      if (item.summary) parts.push(`   PRIOR SUMMARY: ${item.summary}`);
      if (item.medicines) parts.push(`   MEDICINES: ${item.medicines}`);
      return parts.join('\n');
    })
    .join('\n');

  return [
    `LOCALE: ${locale}`,
    `PATIENT: ${patient === '' ? 'not stated' : patient}`,
    'VISITS, newest first:',
    visits,
  ].join('\n');
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: SummaryBody;
  try {
    body = (await request.json()) as SummaryBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const locale = asLocale(body.patient?.preferredLanguage);
  const history = asHistory(body.history);
  const trimmed = trimHistory(history);

  if (trimmed.length === 0) {
    const empty: SummaryResponse = {
      summary: null,
      unavailable: true,
      source: 'template',
      reason: 'empty-history',
    };
    return NextResponse.json(empty);
  }

  const apiKey = process.env.GEMINI_API_KEY;

  /* No key is a FAILURE here, not a template.
     This route used to compose `composeTemplateSummary` and return it as a
     success. It no longer does, for the same reason the chat route no longer
     falls back: a deterministic restatement of stored rows, presented in the
     summary plate while the doctor's device is perfectly online, reads as the
     AI summary and hides a misconfigured deployment from the only person who
     can fix it. The template survives — it is composed CLIENT-SIDE by
     `components/doctor/summary-cache.ts` when, and only when, the client
     reports itself offline, which is the one situation where a local
     restatement is the honest best available answer. The server cannot make
     that call: it does not know whether the client has a network. */
  if (!apiKey) {
    const noKey: SummaryResponse = {
      summary: null,
      unavailable: true,
      source: 'gemini',
      reason: 'no-key',
    };
    return NextResponse.json(noKey);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort('summary-timeout'), GEMINI_TIMEOUT_MS);

  try {
    const raw = await generateContent({
      apiKey,
      systemInstruction: SYSTEM_INSTRUCTION,
      userText: buildUserText(trimmed, locale, body.patient?.age, body.patient?.gender),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
      },
      signal: ac.signal,
    });

    const text = extractText(raw);
    if (text.trim() === '') throw new Error('empty');

    const ok: SummaryResponse = {
      summary: text.trim(),
      unavailable: false,
      source: 'gemini',
    };
    return NextResponse.json(ok);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    const reason: SummaryResponse['reason'] =
      message === 'empty'
        ? 'unparseable'
        : ac.signal.aborted
          ? 'timeout'
          : 'error';

    const failed: SummaryResponse = {
      summary: null,
      unavailable: true,
      source: 'gemini',
      reason,
    };
    return NextResponse.json(failed);
  } finally {
    clearTimeout(timer);
  }
}
