import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <AppShell role="patient">{children}</AppShell>;
}
