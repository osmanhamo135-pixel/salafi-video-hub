import React, { useRef, useEffect } from 'react';
import { ArrowLeft, Library as LibraryIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlayerHeader } from '@/components/player/PlayerHeader';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { ProgressBar } from '@/components/player/ProgressBar';
import { PlayerControls } from '@/components/player/PlayerControls';
import { QueuePanel } from '@/components/player/QueuePanel';
import { usePlayerStore } from '@/store/playerStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useI18n } from '@/i18n';

export const PlayerPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const isPlayerOpen = usePlayerStore((state) => state.isPlayerOpen);
  const currentVideoId = usePlayerStore((state) => state.currentVideoId);
  const videos = usePlayerStore((state) => state.videos);
  const leavePlayerView = usePlayerStore((state) => state.leavePlayerView);
  const closePlayer = usePlayerStore((state) => state.closePlayer);
  const hasCurrentVideo = currentVideoId ? videos.has(currentVideoId) : false;

  // Keyboard shortcuts
  useKeyboardShortcuts();

  // Fullscreen handling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isFullscreen) {
      container.requestFullscreen?.().catch(console.error);
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(console.error);
    }
  }, [isFullscreen]);

  // Handle fullscreen change events (e.g. user pressing Esc while in fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const { isFullscreen: storeFullscreen } = usePlayerStore.getState();
      if (!document.fullscreenElement && storeFullscreen) {
        usePlayerStore.getState().toggleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      leavePlayerView();
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(console.error);
      }
      if (usePlayerStore.getState().isFullscreen) {
        usePlayerStore.getState().toggleFullscreen();
      }
    };
  }, [leavePlayerView]);

  const handleBackToLibrary = () => {
    leavePlayerView();
    navigate('/library');
  };

  const handleOpenLibrary = () => {
    closePlayer();
    navigate('/library');
  };

  if (!isPlayerOpen || !hasCurrentVideo) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6 text-muted-text">
        <div className="premium-surface ornate-corner relative flex w-full max-w-md flex-col items-center gap-4 rounded-lg p-8 text-center">
          <div className="icon-medallion h-16 w-16">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8 text-primary-blue/55">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{t('noVideoSelected')}</p>
            <p className="mt-1 text-xs text-muted-text">{t('noVideoSelectedHint')}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={handleBackToLibrary}
              className="btn-secondary px-3 py-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('backToLibrary')}
            </button>
            <button
              type="button"
              onClick={handleOpenLibrary}
              className="btn-primary px-3 py-2"
            >
              <LibraryIcon className="h-4 w-4" />
              {t('openLibrary')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-1 flex-col overflow-hidden bg-black"
    >
      {/* Header */}
      {!isFullscreen && <PlayerHeader />}

      {/* Body: Video + Queue */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Video + Controls */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Video area - 16:9 container */}
          <div className="flex min-h-0 flex-1 flex-col bg-black p-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <VideoPlayer />
            </div>
          </div>

          {/* Controls */}
          <div className="shrink-0">
            <ProgressBar />
            <PlayerControls />
          </div>
        </div>

        {/* Right: Queue panel */}
        {!isFullscreen && <QueuePanel />}
      </div>
    </div>
  );
};
