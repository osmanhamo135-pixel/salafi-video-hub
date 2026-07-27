import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';
import { useI18n } from '@/i18n';

const appWindow = getCurrentWindow();

/**
 * Custom themed title bar (the native one is disabled) so the window chrome
 * matches the app theme instead of showing the OS gray bar. The bar is a drag
 * region; double-click toggles maximize (built into Tauri drag regions).
 */
export const TitleBar: React.FC = () => {
  const { t } = useI18n();

  return (
    <header
      data-tauri-drag-region
      /* relative z-20 is load-bearing, not decoration. AmbientLayer is
         position:fixed with z-index:0, which puts it in the positioned-element
         paint layer — above every non-positioned sibling, including this one.
         Without a stacking position here the ambient wash paints straight over
         minimise/maximise/close and the window becomes unclosable. */
      className="relative z-20 flex h-9 w-full shrink-0 select-none items-center justify-between border-b border-border bg-sidebar"
    >
      {/* The sidebar carries the brand; the title bar stays a clean drag strip
          so the app name never appears twice. */}
      <div data-tauri-drag-region className="h-full min-w-0 flex-1" />

      <div className="flex h-full shrink-0">
        <button
          type="button"
          onClick={() => void appWindow.minimize()}
          aria-label={t('windowMinimize')}
          title={t('windowMinimize')}
          className="flex h-full w-11 items-center justify-center text-muted-text transition-colors hover:bg-panel-hover hover:text-text-primary"
          tabIndex={-1}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void appWindow.toggleMaximize()}
          aria-label={t('windowMaximize')}
          title={t('windowMaximize')}
          className="flex h-full w-11 items-center justify-center text-muted-text transition-colors hover:bg-panel-hover hover:text-text-primary"
          tabIndex={-1}
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => void appWindow.close()}
          aria-label={t('windowClose')}
          title={t('windowClose')}
          className="flex h-full w-11 items-center justify-center text-muted-text transition-colors hover:bg-danger-red hover:text-background"
          tabIndex={-1}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};
