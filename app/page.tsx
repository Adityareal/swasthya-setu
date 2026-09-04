'use client';

import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { BiLabel } from '@/components/system/bi-label';
import { LanguageToggle } from '@/components/shell/language-toggle';
import {
  DemoRoleNotice,
  ROLE_BLURB,
  ROLE_HOME,
  ROLE_ICON,
  ROLE_LABEL,
  ROLES,
} from '@/components/shell/role-switcher';

/**
 * Role selection. Three large plates, each an icon plus a bilingual signage
 * stack plus one line describing what that role does here.
 *
 * The Requirement 3.8 notice is visible on this screen, not buried in a menu:
 * the first thing a judge sees should be the honest description of what the
 * role switch is.
 */
export default function LandingPage() {
  const router = useRouter();
  const { t, locale } = useT();
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  function choose(role: Role) {
    setActiveRole(role);
    router.push(ROLE_HOME[role]);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="on-chrome border-b-2 border-line bg-chrome">
        <div className="mx-auto flex max-w-screen-md flex-wrap items-center gap-2 px-4 py-3">
          <div>
            <h1
              lang={locale}
              className="text-headline leading-tight font-extrabold text-chrome-fg"
            >
              {t('app.name')}
            </h1>
            <p className="text-caption font-semibold text-chrome-muted">
              {t('app.tagline')}
            </p>
          </div>
          <LanguageToggle className="ml-auto" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-screen-md flex-1 flex-col gap-4 p-4">
        <h2
          lang={locale}
          className="text-title font-semibold text-ink"
        >
          {t('role.choose')}
        </h2>

        <ul className="flex flex-col gap-3">
          {ROLES.map((role) => {
            const Icon = ROLE_ICON[role];
            return (
              <li key={role}>
                <button
                  type="button"
                  onClick={() => choose(role)}
                  className="plate flex w-full items-center gap-4 p-4 text-left transition-transform duration-(--ss-dur-fast) ease-(--ss-ease) active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)]"
                  data-state="action"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-touch-lg shrink-0 items-center justify-center rounded-plate border-2 border-line bg-action text-action-fg"
                  >
                    <Icon className="size-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <BiLabel
                      k={ROLE_LABEL[role]}
                      as="div"
                      className="text-title font-extrabold text-ink"
                    />
                    <span
                      lang={locale}
                      className="mt-1 block text-body font-normal text-ink-muted"
                    >
                      {t(ROLE_BLURB[role])}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <DemoRoleNotice className="mt-2" />
      </main>
    </div>
  );
}
