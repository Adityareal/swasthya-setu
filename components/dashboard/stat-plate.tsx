'use client';

import type { ReactNode } from 'react';
import { Plate } from '@/components/system/plate';
import { BiLabel } from '@/components/system/bi-label';
import type { MessageKey } from '@/lib/i18n';
import type { SignalState } from '@/components/system/plate';

/**
 * One headline number.
 *
 * The number leads at display size and the label sits under it in both scripts,
 * because a dashboard is read from across a desk before it is read up close.
 * `tabular` so a column of these does not jitter as the counts change.
 */
export function StatPlate({
  labelKey,
  value,
  caption,
  state,
}: {
  labelKey: MessageKey;
  value: ReactNode;
  caption?: ReactNode;
  state?: SignalState;
}) {
  return (
    <Plate state={state} className="p-3" as="article">
      <span className="tabular block text-display leading-none font-extrabold text-ink">
        {value}
      </span>
      <BiLabel
        k={labelKey}
        className="mt-1 text-caption font-semibold text-ink uppercase"
      />
      {caption && (
        <p className="tabular mt-1 text-caption font-semibold text-ink-muted">
          {caption}
        </p>
      )}
    </Plate>
  );
}
