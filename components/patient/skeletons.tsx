'use client';

import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

/**
 * Loading is a plate-shaped skeleton, never a spinner over content.
 *
 * The skeleton takes the SHAPE of what is coming — a chit-height block for the
 * appointment, shorter blocks for the thread — so the layout does not jump when
 * the data lands. A spinner tells a patient to wait; a skeleton tells them what
 * they are waiting for.
 */

export function SkeletonPlate({
  lines = 2,
  tall = false,
  className,
}: {
  lines?: number;
  tall?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton-plate flex flex-col gap-3 p-4',
        tall && 'min-h-48',
        className,
      )}
    >
      <div className="h-6 w-1/2 rounded-plate bg-line/15" />
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn('h-4 rounded-plate bg-line/15', i % 2 === 0 ? 'w-full' : 'w-4/5')}
        />
      ))}
      {tall && <div className="mt-auto h-12 w-24 self-end rounded-plate bg-line/15" />}
    </div>
  );
}

/** The patient home's shape: language, chit, referrals, guidance. */
export function PatientHomeSkeleton() {
  const { t, locale } = useT();
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span lang={locale} className="sr-only">
        {t('common.loading')}
      </span>
      <SkeletonPlate lines={1} />
      <SkeletonPlate lines={2} tall />
      <SkeletonPlate lines={2} />
      <SkeletonPlate lines={3} />
    </div>
  );
}

/** The thread's shape: a column of entries. */
export function PatientThreadSkeleton() {
  const { t, locale } = useT();
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span lang={locale} className="sr-only">
        {t('common.loading')}
      </span>
      <SkeletonPlate lines={3} />
      <SkeletonPlate lines={2} />
      <SkeletonPlate lines={3} />
    </div>
  );
}
