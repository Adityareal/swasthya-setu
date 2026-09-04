'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, HeartPulse, Stethoscope, User } from 'lucide-react';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { useT, type MessageKey } from '@/lib/i18n';
import { BiLabel } from '@/components/system/bi-label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const ROLE_HOME: Record<Role, string> = {
  patient: '/patient',
  asha: '/asha',
  doctor: '/doctor',
};

export const ROLE_ICON = {
  patient: User,
  asha: HeartPulse,
  doctor: Stethoscope,
} as const;

export const ROLE_LABEL: Record<Role, MessageKey> = {
  patient: 'role.patient',
  asha: 'role.asha',
  doctor: 'role.doctor',
};

export const ROLE_BLURB: Record<Role, MessageKey> = {
  patient: 'role.patient.blurb',
  asha: 'role.asha.blurb',
  doctor: 'role.doctor.blurb',
};

export const ROLES: readonly Role[] = ['patient', 'asha', 'doctor'];

/**
 * Requirement 3.8 — the notice travels with the control. Rendered wherever a
 * role can be chosen, so it cannot be shown on the landing page and forgotten
 * in the app bar.
 */
export function DemoRoleNotice({ className }: { className?: string }) {
  const { t, locale } = useT();

  return (
    <p
      lang={locale}
      className={cn(
        'plate flex max-w-[70ch] items-start gap-2 p-3 text-caption font-semibold text-ink',
        className,
      )}
      data-state="medium"
    >
      <AlertTriangle aria-hidden="true" className="mt-px size-4 shrink-0 text-med-fg" />
      <span>{t('role.demoNotice')}</span>
    </p>
  );
}

/**
 * The role indicator in the chrome. It is a control, not a decoration: tapping
 * it opens the Role_Switcher, and it holds the Requirement 3.8 notice. This is
 * the only chrome element that changes between workspaces, deliberately — the
 * presenter needs the current role legible from the back of a room, and the
 * audience needs to see that the record did not change when the role did.
 */
export function RoleSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const activeRole = useAppStore((s) => s.activeRole);
  const setActiveRole = useAppStore((s) => s.setActiveRole);

  const ActiveIcon = activeRole ? ROLE_ICON[activeRole] : User;

  function choose(role: Role) {
    setActiveRole(role);
    setOpen(false);
    router.push(ROLE_HOME[role]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="chrome"
          className="min-h-touch border-chrome-muted bg-chrome-muted text-chrome"
          aria-label={t('role.switch')}
        >
          <ActiveIcon aria-hidden="true" />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-caption font-semibold uppercase opacity-80">
              {t('role.active')}
            </span>
            <span className="text-body font-extrabold">
              {activeRole ? t(ROLE_LABEL[activeRole]) : t('role.choose')}
            </span>
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-title font-extrabold">
            {t('role.switch.title')}
          </DialogTitle>
          <DialogDescription className="text-caption font-semibold text-ink-muted">
            {t('app.tagline')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {ROLES.map((role) => {
            const Icon = ROLE_ICON[role];
            return (
              <Button
                key={role}
                variant={activeRole === role ? 'default' : 'outline'}
                size="field"
                className="justify-start text-left"
                onClick={() => choose(role)}
              >
                <Icon aria-hidden="true" className="size-6" />
                <BiLabel k={ROLE_LABEL[role]} />
              </Button>
            );
          })}
        </div>

        <DemoRoleNotice />
      </DialogContent>
    </Dialog>
  );
}
