/**
 * Shared Gemini plumbing. Plain `fetch`, no SDK — one less dependency to fight.
 *
 * TEXT ONLY. Every request body built here contains `text` parts and nothing
 * else: the keys `inlineData` and `fileData` appear nowhere (Req 22.4).
 */

/**
 * `gemini-2.5-flash` still appears in `models.list` but `:generateContent`
 * answers 404 for this key: "no longer available to new users. Please update
 * your code to use models/gemini-3.6-flash". Verified by hand against the live
 * endpoint — every route was silently returning its deterministic fallback.
 * Pinned rather than tracking `gemini-flash-latest`, so a demo cannot change
 * behaviour between the rehearsal and the stage.
 */
export const GEMINI_MODEL = 'gemini-3.6-flash';
export const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const GEMINI_TIMEOUT_MS = 10_000;

/**
 * gemini-3.x reasons before it answers, and the reasoning shares the output
 * allowance: with thinking unconstrained, a 600-token budget comes back as
 * `{"kind":"question","` — truncated, unparseable, and indistinguishable from a
 * model failure. Verified against the live endpoint.
 *
 * `thinkingLevel` is the gemini-3 field. `thinkingBudget`, which gemini-2.5
 * accepted, is now a 400. Classifying against a fixed rubric does not need deep
 * reasoning, so the floor is the right setting and it belongs HERE rather than
 * in three route handlers that each have to remember it.
 */
export const DEFAULT_THINKING = {
  thinkingConfig: { thinkingLevel: 'low' },
} as const;

/**
 * A conversation turn on the wire. Gemini's role vocabulary is `user` / `model`,
 * not `user` / `assistant`, and `parts` carries text and nothing else.
 */
export interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface GenerateArgs {
  apiKey: string;
  systemInstruction: string;
  /** Single-shot text. Ignored when `contents` is supplied. */
  userText?: string;
  /** Multi-turn conversation, for the symptom chat. TEXT PARTS ONLY. */
  contents?: GeminiContent[];
  generationConfig: Record<string, unknown>;
  signal: AbortSignal;
}

/** Resolves to the raw response JSON, or throws with a stable error message. */
export async function generateContent(args: GenerateArgs): Promise<unknown> {
  const contents: GeminiContent[] =
    args.contents && args.contents.length > 0
      ? args.contents
      : [{ role: 'user', parts: [{ text: args.userText ?? '' }] }];

  if (contents.every((c) => c.parts.every((p) => p.text.trim() === ''))) {
    throw new Error('gemini-empty-request');
  }

  const body = {
    systemInstruction: { parts: [{ text: args.systemInstruction }] },
    contents,
    /* Caller-last, so a route can override the thinking level if it ever needs
       to, and gets the safe default if it says nothing. */
    generationConfig: { ...DEFAULT_THINKING, ...args.generationConfig },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': args.apiKey,
    },
    body: JSON.stringify(body),
    signal: args.signal,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`gemini-http-${res.status}`);
  }
  return res.json();
}
