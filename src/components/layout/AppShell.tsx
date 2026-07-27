import React from 'react';
import { Sidebar } from './Sidebar';
import { AmbientLayer } from './AmbientLayer';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    /* No `bg-background` here, and no `app-ground` on <main>, deliberately.
       Both were opaque fills set by a Tailwind utility at the call site, which
       lands in the utilities layer and therefore beats anything index.css can
       say about the same property — so an ambient layer behind them would have
       been invisible in all ten themes. The base colour comes from <body>; the
       shell and the main region are transparent so the layer reads through.

       AmbientLayer is mounted here rather than inside the router: navigation
       must not remount it. A background that restarts on every route change is
       the tell of a cheap implementation. */
    <div className="app-shell flex h-full w-full text-text-primary">
      <AmbientLayer />
      <Sidebar />
      <main className="relative z-[1] h-full min-h-0 flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
};
