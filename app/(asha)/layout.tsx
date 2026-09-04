import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

export default function AshaLayout({ children }: { children: ReactNode }) {
  return <AppShell role="asha">{children}</AppShell>;
}
