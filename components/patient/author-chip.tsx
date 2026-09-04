'use client';

import { HeartHandshake, Stethoscope, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { ROLE_LABEL_KEY } from './timeline-model';

/**
 * Req 4.4 — the Record_Author, on every entry, as an icon plus a translated
 * label. Three roles, three glyphs, so the thread's mixed authorship is legible
 * before a word is read: that mixture IS the product claim, and it deserves a
 * visual channel rather than a line of small print.
 *
 * Single line, active locale only. The Bilingual Signage Stack is scoped to
 * decision surfaces, and provenance metadata is not one — doubling it here
 * would cost three lines in a chip and return nothing.
 *
 * A patient never sees `authorId`, and never sees the enum member either: a
 * resolved name when the caller has one, the translated role otherwise.
 */

const ICON: Record<Role, LucideIcon> = {
  patient: UserRound,
  asha: HeartHandshake,
  doctor: Stethoscope,
};

export function AuthorChip({
  role,
  name,
  className,
}: {
  role: Role;
  /** The worker's display name, when the caller resolved one. */
  name?: string | null;
  className?: string;
}) {
  const { t, locale } = useT();
  const Icon = ICON[role];
  const roleLabel = t(ROLE_LABEL_KEY[role]);

  return (
    <p
      lang={locale}
      className={cn(
        'flex w-fit items-center gap-2 rounded-plate border-2 border-line bg-sunk px-2 py-1 text-caption font-semibold text-ink',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="sr-only">{t('timeline.author')}: </span>
      <span>{name ? `${name} · ${roleLabel}` : roleLabel}</span>
    </p>
  );
}
