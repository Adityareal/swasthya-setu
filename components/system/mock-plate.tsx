'use client';

import type { ReactNode } from 'react';
import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

/**
 * The Mock_Badge appears on every mocked surface (Req 20.1), so it is a
 * component with a wrapper, not a class someone remembers to add. The wrapper
 * IS the layout, not a decoration on it — no mocked screen is built without it.
 */

export function MockBadge({ className }: { className?: string }) {
  const { t, tOther, locale, other } = useT();

  return (
    <span
      className={cn(
        /* Ink on ochre measures 7.9 : 1. Ochre is a fill, never a foreground. */
        'inline-flex items-center gap-1.5 rounded-chip border-2 border-line bg-med px-2 py-0.5 text-ink',
        className,
      )}
      style={{ letterSpacing: '0.04em' }}
    >
      <FlaskConical aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="flex flex-col items-start leading-none">
        <span lang={locale} className="text-caption font-semibold">
          {t('mock.badge')}
        </span>
        <span
          lang={other}
          aria-hidden="true"
          className="text-caption font-semibold opacity-70"
        >
          {tOther('mock.badge')}
        </span>
      </span>
    </span>
  );
}

/**
 * Sets `data-mock="true"` on the plate. One CSS rule then adds the dashed ochre
 * outline; `data-state="mock"` adds the ochre signal rail. So a mocked surface
 * carries two independent visual channels, neither applied by hand at the call
 * site.
 */
export function MockPlate({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <div className="plate p-4 pt-6" data-mock="true" data-state="mock">
        {children}
      </div>
      {/* Overlaps the border by 8px so it reads as a label affixed to the plate
          rather than as content inside it. */}
      <MockBadge className="absolute -top-2 right-3" />
    </div>
  );
}
