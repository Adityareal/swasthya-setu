'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The states the Signal Rail can carry. */
export type SignalState =
  | 'low'
  | 'medium'
  | 'high'
  | 'action'
  | 'mock'
  | 'error'
  | 'neutral'
  | 'offline';

/**
 * The Enamel Plate, as a component for the common case. Every card, panel,
 * banner, badge and modal is the same object: flat single fill, 2px ink border,
 * 4px radius, hard offset shadow. No gradient, no blur, no inner glow.
 */
export function Plate({
  children,
  state,
  raised = false,
  mock = false,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  state?: SignalState;
  raised?: boolean;
  mock?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
}) {
  return (
    <Tag
      className={cn('plate', raised && 'plate--raised', className)}
      {...(state ? { 'data-state': state } : {})}
      {...(mock ? { 'data-mock': 'true' } : {})}
    >
      {children}
    </Tag>
  );
}

/** A titled plate. Used by every placeholder route so the shell is verifiable
 *  before the screens land. */
export function TitledPlate({
  title,
  secondary,
  state,
  children,
  className,
}: {
  title: ReactNode;
  secondary?: ReactNode;
  state?: SignalState;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Plate state={state} className={cn('p-4', className)} as="section">
      <h2 className="text-title font-semibold text-ink">{title}</h2>
      {secondary && (
        <p className="mt-1 max-w-[70ch] text-caption font-semibold text-ink-muted">
          {secondary}
        </p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </Plate>
  );
}
