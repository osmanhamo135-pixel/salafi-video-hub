import React, { useMemo } from 'react';
import { Playlist, Video } from '@/types';
import { Clock, Play, SearchX } from 'lucide-react';
import { formatTime } from '@/utils/formatTime';
import { formatBytes } from '@/utils/formatBytes';
import { PlaylistPoster, ProgressMeter, playlistProgress, useCategoryLabel } from './PlaylistCard';
import { SectionRule } from './PlaylistGrid';
import { useI18n } from '@/i18n';

interface SearchResultsProps {
  query: string;
  results: { videos: Video[]; playlists: Playlist[] };
  onOpenPlaylist: (playlist: Playlist) => void;
  onOpenVideo: (video: Video) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  onOpenPlaylist,
  onOpenVideo,
}) => {
  const { t } = useI18n();
  const hasPlaylists = results.playlists.length > 0;
  const hasVideos = results.videos.length > 0;
  const hasAnyResults = hasPlaylists || hasVideos;

  if (!hasAnyResults) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-border bg-panel/40 px-6 py-16 text-center">
        <SearchX className="h-7 w-7 text-text-faint" />
        <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em] text-text-primary">{t('noResultsFound')}</h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-text">{t('noSearchResults')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-9">
      {hasPlaylists && (
        <section>
          <SectionRule label={t('playlists')} count={results.playlists.length} className="mb-1" />
          <div className="rule-list">
            {results.playlists.map((playlist) => (
              <PlaylistSearchRow key={playlist.id} playlist={playlist} onOpen={onOpenPlaylist} />
            ))}
          </div>
        </section>
      )}

      {hasVideos && (
        <section>
          <SectionRule label={t('videosLower')} count={results.videos.length} className="mb-1" />
          <div className="rule-list">
            {results.videos.map((video) => (
              <VideoSearchRow key={video.id} video={video} onOpen={onOpenVideo} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// --- Sub-components ---

const PlaylistSearchRow: React.FC<{
  playlist: Playlist;
  onOpen: (playlist: Playlist) => void;
}> = ({ playlist, onOpen }) => {
  const { t } = useI18n();
  const categoryLabel = useCategoryLabel(playlist.category);
  const progressPercent = useMemo(() => playlistProgress(playlist), [playlist]);
  const isComplete = progressPercent >= 95;

  return (
    <button type="button" onClick={() => onOpen(playlist)} className="rule-row w-full text-start">
      <div className="relative h-[58px] w-[104px] shrink-0 overflow-hidden rounded-md bg-background">
        <PlaylistPoster path={playlist.thumbnailPath} name={playlist.name} seed={playlist.id} dense />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-text-primary" title={playlist.name}>
          <bdi>{playlist.name}</bdi>
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs">
          {categoryLabel && (
            <>
              <span className="shrink-0 text-accent-gold/90"><bdi>{categoryLabel}</bdi></span>
              <span className="shrink-0 text-text-faint">&middot;</span>
            </>
          )}
          <span className="truncate text-text-faint" title={playlist.folderPath}>
            <bdi>{playlist.folderPath}</bdi>
          </span>
        </div>
      </div>

      <div className="hidden w-36 shrink-0 flex-col gap-1.5 sm:flex">
        <ProgressMeter percent={progressPercent} done={isComplete} />
        <span className="text-[11px] tabular-nums text-muted-text">
          <bdi>{playlist.videoCount}</bdi> {t('videosLower')}
        </span>
      </div>
    </button>
  );
};

const VideoSearchRow: React.FC<{
  video: Video;
  onOpen: (video: Video) => void;
}> = ({ video, onOpen }) => {
  const progressPercent = useMemo(() => {
    if (!video.durationSeconds || video.durationSeconds <= 0) return 0;
    const pct = (video.progressSeconds / video.durationSeconds) * 100;
    return Math.min(Math.max(pct, 0), 100);
  }, [video.progressSeconds, video.durationSeconds]);

  return (
    <button type="button" onClick={() => onOpen(video)} className="rule-row group w-full text-start">
      <div className="relative h-[58px] w-[104px] shrink-0 overflow-hidden rounded-md bg-background">
        <PlaylistPoster path={video.thumbnailPath} name={video.title} seed={video.id} dense />

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/65 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5 fill-current text-text-primary" />
        </span>

        {video.completed && <span className="absolute inset-x-0 bottom-0 block h-[3px] bg-success-green" />}
        {!video.completed && progressPercent > 0 && (
          <span className="absolute inset-x-0 bottom-0 block h-[3px] bg-background/70">
            <span className="block h-full bg-accent-gold" style={{ width: `${progressPercent}%` }} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h4 className="truncate text-[15px] font-medium leading-snug text-text-primary" title={video.title}>
          <bdi>{video.title}</bdi>
        </h4>
        <div className="flex items-center gap-3 text-xs text-muted-text">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <bdi>{formatTime(video.durationSeconds)}</bdi>
          </span>
          {video.fileSize > 0 && <span className="text-text-faint"><bdi>{formatBytes(video.fileSize)}</bdi></span>}
          {video.speaker && (
            <span className="truncate text-text-faint" title={video.speaker}>
              <bdi>{video.speaker}</bdi>
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
