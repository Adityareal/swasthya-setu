'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MoreHorizontal, RotateCcw } from 'lucide-react';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { repo } from '@/lib/data/memory-repo';
import { BiLabel } from '@/components/system/bi-label';
import { PendingBadge } from '@/components/offline/pending-badge';
import { useReplayTriggers } from '@/lib/offline/use-queue';
import { ConnectivityBanner } from './connectivity-banner';
import { LanguageToggle } from './language-toggle';
import { NAV } from './nav';
import { RoleSwitcher } from './role-switcher';

/**
 * App_Shell.
 *
 * 360px is the design width, not a breakpoint to check later: single column,
 * full-bleed plates with 16px gutters, no horizontal scroll anywhere. Bottom
 * navigation on mobile at 56px targets, promoting to a left rail above 768px.
 */

/**
 * How many destinations the bottom bar shows before the rest go behind More.
 *
 * Three, plus the More slot, is four cells across 360px — 90px each, which fits a
 * 24px icon over a 13px caption without truncating and keeps every cell past the
 * 44px floor. The worker roles carry six destinations now that `/stock`,
 * `/dashboard` and `/asha/scan` exist; six cells would be 60px each and the
 * captions would wrap to three lines. The left rail above 768px has the room, so
 * it shows everything and never uses the overflow.
 */
const BOTTOM_NAV_SLOTS = 3;

export function AppShell({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useT();
  const activeRole = useAppStore((s) => s.activeRole);
  const setFacilities = useAppStore((s) => s.setFacilities);
  const clearSession = useAppStore((s) => s.clearSession);

  /* The Offline_Queue's replay triggers — `online`, `visibilitychange`, and the
     banner's Retry — attached ONCE for the whole workspace. Not a polling
     interval: the interesting moment is the moment connectivity returns, and that
     moment already has an event. */
  useReplayTriggers();

  /* Zustand's persist middleware rehydrates asynchronously, so the guard has to
     wait for it or it would bounce every direct navigation back to `/`. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  const [moreOpen, setMoreOpen] = useState(false);
  /* A navigation answers the question the sheet was asking, so it closes. */
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  /* Client-side role guard. Landing on a workspace without the matching
     activeRole redirects to `/`. This is a CORRECTNESS boundary, not a security
     boundary — there is no server here that can deny a read, and the honest
     description is that the guard proves nothing about identity. */
  useEffect(() => {
    if (!hydrated) return;
    if (activeRole !== role) router.replace('/');
  }, [hydrated, activeRole, role, router]);

  /* Cache the facility list for local routing. Read once on mount so the offline
     intake path has it: `selectFacility` is pure, so a cached list is all the
     Routing_Engine needs to keep working with the network gone. */
  useEffect(() => {
    void repo.listFacilities().then(setFacilities);
  }, [setFacilities]);

  async function resetDemo() {
    await repo.reset();
    clearSession();
    router.replace('/');
  }

  if (!hydrated || activeRole !== role) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-screen-md items-center justify-center p-4">
        <p className="text-caption font-semibold text-ink-muted">
          {t('state.loading')}
        </p>
      </main>
    );
  }

  const destinations = NAV[role];
  const primary = destinations.slice(0, BOTTOM_NAV_SLOTS);
  const overflow = destinations.slice(BOTTOM_NAV_SLOTS);
  const isPatient = role === 'patient';

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ——— App bar. Petrol-green enamel chrome. ——— */}
      <header className="on-chrome sticky top-0 z-40 border-b-2 border-line bg-chrome">
        <div className="mx-auto flex max-w-screen-lg flex-wrap items-center gap-2 px-4 py-2">
          <Link
            href={`/${role}`}
            className="min-h-touch flex items-center text-chrome-fg"
          >
            <span
              lang={locale}
              className="text-title leading-tight font-extrabold"
            >
              {t('app.name')}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {/* Pending_Badge (Req 19.3). Renders nothing when the queue is empty,
                so the chrome stays quiet in the ordinary case. */}
            <PendingBadge />
            <LanguageToggle />
            <RoleSwitcher />
          </div>
        </div>
      </header>

      <ConnectivityBanner />

      <div className="mx-auto flex w-full max-w-screen-lg flex-1 gap-4 px-4 md:px-6">
        {/* ——— Left rail above 768px. Shows every destination. ——— */}
        <nav
          aria-label={t('nav.home')}
          className="hidden w-56 shrink-0 flex-col gap-2 py-4 md:flex"
        >
          {destinations.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-touch-lg items-center gap-3 rounded-plate border-2 border-line px-3',
                  active
                    ? 'bg-action text-action-fg shadow-plate'
                    : 'bg-surface text-ink',
                )}
              >
                <Icon aria-hidden="true" className="size-6 shrink-0" />
                <BiLabel
                  k={labelKey}
                  secondaryClassName={active ? 'text-action-fg/75' : undefined}
                />
              </Link>
            );
          })}

          <button
            type="button"
            onClick={resetDemo}
            className="mt-2 flex min-h-touch flex-col items-start gap-1 rounded-plate border-2 border-line bg-sunk px-3 py-2 text-left"
          >
            <span className="flex items-center gap-2 text-caption font-semibold text-ink">
              <RotateCcw aria-hidden="true" className="size-4" />
              {t('demo.reset')}
            </span>
            <span className="text-caption font-semibold text-ink-muted">
              {t('demo.reset.caption')}
            </span>
          </button>
        </nav>

        <main
          className={cn(
            'min-w-0 flex-1 py-4 pb-28 md:pb-6',
            /* The patient workspace runs larger and emptier: an 18px body floor
               and one plate per concept, always stacked. */
            isPatient ? 'flex flex-col gap-4 text-field' : 'flex flex-col gap-4',
          )}
        >
          {children}
        </main>
      </div>

      {/* ——— Bottom navigation on mobile. 56px targets, thumb-reachable. ——— */}
      <nav
        aria-label={t('nav.home')}
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-surface md:hidden"
      >
        {/* The More sheet sits directly above the bar it belongs to, rather than
            centring itself on the screen: it is an extension of the bar, and a
            centred dialog would read as a different kind of decision. */}
        {moreOpen && (
          <div className="absolute inset-x-0 bottom-full border-t-2 border-line bg-surface shadow-raised">
            <ul className="mx-auto flex max-w-screen-md flex-col">
              {overflow.map(({ href, labelKey, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href} className="border-b-2 border-line-soft">
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-touch-lg items-center gap-3 px-4',
                        active ? 'bg-action text-action-fg' : 'bg-surface text-ink',
                      )}
                    >
                      <Icon aria-hidden="true" className="size-6 shrink-0" />
                      <BiLabel
                        k={labelKey}
                        secondaryClassName={active ? 'text-action-fg/75' : undefined}
                      />
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={resetDemo}
                  className="flex min-h-touch-lg w-full items-center gap-3 bg-sunk px-4 text-left text-ink"
                >
                  <RotateCcw aria-hidden="true" className="size-6 shrink-0" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-field font-semibold">{t('demo.reset')}</span>
                    <span className="text-caption font-semibold text-ink-muted">
                      {t('demo.reset.caption')}
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </div>
        )}

        <ul className="mx-auto flex max-w-screen-md items-stretch">
          {primary.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-touch-lg flex-col items-center justify-center gap-0.5 px-1 py-1.5',
                    active ? 'bg-action text-action-fg' : 'bg-surface text-ink',
                  )}
                >
                  <Icon aria-hidden="true" className="size-6 shrink-0" />
                  <span
                    lang={locale}
                    className="text-caption leading-none font-semibold"
                  >
                    {t(labelKey)}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-label={t('nav.more')}
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                'flex min-h-touch-lg w-full flex-col items-center justify-center gap-0.5 px-1 py-1.5',
                moreOpen ? 'bg-action text-action-fg' : 'bg-sunk text-ink',
              )}
            >
              <MoreHorizontal aria-hidden="true" className="size-6 shrink-0" />
              <span lang={locale} className="text-caption leading-none font-semibold">
                {t('nav.more')}
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
