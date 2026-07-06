import React, { useMemo } from 'react';
import { CalendarClock, Play, Clock, Film } from 'lucide-react';
import { Playlist } from '@/types';
import { formatDuration } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { PlaylistMenu } from './PlaylistMenu';
import { useI18n } from '@/i18n';

interface PlaylistCardProps {
  playlist: Playlist;
  variant?: 'grid' | 'list';
  onOpen: (playlist: Playlist) => void;
  onContinue: (playlist: Playlist) => void;
  onRescan: (id: string) => void;
  onRegenerateThumbnails: (id: string) => void;
  onRemove: (id: string) => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = React.memo(({
  playlist,
  variant = 'grid',
  onOpen,
  onContinue,
  onRescan,
  onRegenerateThumbnails,
  onRemove,
}) => {
  const { t } = useI18n();
  const progressPercent = useMemo(() => {
    if (!playlist.totalDurationSeconds || playlist.totalDurationSeconds <= 0) return 0;
    const pct = (playlist.progressSeconds / playlist.totalDurationSeconds) * 100;
    return Math.min(Math.max(pct, 0), 100);
  }, [playlist.progressSeconds, playlist.totalDurationSeconds]);

  const hasProgress = progressPercent > 0;
  const lastUpdated = playlist.updatedAt
    ? new Date(playlist.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : t('notWatched');

  if (variant === 'list') {
    return (
      <div className="premium-card premium-card-hover group relative flex items-center gap-3 overflow-hidden rounded-lg p-2">
        <button
          type="button"
          onClick={() => onOpen(playlist)}
          className="relative h-[86px] w-[150px] shrink-0 overflow-hidden rounded-md bg-elevated-panel"
        >
          <LocalThumbnail
            path={playlist.thumbnailPath}
            label={playlist.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            iconClassName="h-7 w-7 text-muted-text/45"
            fallbackClassName="thumbnail-fallback"
          />
          {hasProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/55">
              <div className="h-full bg-primary-blue" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpen(playlist)}
          className="min-w-0 flex-1 text-start"
        >
          <h3 className="truncate text-sm font-semibold text-text-primary" title={playlist.name}>
            {playlist.name}
          </h3>
          <p className="mt-1 truncate text-xs text-muted-text" title={playlist.folderPath}>
            {playlist.folderPath}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-text">
            <span className="flex items-center gap-1">
              <Film className="h-3.5 w-3.5" />
              {playlist.videoCount} {t('videosLower')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(playlist.totalDurationSeconds)}
            </span>
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {lastUpdated}
            </span>
            {hasProgress && <span className="text-primary-blue">{Math.round(progressPercent)}% {t('watched')}</span>}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2 pe-1">
          <button
            onClick={() => onContinue(playlist)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-blue px-3 text-xs font-semibold text-[#03110f] transition-colors hover:bg-primary-blue-hover"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {t('continue')}
          </button>
          <button
            onClick={() => onOpen(playlist)}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-panel-hover"
          >
            {t('details')}
          </button>
          <PlaylistMenu
            playlistId={playlist.id}
            playlistName={playlist.name}
            onOpen={() => onOpen(playlist)}
            onRescan={() => onRescan(playlist.id)}
            onRegenerateThumbnails={() => onRegenerateThumbnails(playlist.id)}
            onRemove={() => onRemove(playlist.id)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card premium-card-hover ornate-corner group relative flex flex-col overflow-hidden rounded-lg">
      {/* Thumbnail area - 16:9 aspect ratio */}
      <div className="relative aspect-video w-full overflow-hidden bg-elevated-panel">
        <LocalThumbnail
          path={playlist.thumbnailPath}
          label={playlist.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          iconClassName="w-8 h-8 text-muted-text/45"
          fallbackClassName="thumbnail-fallback"
        />

        {/* Hover overlay with open button */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <button
            onClick={() => onContinue(playlist)}
            className="btn-primary px-4 py-2"
          >
            <Play className="w-4 h-4 fill-current" />
            {t('continue')}
          </button>
        </div>

        {/* Video count badge */}
        <div className="media-badge absolute bottom-2 right-2 flex items-center gap-1 px-2">
          <Film className="w-3 h-3" />
          {playlist.videoCount}
        </div>
      </div>

      {/* Card content */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        {/* Title */}
        <h3
          className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 min-h-[2.5rem]"
          title={playlist.name}
        >
          {playlist.name}
        </h3>

        {/* Folder path */}
        <p
          className="truncate text-xs text-muted-text"
          title={playlist.folderPath}
        >
          {playlist.folderPath}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-text mt-auto pt-1">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDuration(playlist.totalDurationSeconds)}
          </span>
          <span className="flex items-center gap-1 min-w-0" title={`${t('lastUpdated')} ${lastUpdated}`}>
            <CalendarClock className="w-3 h-3 shrink-0" />
            <span className="truncate">{lastUpdated}</span>
          </span>
          {hasProgress && (
            <span className="col-span-2 text-primary-blue">
              {Math.round(progressPercent)}% {t('watched')}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {hasProgress && (
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary-blue transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between pt-1.5 mt-auto">
          <button
            onClick={() => onContinue(playlist)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary-blue px-3 py-1.5 text-xs font-semibold text-[#03110f] transition-colors hover:bg-primary-blue-hover"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {t('continue')}
          </button>
          <button
            onClick={() => onOpen(playlist)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-border-strong hover:bg-panel-hover"
          >
            {t('details')}
          </button>
          <PlaylistMenu
            playlistId={playlist.id}
            playlistName={playlist.name}
            onOpen={() => onOpen(playlist)}
            onRescan={() => onRescan(playlist.id)}
            onRegenerateThumbnails={() => onRegenerateThumbnails(playlist.id)}
            onRemove={() => onRemove(playlist.id)}
          />
        </div>
      </div>
    </div>
  );
});

PlaylistCard.displayName = 'PlaylistCard';
