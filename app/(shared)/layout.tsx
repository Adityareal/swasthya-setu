'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { AppShell } from '@/components/shell/app-shell';

/**
 * The shared worker route group — `/stock` and `/dashboard`.
 *
 * Both screens are read by an ASHA_User AND a Doctor_User, so they live in one
 * route group instead of being duplicated per role. Two copies of a screen is
 * two places a fix has to land, and the second one is the copy that gets
 * forgotten.
 *
 * The guard admits either worker role and sends a Patient_User — or a visitor
 * with no role chosen at all — back to `/`. It is the same CORRECTNESS boundary
 * `<AppShell>` draws for the single-role groups and it proves nothing about
 * identity: there is no server here that could deny a read.
 *
 * `<AppShell>` is then handed the role that is actually acting, so the
 * navigation an ASHA sees on `/stock` is the ASHA navigation and the doctor's is
 * the doctor's.
 */

function isWorker(role: Role | null): role is Extract<Role, 'asha' | 'doctor'> {
  return role === 'asha' || role === 'doctor';
}

export default function SharedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useT();
  const activeRole = useAppStore((s) => s.activeRole);

  /* Zustand's persist middleware rehydrates asynchronously, so the guard waits
     for it or it bounces every direct navigation back to `/`. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isWorker(activeRole)) router.replace('/');
  }, [hydrated, activeRole, router]);

  if (!hydrated || !isWorker(activeRole)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-screen-md items-center justify-center p-4">
        <p className="text-caption font-semibold text-ink-muted">
          {t('state.loading')}
        </p>
      </main>
    );
  }

  return <AppShell role={activeRole}>{children}</AppShell>;
}
