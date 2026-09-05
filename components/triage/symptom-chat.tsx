'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Send } from 'lucide-react';
import type {
  ChatFailureReason,
  ChatStep,
  ChatStepResponse,
  ChatTurn,
  RiskLevel,
  SupportedLanguage,
  TriageSource,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT, type MessageKey } from '@/lib/i18n';
import { apiUrl } from '@/lib/api-base';
import { isEffectivelyOnline } from '@/lib/offline/simulate';
import { readChatResponse } from '@/lib/triage/chat-schema';
import {
  MAX_QUESTIONS,
  appendTurn,
  localAssessment,
  nextAction,
  questionOrdinal,
  transcriptOf,
} from '@/lib/triage/chat-reducer';
import { useSpeechRecognition } from '@/lib/voice/use-speech-recognition';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RiskBadge } from '@/components/system/risk-badge';
import { BiLabel } from '@/components/system/bi-label';
import { MicButton, VoiceCaption } from '@/components/voice/mic-button';
import { InterimTranscript } from '@/components/voice/interim-transcript';
import { ReadbackButton } from '@/components/voice/readback-button';

/**
 * The Symptom_Chat.
 *
 * It does not replace the Triage_Engine, it FEEDS it: the conversation
 * terminates in the same structured result a single-shot submission produces, so
 * the record, the routing and the token downstream are unchanged.
 *
 * Chips are the PRIMARY input path and the composer is secondary. A person who
 * cannot type still answers every question, and the composer stays present
 * because a complaint that fits no chip has to be sayable.
 *
 * The convergence rules are enforced twice: the route applies the reducer
 * server-side, and this component applies it again before it renders. A UI that
 * trusts a response to be bounded is a UI that can be unbounded by a bad
 * response.
 *
 * THE ONLINE / OFFLINE DECISION LIVES HERE, and it can only live here.
 *
 *   OFFLINE — `fallbackTriage` over the transcript, no network attempt at all,
 *             rendered with the visible keyword-fallback label. That is the
 *             honest best effort: no model is reachable, and a deterministic
 *             reading of the patient's own words is the most this device can
 *             truthfully offer.
 *   ONLINE  — pure Gemini. A failed call surfaces as a visible, retryable error
 *             and NEVER as a keyword assessment. A keyword verdict standing in
 *             for the AI while the network is fine is dishonest output: it wears
 *             the assessment plate, it reads as the model's answer, and it hides
 *             a real failure from the only people who could act on it.
 *
 * The route cannot make this call — it runs on a server and has no idea whether
 * the *client* has a network — which is why it reports `{ ok: false, reason }`
 * and leaves the meaning of a failure to this component.
 */

export interface ChatOutcome {
  /** The full conversation, stored on the record so a doctor can see HOW the
   *  assessment was reached rather than only the conclusion. */
  turns: ChatTurn[];
  /** User turns only — this becomes `health_records.symptoms`. */
  transcript: string;
  risk: RiskLevel;
  summary: string;
  recommendedNextStep: string;
  redFlags: string[];
  source: TriageSource;
}

interface ChatState {
  turns: ChatTurn[];
  step: ChatStep | null;
  source: TriageSource | null;
  busy: boolean;
  /**
   * Set ONLY on the online path, and only when the AI call itself failed. It is
   * never set offline, because offline is not a failure — it is a different and
   * legitimate way to answer. `turns` is left intact alongside it, which is what
   * makes Retry re-send the same conversation instead of losing it.
   */
  error: ChatFailureReason | null;
}

const INITIAL: ChatState = {
  turns: [],
  step: null,
  source: null,
  busy: false,
  error: null,
};

/** One line naming what actually went wrong. A retry the user cannot reason
 *  about is a button they press twice and then give up on. */
const REASON_KEY: Record<ChatFailureReason, MessageKey> = {
  timeout: 'chat.error.reason.timeout',
  error: 'chat.error.reason.error',
  unparseable: 'chat.error.reason.unparseable',
  'no-key': 'chat.error.reason.no-key',
};

export function SymptomChat({
  patient,
  locale: localeProp,
  onComplete,
  continueLabelKey = 'chat.continue',
  className,
}: {
  patient?: { age?: number | null; gender?: string | null };
  /** Overrides the store locale, for a subject whose `preferredLanguage`
   *  differs from the device locale during an Assisted_Session. */
  locale?: SupportedLanguage;
  onComplete: (outcome: ChatOutcome) => void;
  continueLabelKey?: 'chat.continue' | 'common.continue';
  className?: string;
}) {
  const { t, locale: storeLocale } = useT();
  const locale = localeProp ?? storeLocale;

  const [state, setState] = useState<ChatState>(INITIAL);
  const [draft, setDraft] = useState('');
  const liveRef = useRef<HTMLDivElement | null>(null);

  /**
   * Voice capture (Req 5.6, 5.7, 5.8) — ADDITIVE BY CONSTRUCTION.
   *
   * The mic does not own any text. Settled chunks are appended to `draft`, the
   * same state the keyboard writes to and the same state `send` reads, so there
   * is exactly one transcript and it is always the editable one. That is why
   * voice cannot break intake: remove the microphone, remove the hook, remove
   * this whole block, and every path through this component is unchanged.
   *
   * It is also why Req 5.7 ("edit the captured transcript before submission")
   * needs no implementation. There is nothing to convert from a voice buffer into
   * an editable field, because the editable field was the buffer all along.
   */
  const appendTranscript = useCallback((chunk: string) => {
    setDraft((prev) => {
      const head = prev.replace(/\s+$/u, '');
      return head === '' ? chunk : `${head} ${chunk}`;
    });
  }, []);

  const voice = useSpeechRecognition({ locale, onTranscript: appendTranscript });
  const { stop: stopVoice, reset: resetVoice } = voice;

  /* Keep the newest turn in view without stealing focus from the composer. */
  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [state.turns.length, state.step, state.busy]);

  /**
   * Resolve one step of the conversation from a COMPLETE turn list.
   *
   * It takes the turns rather than reading them from state, which is what lets
   * `send` (turns + one new answer) and `retry` (the very same turns) share every
   * line below. Retry therefore cannot drift from the request it is retrying.
   */
  const resolve = useCallback(
    async (turns: ChatTurn[]) => {
      const action = nextAction(turns, locale);

      setState((prev) => ({
        ...prev,
        turns,
        step: null,
        busy: true,
        error: null,
      }));

      /* The offline half of rule 3. The reducer supplies the transcript, so the
         local result is computed from exactly the string the online path would
         have sent. */
      const offline = (): ChatStepResponse => ({
        ok: true,
        step: localAssessment(turns, locale),
        source: 'fallback',
      });

      let response: ChatStepResponse;

      if (!isEffectivelyOnline()) {
        /* No network: no request, not even an attempt. A keyword assessment is
           the honest answer here and it is labelled as one. */
        response = offline();
      } else {
        try {
          const res = await fetch(apiUrl('/api/triage/chat'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              turns,
              locale,
              ...(patient
                ? {
                    patient: {
                      age: patient.age ?? null,
                      gender: patient.gender ?? null,
                    },
                  }
                : {}),
              forceAssessment: action.kind === 'assess',
            }),
          });

          /* A non-200, or a 200 whose body will not parse, is a FAILURE while
             online — not an offline situation. `readChatResponse(null)` reports
             it as one, and it cannot read a failure as an assessment. */
          const body: unknown = res.ok ? await res.json().catch(() => null) : null;
          response = readChatResponse(body);
        } catch {
          /* THE ONE DELIBERATE CROSSOVER.
             `fetch` itself threw, so the request never completed: the network
             dropped between the connectivity check above and this line. It now
             truthfully IS an offline situation — `navigator.onLine` frequently
             has not caught up yet — so the local keyword assessment is the
             honest answer, exactly as it would have been a moment earlier. This
             is the only path on which a thrown request produces an assessment
             instead of an error plate. */
          response = offline();
        }
      }

      if (!response.ok) {
        /* Visible, retryable, and the transcript above it is untouched. */
        const reason = response.reason;
        setState((prev) => ({
          ...prev,
          step: null,
          source: null,
          busy: false,
          error: reason,
        }));
        return;
      }

      /* The second enforcement of rule 1, the turn cap. The route already
         rejects a question when an assessment was mandatory; this keeps the
         bound unconditional rather than contingent on the route staying correct.
         It resolves to a visible failure rather than to a keyword assessment,
         because online substitution is the dishonesty this policy removed — and
         it cannot fire offline, where the response was built locally and is an
         assessment by construction. */
      if (action.kind === 'assess' && response.step.kind === 'question') {
        setState((prev) => ({
          ...prev,
          step: null,
          source: null,
          busy: false,
          error: 'unparseable',
        }));
        return;
      }

      const step = response.step;
      const source = response.source;

      setState((prev) => ({
        ...prev,
        turns:
          step.kind === 'question'
            ? appendTurn(turns, {
                role: 'assistant',
                text: step.question,
                at: new Date().toISOString(),
              })
            : turns,
        step,
        source,
        busy: false,
        error: null,
      }));
    },
    [locale, patient],
  );

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (body === '' || state.busy) return;

      /* Sending while the mic is live closes it. Any tail the engine has not
         finalised yet is flushed by the hook's `onend` and lands in the composer
         as the start of the NEXT answer — those are still words the user said, so
         they are kept rather than dropped on the floor. */
      stopVoice();

      const at = new Date().toISOString();
      setDraft('');
      await resolve(appendTurn(state.turns, { role: 'user', text: body, at }));
    },
    [resolve, state.busy, state.turns, stopVoice],
  );

  /** Re-sends the conversation exactly as it stands. No turn is added, nothing
   *  is re-typed, and the transcript the user already gave is what goes back on
   *  the wire — which is the whole reason an error state is allowed to exist. */
  const retry = useCallback(() => {
    if (state.busy || state.turns.length === 0) return;
    void resolve(state.turns);
  }, [resolve, state.busy, state.turns]);

  function restart() {
    setState(INITIAL);
    setDraft('');
    /* A new conversation gets a clean mic: a `not-allowed` from the last one
       must not leave the button dead for a session the user just restarted. */
    stopVoice();
    resetVoice();
  }

  const step = state.step;
  const assessment = step?.kind === 'assessment' ? step : null;
  const question = step?.kind === 'question' ? step : null;
  const started = state.turns.length > 0;

  /**
   * One line under the composer, and only one. In priority order:
   *
   *   error   — a real recognition failure, and the words already spoken are in
   *             the textarea above it (Req 5.8)
   *   note    — no `SpeechRecognition` on this browser, so the mic is disabled
   *             and this says why (Req 5.8's first clause)
   *   listening — plain state, so the fill colour is not the only signal
   *
   * Stacking all three would put three plates under a two-row textarea on a
   * 360px screen and push Send below the fold.
   */
  const voiceCaption: { text: string; tone: 'listening' | 'error' | 'note' } | null =
    voice.errorText !== null
      ? { text: voice.errorText, tone: 'error' }
      : !voice.supported
        ? { text: t('voice.unsupported'), tone: 'note' }
        : voice.listening
          ? { text: t('voice.listening'), tone: 'listening' }
          : null;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* ——— Bounded progress. A conversation that shows its own end is a
              conversation a patient will finish. ——— */}
      {!assessment && (
        <div className="flex items-center justify-between gap-3">
          <p
            lang={locale}
            className="tabular text-caption font-semibold text-ink-muted"
          >
            {t('chat.progress', {
              n: questionOrdinal(state.turns),
              max: MAX_QUESTIONS,
            })}
          </p>
          {started && (
            <Button type="button" variant="ghost" size="sm" onClick={restart}>
              <RotateCcw aria-hidden="true" />
              <span lang={locale}>{t('chat.restart')}</span>
            </Button>
          )}
        </div>
      )}

      {/* ——— The transcript ——— */}
      <div className="flex flex-col gap-3" aria-live="polite">
        {/* Static opening line. Deliberately NOT a turn: it is UI copy, and
            counting it would spend a third of the question budget on a greeting. */}
        <Bubble role="assistant" text={t('chat.opening')} locale={locale} />

        {state.turns.map((turn, i) => (
          <Bubble
            key={`${turn.at}-${i}`}
            role={turn.role}
            text={turn.text}
            locale={locale}
          />
        ))}

        {state.busy && <Thinking label={t('chat.thinking')} locale={locale} />}

        <div ref={liveRef} />
      </div>

      {/* ——— The retryable failure plate.
              This is what an ONLINE Gemini failure looks like: the failure
              itself, named, with the conversation still on screen above it and
              one button that sends the same turns again. It is deliberately NOT
              an assessment — there is no risk badge here and no summary, because
              there is nothing to summarise. Rule 3 of the Convergence_Contract
              is satisfied by the Retry: the conversation has a way forward, and
              a way forward is what "never dead-end" asks for, not a fabricated
              verdict. ——— */}
      {state.error && !state.busy && (
        <section
          className="plate flex flex-col gap-3 p-4"
          data-state="error"
          role="alert"
        >
          <BiLabel
            k="chat.error.title"
            className="text-title font-semibold text-ink"
          />
          <p lang={locale} className="max-w-[70ch] text-field font-semibold text-ink">
            {t('chat.error')}
          </p>
          <p lang={locale} className="max-w-[70ch] text-body text-ink-muted">
            {t(REASON_KEY[state.error])}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="field" onClick={retry} className="sm:w-auto">
              <RefreshCw aria-hidden="true" />
              <BiLabel k="action.retry" secondaryClassName="text-action-fg/75" />
            </Button>
            <Button type="button" variant="outline" onClick={restart}>
              <RotateCcw aria-hidden="true" />
              <span lang={locale}>{t('chat.restart')}</span>
            </Button>
          </div>
        </section>
      )}

      {/* ——— Quick replies. The primary input path, at the 44px floor. ——— */}
      {question && question.quickReplies.length > 0 && !state.busy && (
        <fieldset className="flex flex-col gap-2">
          <legend
            lang={locale}
            className="mb-1 text-caption font-semibold text-ink-muted uppercase"
          >
            {t('chat.quickReplies')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {question.quickReplies.map((reply) => (
              <Button
                key={reply}
                type="button"
                variant="outline"
                onClick={() => void send(reply)}
                className="max-w-full min-h-touch whitespace-normal text-left"
              >
                <span lang={locale} className="break-words">
                  {reply}
                </span>
              </Button>
            ))}
          </div>
        </fieldset>
      )}

      {/* ——— The assessment. Terminal. ——— */}
      {assessment && (
        <section className="plate flex flex-col gap-3 p-4" data-state={assessment.risk_level}>
          <BiLabel
            k="chat.assessment.title"
            className="text-title font-semibold text-ink"
          />

          {/* `<RiskBadge>` renders `<AdvisoryNote>` and the fallback label from
              inside itself, so Req 10.1 and 9.4 cannot be omitted here. */}
          <RiskBadge
            risk={assessment.risk_level}
            {...(state.source ? { triageSource: state.source } : {})}
          />

          <p lang={locale} className="max-w-[70ch] text-field text-ink">
            {assessment.summary}
          </p>

          <div>
            <BiLabel
              k="chat.assessment.nextStep"
              className="text-caption font-semibold text-ink-muted uppercase"
            />
            <p lang={locale} className="mt-1 max-w-[70ch] text-field font-semibold text-ink">
              {assessment.recommended_next_step}
            </p>
          </div>

          {assessment.red_flags && assessment.red_flags.length > 0 && (
            <div>
              <BiLabel
                k="chat.assessment.redFlags"
                className="text-caption font-semibold text-ink-muted uppercase"
              />
              <ul className="mt-1 flex flex-col gap-1">
                {assessment.red_flags.map((flag) => (
                  <li
                    key={flag}
                    lang={locale}
                    className="flex gap-2 text-body text-ink"
                  >
                    <span aria-hidden="true" className="text-ink-muted">
                      •
                    </span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* A keyword assessment can now reach this plate for exactly one
              reason — the device had no network — so the caption says that
              plainly instead of the older "could not be completed online",
              which was also shown when the network was fine. `<RiskBadge>`
              above already carries the Req 9.4 fallback label; this line is the
              WHY beside it. */}
          {state.source === 'fallback' && (
            <p lang={locale} className="max-w-[70ch] text-caption font-semibold text-ink-muted">
              {t('chat.offline')}
            </p>
          )}

          {/* Req 11.1 — playback of the summary and the next step, in the
              patient's own language. It sits INSIDE this plate, below the text it
              reads, which is what discharges Req 11.3's on-screen-text half: the
              guidance is already above the button when the button reports that no
              voice exists for that language. */}
          <ReadbackButton
            locale={locale}
            summary={assessment.summary}
            nextStep={assessment.recommended_next_step}
          />

          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              size="field"
              className="sm:w-auto"
              onClick={() =>
                onComplete({
                  turns: state.turns,
                  transcript: transcriptOf(state.turns),
                  risk: assessment.risk_level,
                  summary: assessment.summary,
                  recommendedNextStep: assessment.recommended_next_step,
                  redFlags: assessment.red_flags ?? [],
                  source: state.source ?? 'fallback',
                })
              }
            >
              <BiLabel
                k={continueLabelKey}
                secondaryClassName="text-action-fg/75"
              />
            </Button>
            <Button type="button" variant="outline" onClick={restart}>
              <RotateCcw aria-hidden="true" />
              <span lang={locale}>{t('chat.restart')}</span>
            </Button>
          </div>
        </section>
      )}

      {/* ——— The composer. It IS the transcript holder, which is why the mic can
              write into it without touching this component's contract. ——— */}
      {!assessment && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <label
            htmlFor="chat-composer"
            lang={locale}
            className="text-caption font-semibold text-ink-muted uppercase"
          >
            {t('chat.composer.label')}
          </label>
          <Textarea
            id="chat-composer"
            name="answer"
            rows={2}
            lang={locale}
            value={draft}
            disabled={state.busy}
            placeholder={t('chat.composer.placeholder')}
            /* Editable while the mic is live, which is the point: a
               mis-transcription is a correction, not a dead end (Req 5.7). */
            aria-describedby={
              [
                voice.interim !== '' ? 'chat-voice-interim' : null,
                voiceCaption !== null ? 'chat-voice-caption' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              /* Enter sends, Shift+Enter breaks the line. A two-line answer is
                 rare here and a stray newline costing a send is not. */
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />

          {/* The unsettled tail, muted with a dashed underline — never italic. */}
          <InterimTranscript
            id="chat-voice-interim"
            text={voice.interim}
            label={t('voice.interim')}
            locale={locale}
          />

          {voiceCaption && (
            <VoiceCaption
              id="chat-voice-caption"
              text={voiceCaption.text}
              tone={voiceCaption.tone}
              locale={locale}
            />
          )}

          {/* Mic beside Send, both at the 56px field floor. The mic is an INPUT
              METHOD for the field above, so it sits with the send action rather
              than floating somewhere else on the screen. */}
          <div className="flex items-stretch gap-2">
            <MicButton
              listening={voice.listening}
              supported={voice.supported}
              /* Req 5.8 — a denied microphone, an absent one or an unreachable
                 recognition service will not fix itself on a retry, so voice
                 stands down for the session and the textarea above (which still
                 holds every word already spoken) becomes the path. `restart`
                 clears the latch, so a fresh conversation gets a fresh mic. */
              disabled={state.busy || voice.fellBackToText}
              locale={locale}
              labels={{
                listen: t('voice.listen'),
                stop: t('voice.stop'),
                unsupported: t('voice.unsupported'),
              }}
              {...(voiceCaption ? { describedBy: 'chat-voice-caption' } : {})}
              onStart={voice.start}
              onStop={voice.stop}
            />
            <Button
              type="submit"
              size="field"
              className="flex-1"
              disabled={state.busy || draft.trim() === ''}
            >
              <Send aria-hidden="true" />
              <BiLabel k="chat.send" secondaryClassName="text-action-fg/75" />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ————————————————————————————— Message bubbles ————————————————————————————— */

/**
 * Assistant left on `--ss-surface` with the action-blue signal rail; user right
 * on `--ss-sunk` with no rail. The rail is what makes the two speakers readable
 * as a column of colour before a word is read, which is the same trick every
 * other surface in this product uses.
 */
function Bubble({
  role,
  text,
  locale,
}: {
  role: ChatTurn['role'];
  text: string;
  locale: SupportedLanguage;
}) {
  const { t } = useT();
  const isUser = role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] px-3 py-2 sm:max-w-[80ch]',
          isUser ? 'plate plate--sunk' : 'plate',
        )}
        {...(isUser ? {} : { 'data-state': 'action' as const })}
      >
        <p className="text-caption font-semibold text-ink-muted uppercase">
          {t(isUser ? 'chat.you' : 'chat.assistant')}
        </p>
        <p lang={locale} className="mt-0.5 text-field break-words text-ink">
          {text}
        </p>
      </div>
    </div>
  );
}

/** Loading is a plate-shaped skeleton with a text label, never a bare spinner:
 *  a spinner says "something is happening" and this says what. */
function Thinking({ label, locale }: { label: string; locale: SupportedLanguage }) {
  return (
    <div className="flex justify-start" role="status">
      <div className="flex max-w-[90%] flex-col gap-2">
        <p lang={locale} className="text-caption font-semibold text-ink-muted">
          {label}
        </p>
        <div className="flex flex-col gap-1.5" aria-hidden="true">
          <div className="skeleton-plate h-4 w-48" />
          <div className="skeleton-plate h-4 w-32" />
        </div>
      </div>
    </div>
  );
}
