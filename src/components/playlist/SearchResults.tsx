import React, { useMemo } from 'react';
import { Playlist, Video } from '@/types';
import { Clock, Play, SearchX } from 'lucide-react';
import { formatTime } from '@/utils/formatTime';
import { formatBytes } from '@/utils/formatBytes';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <SearchX className="mb-4 h-8 w-8 text-muted-text" />
        <h3 className="text-base font-semibold text-text-primary mb-1">{t('noResultsFound')}</h3>
        <p className="text-sm text-muted-text max-w-sm">
          {t('noSearchResults')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Playlists section */}
      {hasPlaylists && (
        <section>
          <div className="rule-head mb-1">
            <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wider">
              {t('playlists')}
            </h2>
            <span className="text-xs tabular-nums text-muted-text">
              <bdi>{results.playlists.length}</bdi>
            </span>
          </div>
          <div className="rule-list">
            {results.playlists.map((playlist) => (
              <PlaylistSearchCard
                key={playlist.id}
                playlist={playlist}
                onOpen={onOpenPlaylist}
              />
            ))}
          </div>
        </section>
      )}

      {/* Videos section */}
      {hasVideos && (
        <section>
          <div className="rule-head mb-1">
            <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wider">
              {t('videosLower')}
            </h2>
            <span className="text-xs tabular-nums text-muted-text">
              <bdi>{results.videos.length}</bdi>
            </span>
          </div>
          <div className="rule-list">
            {results.videos.map((video) => (
              <VideoSearchCard
                key={video.id}
                video={video}
                onOpen={onOpenVideo}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// --- Sub-components ---

const PlaylistSearchCard: React.FC<{
  playlist: Playlist;
  onOpen: (playlist: Playlist) => void;
}> = ({ playlist, onOpen }) => {
  return (
    <button
      type="button"
      onClick={() => onOpen(playlist)}
      className="rule-row w-full text-start"
    >
      <div className="flex h-10 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-background">
        <LocalThumbnail
          path={playlist.thumbnailPath}
          label={playlist.name}
          className="w-full h-full object-cover"
          iconClassName="w-4 h-4 text-muted-text"
          fallbackClassName="thumbnail-fallback"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p dir="auto" className="text-sm text-text-primary truncate" title={playlist.name}>
          {playlist.name}
        </p>
        <p dir="auto" className="text-xs text-muted-text truncate" title={playlist.folderPath}>
          {playlist.folderPath}
        </p>
      </div>
    </button>
  );
};

const VideoSearchCard: React.FC<{
  video: Video;
  onOpen: (video: Video) => void;
}> = ({ video, onOpen }) => {
  const progressPercent = useMemo(() => {
    if (!video.durationSeconds || video.durationSeconds <= 0) return 0;
    const pct = (video.progressSeconds / video.durationSeconds) * 100;
    return Math.min(Math.max(pct, 0), 100);
  }, [video.progressSeconds, video.durationSeconds]);

  return (
    <button
      type="button"
      onClick={() => onOpen(video)}
      className="rule-row group w-full text-start"
    >
      {/* Thumbnail */}
      <div className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded bg-background">
        <LocalThumbnail
          path={video.thumbnailPath}
          label={video.title}
          className="w-full h-full object-cover"
          iconClassName="w-4 h-4 text-muted-text"
          fallbackClassName="thumbnail-fallback"
        />

        {/* Play overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="w-5 h-5 text-text-primary fill-current" />
        </div>

        {/* Watched progress bar */}
        {video.completed && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted-text" />
        )}
        {!video.completed && progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-background/70">
            <div
              className="h-full bg-muted-text"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h4
          dir="auto"
          className="text-sm text-text-primary leading-snug truncate"
          title={video.title}
        >
          {video.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-text">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <bdi>{formatTime(video.durationSeconds)}</bdi>
          </span>
          {video.fileSize > 0 && (
            <span><bdi>{formatBytes(video.fileSize)}</bdi></span>
          )}
          {video.speaker && (
            <span dir="auto" className="truncate" title={video.speaker}>
              {video.speaker}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
