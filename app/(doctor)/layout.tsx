import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <AppShell role="doctor">{children}</AppShell>;
}
