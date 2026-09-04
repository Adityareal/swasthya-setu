import {
  BarChart3,
  FileText,
  Home,
  MessageSquarePlus,
  Package,
  QrCode,
  Share2,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Role } from '@/lib/types';
import type { MessageKey } from '@/lib/i18n';

export interface NavDestination {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
}

/**
 * Per-role destinations, icon-first, 56px targets.
 *
 * The patient workspace runs at four destinations MAXIMUM — home, record,
 * intake, and language — because a worker uses this tool twenty times a day and
 * a patient uses it twice a year. Language is the fourth and it lives in the
 * chrome as a toggle rather than as a route: it is a one-tap switch, not a
 * screen, and giving it a page would cost a navigation for a binary choice.
 *
 * The worker roles carry more, and they carry it in a deliberate order: the
 * things done every visit first, the things consulted occasionally last. `/stock`
 * and `/dashboard` are shared by both worker roles rather than duplicated per
 * role, because they are the same screen reading the same rows — a second copy
 * would be a second URL for one view.
 *
 * Labels reuse the `stock.*`, `dashboard.*` and `qr.*` namespaces rather than
 * minting `nav.*` twins. A destination whose label disagrees with the heading of
 * the screen it opens is a small lie, and two keys is how that starts.
 */
export const NAV: Record<Role, NavDestination[]> = {
  patient: [
    { href: '/patient', labelKey: 'nav.home', icon: Home },
    { href: '/patient/record', labelKey: 'nav.record', icon: FileText },
    { href: '/patient/intake', labelKey: 'nav.intake', icon: MessageSquarePlus },
  ],
  asha: [
    { href: '/asha', labelKey: 'nav.home', icon: Home },
    { href: '/asha/intake', labelKey: 'nav.intake', icon: MessageSquarePlus },
    { href: '/asha/register', labelKey: 'nav.register', icon: UserPlus },
    { href: '/asha/scan', labelKey: 'qr.scan', icon: QrCode },
    { href: '/stock', labelKey: 'stock.title', icon: Package },
    { href: '/dashboard', labelKey: 'dashboard.title', icon: BarChart3 },
  ],
  doctor: [
    /* `/doctor` IS the patient list; a separate patient-index route would be
       the same screen at a second URL. The detail screen, `/doctor/patient/`,
       is reached by pressing a row and is not a nav destination — it needs an
       `?id=` to mean anything. */
    { href: '/doctor', labelKey: 'nav.patients', icon: Home },
    { href: '/doctor/referrals', labelKey: 'nav.referrals', icon: Share2 },
    { href: '/stock', labelKey: 'stock.title', icon: Package },
    { href: '/dashboard', labelKey: 'dashboard.title', icon: BarChart3 },
  ],
};
