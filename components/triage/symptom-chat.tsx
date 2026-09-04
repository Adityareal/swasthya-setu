'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Send } from 'lucide-react';
import type {
  ChatStep,
  ChatStepResponse,
  ChatTurn,
  RiskLevel,
  SupportedLanguage,
  TriageSource,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { apiUrl } from '@/lib/api-base';
import { fallbackTriage } from '@/lib/triage/fallback';
import {
  MAX_QUESTIONS,
  appendTurn,
  nextAction,
  questionOrdinal,
  transcriptOf,
} from '@/lib/triage/chat-reducer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RiskBadge } from '@/components/system/risk-badge';
import { BiLabel } from '@/components/system/bi-label';

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
  degraded: boolean;
}

const INITIAL: ChatState = {
  turns: [],
  step: null,
  source: null,
  busy: false,
  degraded: false,
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

  /* Keep the newest turn in view without stealing focus from the composer. */
  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [state.turns.length, state.step, state.busy]);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (body === '' || state.busy) return;

      const at = new Date().toISOString();
      const withUser = appendTurn(state.turns, { role: 'user', text: body, at });
      const action = nextAction(withUser, locale);

      setState((prev) => ({
        ...prev,
        turns: withUser,
        step: null,
        busy: true,
        degraded: false,
      }));
      setDraft('');

      /* Rule 3: a network failure resolves locally rather than dead-ending. The
         reducer supplies the transcript, so the offline result is computed from
         exactly the string the online path would have sent. */
      const local = (): ChatStepResponse => {
        const result = fallbackTriage(transcriptOf(withUser), locale);
        return {
          step: {
            kind: 'assessment',
            risk_level: result.risk_level,
            summary: result.summary,
            recommended_next_step: result.recommended_next_step,
            ...(result.matched.length > 0 ? { red_flags: result.matched } : {}),
          },
          source: 'fallback',
        };
      };

      let response: ChatStepResponse;
      try {
        const res = await fetch(apiUrl('/api/triage/chat'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            turns: withUser,
            locale,
            ...(patient
              ? { patient: { age: patient.age ?? null, gender: patient.gender ?? null } }
              : {}),
            forceAssessment: action.kind === 'assess',
          }),
        });
        response = res.ok ? ((await res.json()) as ChatStepResponse) : local();
      } catch {
        response = local();
      }

      /* The second enforcement of rule 1. The route already guarantees this; the
         guard costs four lines and makes the bound unconditional rather than
         contingent on a route staying correct. */
      const step =
        action.kind === 'assess' && response.step.kind === 'question'
          ? local().step
          : response.step;
      const source =
        step === response.step ? response.source : ('fallback' as TriageSource);

      setState((prev) => ({
        ...prev,
        turns:
          step.kind === 'question'
            ? appendTurn(withUser, {
                role: 'assistant',
                text: step.question,
                at: new Date().toISOString(),
              })
            : withUser,
        step,
        source,
        busy: false,
        degraded: source === 'fallback',
      }));
    },
    [locale, patient, state.busy, state.turns],
  );

  function restart() {
    setState(INITIAL);
    setDraft('');
  }

  const step = state.step;
  const assessment = step?.kind === 'assessment' ? step : null;
  const question = step?.kind === 'question' ? step : null;
  const started = state.turns.length > 0;

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

          {state.degraded && (
            <p lang={locale} className="max-w-[70ch] text-caption font-semibold text-ink-muted">
              {t('chat.error')}
            </p>
          )}

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

      {/* ——— The composer. It IS the transcript holder, which is why voice can
              later write into it without touching this component's contract. ——— */}
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
          <Button
            type="submit"
            size="field"
            disabled={state.busy || draft.trim() === ''}
          >
            <Send aria-hidden="true" />
            <BiLabel k="chat.send" secondaryClassName="text-action-fg/75" />
          </Button>
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
