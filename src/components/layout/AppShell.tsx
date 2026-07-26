import React from 'react';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="app-shell flex h-full w-full bg-background text-text-primary">
      <Sidebar />
      <main className="app-ground h-full min-h-0 flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
};
