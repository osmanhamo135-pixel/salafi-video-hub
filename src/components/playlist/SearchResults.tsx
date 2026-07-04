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
      <div className="premium-card ornate-corner relative flex flex-col items-center justify-center rounded-lg py-20 text-center">
        <div className="icon-medallion mb-4 h-16 w-16">
          <SearchX className="h-8 w-8 text-primary-blue/65" />
        </div>
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
          <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wider mb-3">
            {t('playlists')} ({results.playlists.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
          <h2 className="text-sm font-semibold text-muted-text uppercase tracking-wider mb-3">
            {t('videosLower')} ({results.videos.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
    <div
      onClick={() => onOpen(playlist)}
      className="premium-card premium-card-hover flex cursor-pointer items-center gap-3 rounded-lg p-3"
    >
      <div className="flex h-10 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-elevated-panel">
        <LocalThumbnail
          path={playlist.thumbnailPath}
          label={playlist.name}
          className="w-full h-full object-cover"
          iconClassName="w-4 h-4 text-muted-text/40"
          fallbackClassName="thumbnail-fallback"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate" title={playlist.name}>
          {playlist.name}
        </p>
        <p className="text-xs text-muted-text truncate" title={playlist.folderPath}>
          {playlist.folderPath}
        </p>
      </div>
    </div>
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
    <div
      onClick={() => onOpen(video)}
      className="premium-card premium-card-hover group flex cursor-pointer flex-col overflow-hidden rounded-lg"
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-elevated-panel overflow-hidden">
        <LocalThumbnail
          path={video.thumbnailPath}
          label={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          iconClassName="w-8 h-8 text-muted-text/40"
          fallbackClassName="thumbnail-fallback"
        />

        {/* Duration badge */}
        <div className="media-badge absolute bottom-2 right-2 text-[10px]">
          {formatTime(video.durationSeconds)}
        </div>

        {/* Play overlay */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="w-8 h-8 text-white fill-current" />
        </div>

        {/* Watched progress bar */}
        {video.completed && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-success-green" />
        )}
        {!video.completed && progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/50">
            <div
              className="h-full bg-primary-blue"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3">
        <h4
          className="text-sm font-medium text-text-primary leading-snug line-clamp-2 min-h-[2.25rem]"
          title={video.title}
        >
          {video.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-text">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(video.durationSeconds)}
          </span>
          {video.fileSize > 0 && (
            <span>{formatBytes(video.fileSize)}</span>
          )}
        </div>
        {video.speaker && (
          <p className="text-xs text-muted-text truncate" title={video.speaker}>
            {video.speaker}
          </p>
        )}
      </div>
    </div>
  );
};
