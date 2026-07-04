import React from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="app-shell flex h-full w-full bg-background text-text-primary">
      <Sidebar />
      <main className="h-full min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(var(--accent-teal-rgb),0.08),transparent_30rem),linear-gradient(180deg,var(--bg-sidebar)_0%,var(--bg-main)_22rem)]">
        {children}
      </main>
    </div>
  );
};
