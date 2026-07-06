import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Heart,
  Clock,
  CheckCircle2,
  Gauge,
  FastForward,
} from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import type { RepeatMode } from '@/types';
import { useI18n } from '@/i18n';

export const PlayerControls: React.FC = () => {
  const { t } = useI18n();
  const status = usePlayerStore((state) => state.status);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const setRepeatMode = usePlayerStore((state) => state.setRepeatMode);
  const autoplay = usePlayerStore((state) => state.autoplay);
  const toggleAutoplay = usePlayerStore((state) => state.toggleAutoplay);
  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const setPlaybackRate = usePlayerStore((state) => state.setPlaybackRate);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const toggleMute = usePlayerStore((state) => state.toggleMute);
  const isFullscreen = usePlayerStore((state) => state.isFullscreen);
  const toggleFullscreen = usePlayerStore((state) => state.toggleFullscreen);
  const toggleFavorite = usePlayerStore((state) => state.toggleFavorite);
  const toggleWatchLater = usePlayerStore((state) => state.toggleWatchLater);
  const markCompleted = usePlayerStore((state) => state.markCompleted);
  const currentVideoId = usePlayerStore((state) => state.currentVideoId);
  const videos = usePlayerStore((state) => state.videos);

  const currentVideo = currentVideoId ? videos.get(currentVideoId) : undefined;
  const isPlaying = status === 'playing';

  const repeatIcons: Record<RepeatMode, React.ReactNode> = {
    none: <Repeat className="w-5 h-5" />,
    one: <Repeat1 className="w-5 h-5 text-primary-blue" />,
    playlist: <RepeatPlaylistIcon />,
  };

  const repeatLabels: Record<RepeatMode, string> = {
    none: t('repeatOff'),
    one: t('repeatOne'),
    playlist: t('repeatPlaylist'),
  };

  const cycleRepeat = () => {
    const modes: RepeatMode[] = ['none', 'one', 'playlist'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  };

  const cyclePlaybackRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
    const currentIndex = rates.indexOf(playbackRate);
    setPlaybackRate(rates[(currentIndex + 1) % rates.length]);
  };

  return (
    <div className="flex shrink-0 flex-col gap-1 border-t border-border bg-[linear-gradient(180deg,var(--bg-panel),var(--bg-main))]">
      {/* Main control row */}
      <div className="flex items-center justify-between px-5 py-3">
        {/* Left: Action buttons */}
        <div className="flex items-center gap-1.5">
          <ControlButton
            onClick={toggleFavorite}
            title={t('toggleFavorite')}
            active={currentVideo?.favorite}
          >
            <Heart className={`w-5 h-5 ${currentVideo?.favorite ? 'fill-current text-danger-red' : ''}`} />
          </ControlButton>
          <ControlButton
            onClick={toggleWatchLater}
            title={t('markWatchLater')}
            active={currentVideo?.watchLater}
          >
            <Clock className={`w-5 h-5 ${currentVideo?.watchLater ? 'fill-current text-warning-orange' : ''}`} />
          </ControlButton>
          <ControlButton
            onClick={markCompleted}
            title={t('markAsCompleted')}
            active={currentVideo?.completed}
          >
            <CheckCircle2 className={`w-5 h-5 ${currentVideo?.completed ? 'text-success-green' : ''}`} />
          </ControlButton>
        </div>

        {/* Center: Playback controls */}
        <div className="flex items-center gap-3">
          <PlaybackButton
            onClick={previous}
            title={`${t('previous')} (P)`}
          >
            <SkipBack className="w-6 h-6" />
          </PlaybackButton>

          <button
            onClick={togglePlay}
            disabled={status === 'loadingMetadata' || status === 'resolvingPath'}
            title={`${isPlaying ? t('pause') : t('play')} (Space)`}
            className="
              flex items-center justify-center w-14 h-14 rounded-full
              bg-primary-blue text-[#03110f]
              hover:bg-primary-blue-hover active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150
              shadow-lg shadow-primary-blue/20
            "
          >
            {isPlaying ? (
              <Pause className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 ms-0.5" />
            )}
          </button>

          <PlaybackButton
            onClick={next}
            title={`${t('next')} (N)`}
          >
            <SkipForward className="w-6 h-6" />
          </PlaybackButton>
        </div>

        {/* Right: Volume + fullscreen + extras */}
        <div className="flex items-center gap-1.5">
          {/* Volume */}
          <div className="flex items-center gap-1.5 group">
            <ControlButton onClick={toggleMute} title={`${isMuted ? t('unmute') : t('mute')} (M)`}>
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </ControlButton>
            <div className="w-0 group-hover:w-24 overflow-hidden transition-all duration-200">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 h-1.5 accent-primary-blue"
              />
            </div>
          </div>

          {/* Repeat */}
          <button
            onClick={cyclePlaybackRate}
            title={`${t('playbackSpeed')}: ${playbackRate}x`}
            className="
              flex h-9 items-center justify-center gap-1 rounded-md border border-transparent
              px-2.5 text-xs font-semibold text-muted-text transition-all duration-150
              hover:bg-panel-hover hover:text-text-primary
            "
          >
            <FastForward className="h-4 w-4" />
            <span className="tabular-nums">{playbackRate}x</span>
          </button>

          <ControlButton
            onClick={cycleRepeat}
            title={`${repeatLabels[repeatMode]} (R)`}
            active={repeatMode !== 'none'}
          >
            {repeatIcons[repeatMode]}
          </ControlButton>

          {/* Autoplay */}
          <ControlButton
            onClick={toggleAutoplay}
            title={`${t('autoplay')}: ${autoplay ? t('on') : t('off')}`}
            active={autoplay}
          >
            <Gauge className="w-5 h-5" />
          </ControlButton>

          {/* Fullscreen */}
          <ControlButton
            onClick={toggleFullscreen}
            title={`${isFullscreen ? t('exitFullscreen') : t('fullscreen')} (F)`}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </ControlButton>
        </div>
      </div>
    </div>
  );
};

/* Sub-components */

const PlaybackButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="
      flex items-center justify-center w-10 h-10 rounded-full
      text-text-primary hover:bg-panel-hover hover:text-primary-blue
      active:scale-90 transition-all duration-150
    "
  >
    {children}
  </button>
);

const ControlButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}> = ({ onClick, title, children, active }) => (
  <button
    onClick={onClick}
    title={title}
    className={`
      flex items-center justify-center w-9 h-9 rounded-md border
      transition-all duration-150
      ${active
        ? 'text-primary-blue bg-primary-blue/15 hover:bg-primary-blue/20 border-primary-blue/20'
        : 'border-transparent text-muted-text hover:text-text-primary hover:bg-panel-hover'
      }
    `}
  >
    {children}
  </button>
);

const RepeatPlaylistIcon: React.FC = () => (
  <div className="relative">
    <Repeat className="w-5 h-5 text-primary-blue" />
    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary-blue" />
  </div>
);
