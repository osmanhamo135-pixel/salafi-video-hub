import React, { useMemo } from 'react';
import { Play } from 'lucide-react';
import { Playlist } from '@/types';
import { formatDuration } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { PlaylistMenu } from './PlaylistMenu';
import { useI18n } from '@/i18n';

/* .thumbnail-fallback bakes in an .icon-medallion (primary-blue border + fill)
   and a teal underline, which puts a second accent in every un-thumbnailed row.
   Neutralise both from the call site; the primitive itself is not ours to edit. */
const QUIET_FALLBACK =
  'thumbnail-fallback after:hidden [&_.icon-medallion]:border-border [&_.icon-medallion]:bg-transparent [&_.icon-medallion]:shadow-none [&_.icon-medallion]:after:hidden';

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
  const { t, language } = useI18n();
  const progressPercent = useMemo(() => {
    if (!playlist.totalDurationSeconds || playlist.totalDurationSeconds <= 0) return 0;
    const pct = (playlist.progressSeconds / playlist.totalDurationSeconds) * 100;
    return Math.min(Math.max(pct, 0), 100);
  }, [playlist.progressSeconds, playlist.totalDurationSeconds]);

  const hasProgress = progressPercent > 0;
  const lastUpdated = playlist.updatedAt
    ? new Date(playlist.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : t('notWatched');

  /* Ruled row — the default. One click target, a quiet play affordance on the
     thumbnail, and the menu as an .icon-btn. No card, no border, no accent. */
  if (variant === 'list') {
    return (
      <div className="rule-row group">
        <button
          type="button"
          onClick={() => onContinue(playlist)}
          title={t('continue')}
          aria-label={t('continue')}
          className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded bg-background"
        >
          <LocalThumbnail
            path={playlist.thumbnailPath}
            label={playlist.name}
            className="h-full w-full object-cover"
            iconClassName="h-4 w-4 text-muted-text"
            fallbackClassName={QUIET_FALLBACK}
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 fill-current text-text-primary" />
          </span>
          {hasProgress && (
            <span className="absolute inset-x-0 bottom-0 block h-0.5 bg-background/70">
              <span className="block h-full bg-muted-text" style={{ width: `${progressPercent}%` }} />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpen(playlist)}
          className="min-w-0 flex-1 text-start"
        >
          <p className="truncate text-sm text-text-primary" title={playlist.name}>
            <bdi>{playlist.name}</bdi>
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-text">
            <span className="truncate" title={playlist.folderPath}>
              <bdi>{playlist.folderPath}</bdi>
            </span>
          </div>
        </button>

        <div className="hidden shrink-0 items-center gap-4 text-xs tabular-nums text-muted-text sm:flex">
          <span><bdi>{playlist.videoCount}</bdi> {t('videosLower')}</span>
          <span><bdi>{formatDuration(playlist.totalDurationSeconds, language)}</bdi></span>
          <span className="hidden lg:inline"><bdi>{lastUpdated}</bdi></span>
          <span className="w-14 text-end">
            {hasProgress ? <bdi>{Math.round(progressPercent)}%</bdi> : null}
          </span>
        </div>

        <PlaylistMenu
          playlistId={playlist.id}
          playlistName={playlist.name}
          onOpen={() => onOpen(playlist)}
          onRescan={() => onRescan(playlist.id)}
          onRegenerateThumbnails={() => onRegenerateThumbnails(playlist.id)}
          onRemove={() => onRemove(playlist.id)}
        />
      </div>
    );
  }

  /* Poster grid — kept for the grid toggle, but reduced to a hairline and a
     value step: no ornate corners, no filled buttons, no accent text. */
  return (
    <div className="premium-card premium-card-hover group relative flex flex-col overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={() => onContinue(playlist)}
        title={t('continue')}
        aria-label={t('continue')}
        className="relative aspect-video w-full overflow-hidden bg-elevated-panel"
      >
        <LocalThumbnail
          path={playlist.thumbnailPath}
          label={playlist.name}
          className="h-full w-full object-cover"
          iconClassName="h-8 w-8 text-muted-text/45"
          fallbackClassName={QUIET_FALLBACK}
        />

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-7 w-7 fill-current text-text-primary" />
        </span>

        {hasProgress && (
          <span className="absolute inset-x-0 bottom-0 block h-0.5 bg-background/70">
            <span className="block h-full bg-muted-text" style={{ width: `${progressPercent}%` }} />
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <button type="button" onClick={() => onOpen(playlist)} className="min-w-0 text-start">
          <h3
            className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-text-primary"
            title={playlist.name}
          >
            <bdi>{playlist.name}</bdi>
          </h3>
          <p className="truncate text-xs text-muted-text" title={playlist.folderPath}>
            <bdi>{playlist.folderPath}</bdi>
          </p>
        </button>

        <div className="mt-auto flex items-center gap-3 border-t border-border pt-2 text-xs tabular-nums text-muted-text">
          <span><bdi>{playlist.videoCount}</bdi></span>
          <span className="truncate"><bdi>{formatDuration(playlist.totalDurationSeconds, language)}</bdi></span>
          <span className="truncate"><bdi>{lastUpdated}</bdi></span>
          {hasProgress && <span className="ms-auto"><bdi>{Math.round(progressPercent)}%</bdi></span>}
          <div className={hasProgress ? '' : 'ms-auto'}>
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
    </div>
  );
});

PlaylistCard.displayName = 'PlaylistCard';
