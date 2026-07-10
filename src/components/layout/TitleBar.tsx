import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import appIcon from '@/assets/app-icon.png';
import { APP_NAME, APP_STAGE } from '@/utils/constants';

const appWindow = getCurrentWindow();

/**
 * Custom themed title bar (the native one is disabled) so the window chrome
 * matches the app theme instead of showing the OS gray bar. The bar is a drag
 * region; double-click toggles maximize (built into Tauri drag regions).
 */
export const TitleBar: React.FC = () => {
  return (
    <header
      data-tauri-drag-region
      className="flex h-9 w-full shrink-0 select-none items-center justify-between border-b border-border bg-sidebar"
    >
      <div data-tauri-drag-region className="flex min-w-0 items-center gap-2 px-3">
        <img src={appIcon} alt="" className="pointer-events-none h-5 w-5 rounded-full" draggable={false} />
        <span className="pointer-events-none truncate text-xs font-semibold text-text-primary">{APP_NAME}</span>
        <span className="pointer-events-none rounded border border-accent-gold/25 bg-accent-gold/10 px-1 py-px text-[8px] font-semibold leading-none text-accent-gold">
          {APP_STAGE}
        </span>
      </div>

      <div className="flex h-full shrink-0">
        <button
          type="button"
          onClick={() => void appWindow.minimize()}
          className="flex h-full w-11 items-center justify-center text-muted-text transition-colors hover:bg-panel-hover hover:text-text-primary"
          tabIndex={-1}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void appWindow.toggleMaximize()}
          className="flex h-full w-11 items-center justify-center text-muted-text transition-colors hover:bg-panel-hover hover:text-text-primary"
          tabIndex={-1}
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => void appWindow.close()}
          className="flex h-full w-11 items-center justify-center text-muted-text transition-colors hover:bg-danger-red hover:text-white"
          tabIndex={-1}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
