import React from 'react';
import { ArrowLeft, X, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/store/playerStore';
import { useI18n } from '@/i18n';

export const PlayerHeader: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const closePlayer = usePlayerStore((state) => state.closePlayer);
  const leavePlayerView = usePlayerStore((state) => state.leavePlayerView);
  const playlist = usePlayerStore((state) => state.playlist);
  const currentVideoId = usePlayerStore((state) => state.currentVideoId);
  const videos = usePlayerStore((state) => state.videos);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const toggleFullscreen = usePlayerStore((state) => state.toggleFullscreen);
  const currentVideo = currentVideoId ? videos.get(currentVideoId) : undefined;

  const handleBackToLibrary = () => {
    leavePlayerView();
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(console.error);
    }
    if (isFullscreen) {
      toggleFullscreen();
    }
    navigate('/library');
  };

  const handleClosePlayer = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(console.error);
    }
    closePlayer();
    navigate('/library');
  };

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-[linear-gradient(180deg,var(--bg-panel),var(--bg-main))] px-5 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="icon-medallion h-9 w-9 shrink-0">
          <FolderOpen className="h-[18px] w-[18px] text-primary-blue" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary truncate">
            {playlist?.name || t('player')}
          </h2>
          {currentVideo && (
            <p className="text-xs text-muted-text truncate">
              {currentVideo.title}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleBackToLibrary}
          className="btn-ghost"
          title={t('backToLibrary')}
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToLibrary')}
        </button>
        <button
          onClick={handleClosePlayer}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-text transition-colors hover:bg-panel-hover hover:text-text-primary"
          title={t('close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
