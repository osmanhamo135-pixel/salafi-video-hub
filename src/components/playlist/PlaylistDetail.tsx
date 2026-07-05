import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Clock,
  Film,
  FolderOpen,
  Play,
  Search,
  SlidersHorizontal,
  SortAsc,
  Star,
  Video as VideoIcon,
  X,
} from 'lucide-react';
import { Playlist, Video } from '@/types';
import { formatDuration, formatTime } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

interface PlaylistDetailProps {
  playlist: Playlist;
  videos: Video[];
  loading: boolean;
  onBack: () => void;
  onPlayVideo: (video: Video) => void;
}

type VideoFilterKey = 'all' | 'in-progress' | 'unwatched' | 'completed' | 'favorites' | 'watch-later';
type VideoSortKey = 'playlist' | 'title' | 'duration' | 'progress' | 'recent';

const getVideoProgress = (video: Video) => {
  if (!video.durationSeconds || video.durationSeconds <= 0) return 0;
  return Math.min(Math.max((video.progressSeconds / video.durationSeconds) * 100, 0), 100);
};

export const PlaylistDetail: React.FC<PlaylistDetailProps> = ({
  playlist,
  videos,
  loading,
  onBack,
  onPlayVideo,
}) => {
  const { t } = useI18n();
  const [videoQuery, setVideoQuery] = useState('');
  const [videoFilter, setVideoFilter] = useState<VideoFilterKey>('all');
  const [videoSort, setVideoSort] = useState<VideoSortKey>('playlist');

  const progressPercent = useMemo(() => {
    if (!playlist.totalDurationSeconds) return 0;
    return Math.min((playlist.progressSeconds / playlist.totalDurationSeconds) * 100, 100);
  }, [playlist.progressSeconds, playlist.totalDurationSeconds]);

  const heroThumbnailPath = playlist.thumbnailPath ?? videos.find((video) => video.thumbnailPath)?.thumbnailPath ?? null;
  const continueVideo = useMemo(() => {
    const mostRecentInProgress = videos
      .filter((video) => video.progressSeconds > 0 && !video.completed)
      .sort((a, b) => (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt))[0];

    return mostRecentInProgress ?? videos.find((video) => !video.completed) ?? videos[0];
  }, [videos]);

  const videoSummary = useMemo(() => {
    return videos.reduce(
      (summary, video) => {
        const progress = getVideoProgress(video);
        return {
          completed: summary.completed + (video.completed ? 1 : 0),
          inProgress: summary.inProgress + (progress > 0 && !video.completed ? 1 : 0),
          favorites: summary.favorites + (video.favorite ? 1 : 0),
          watchLater: summary.watchLater + (video.watchLater ? 1 : 0),
        };
      },
      { completed: 0, inProgress: 0, favorites: 0, watchLater: 0 },
    );
  }, [videos]);

  const originalIndexById = useMemo(() => {
    return new Map(videos.map((video, index) => [video.id, index]));
  }, [videos]);

  const visibleVideos = useMemo(() => {
    const normalizedQuery = videoQuery.trim().toLowerCase();
    const filtered = videos.filter((video) => {
      const progress = getVideoProgress(video);
      const matchesQuery = !normalizedQuery ||
        video.title.toLowerCase().includes(normalizedQuery) ||
        video.fileName.toLowerCase().includes(normalizedQuery) ||
        (video.speaker ?? '').toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;
      if (videoFilter === 'in-progress') return progress > 0 && !video.completed;
      if (videoFilter === 'unwatched') return progress === 0 && !video.completed;
      if (videoFilter === 'completed') return video.completed;
      if (videoFilter === 'favorites') return video.favorite;
      if (videoFilter === 'watch-later') return video.watchLater;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (videoSort === 'title') return a.title.localeCompare(b.title);
      if (videoSort === 'duration') return b.durationSeconds - a.durationSeconds;
      if (videoSort === 'progress') return getVideoProgress(b) - getVideoProgress(a);
      if (videoSort === 'recent') return (b.lastPlayedAt ?? b.updatedAt) - (a.lastPlayedAt ?? a.updatedAt);
      return (originalIndexById.get(a.id) ?? 0) - (originalIndexById.get(b.id) ?? 0);
    });
  }, [originalIndexById, videoFilter, videoQuery, videoSort, videos]);

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="btn-ghost"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('backToLibrary')}
      </button>

      <section className="premium-surface ornate-corner relative overflow-hidden rounded-lg">
        <div className="gold-thread absolute inset-x-5 top-0" />
        <div className="grid grid-cols-[minmax(260px,420px)_1fr] max-lg:grid-cols-1">
          <div className="relative aspect-video bg-black">
            <LocalThumbnail
              path={heroThumbnailPath}
              label={playlist.name}
              className="h-full w-full object-cover"
              iconClassName="h-12 w-12 text-muted-text/45"
              fallbackClassName="thumbnail-fallback"
            />
            {progressPercent > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div className="h-full bg-primary-blue" style={{ width: `${progressPercent}%` }} />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-5 p-5">
            <div className="min-w-0">
              <div className="premium-pill mb-3">
                <FolderOpen className="h-3.5 w-3.5" />
                {t('localFolderPlaylist')}
              </div>
              <h2 className="text-2xl font-semibold leading-tight text-text-primary" title={playlist.name}>
                {playlist.name}
              </h2>
              <p className="mt-2 truncate text-sm text-muted-text" title={playlist.folderPath}>
                {playlist.folderPath}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <DetailMetric icon={Film} label={t('videosLower')} value={playlist.videoCount.toLocaleString()} />
              <DetailMetric icon={Clock} label={t('duration')} value={formatDuration(playlist.totalDurationSeconds)} />
              <DetailMetric icon={CheckCircle2} label={t('progress')} value={`${Math.round(progressPercent)}%`} />
            </div>
          </div>
        </div>
      </section>

      <section className="premium-surface overflow-hidden rounded-lg">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{t('videosInPlaylist')}</h3>
            <p className="text-xs text-muted-text">
              {visibleVideos.length.toLocaleString()} {t('shownOf')} {videos.length.toLocaleString()} {t('localFiles')}
            </p>
          </div>
          {videos[0] && (
            <div className="flex flex-wrap justify-end gap-2">
              {continueVideo && (
                <button
                  onClick={() => onPlayVideo(continueVideo)}
                  className="btn-secondary px-3 py-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {t('continue')}
                </button>
              )}
              <button
                onClick={() => onPlayVideo(videos[0])}
                className="btn-primary px-3 py-2"
              >
                <Play className="h-4 w-4 fill-current" />
                {t('playFromStart')}
              </button>
            </div>
          )}
        </div>

        {!loading && videos.length > 0 && (
          <div className="border-b border-border bg-background/45 px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative max-w-lg flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
                <input
                  type="text"
                  value={videoQuery}
                  onChange={(event) => setVideoQuery(event.target.value)}
                  placeholder={t('searchVideosInPlaylist')}
                  className="surface-input w-full py-2 pl-10 pr-9"
                />
                {videoQuery && (
                  <button
                    type="button"
                    onClick={() => setVideoQuery('')}
                    title={t('clearSearch')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-text hover:text-text-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-md border border-border bg-panel px-2.5 py-2 text-xs text-muted-text">
                  <SortAsc className="h-3.5 w-3.5" />
                  <select
                    value={videoSort}
                    onChange={(event) => setVideoSort(event.target.value as VideoSortKey)}
                    className="bg-transparent text-text-primary outline-none"
                  >
                    <option value="playlist">{t('playlistOrder')}</option>
                    <option value="title">{t('title')}</option>
                    <option value="duration">{t('longest')}</option>
                    <option value="progress">{t('progress')}</option>
                    <option value="recent">{t('recentlyPlayed')}</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-text">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t('view')}
              </div>
              <VideoFilterChip label={`${t('all')} ${videos.length}`} active={videoFilter === 'all'} onClick={() => setVideoFilter('all')} />
              <VideoFilterChip label={`${t('inProgress')} ${videoSummary.inProgress}`} active={videoFilter === 'in-progress'} onClick={() => setVideoFilter('in-progress')} />
              <VideoFilterChip label={t('unwatched')} active={videoFilter === 'unwatched'} onClick={() => setVideoFilter('unwatched')} />
              <VideoFilterChip label={`${t('completed')} ${videoSummary.completed}`} active={videoFilter === 'completed'} onClick={() => setVideoFilter('completed')} />
              <VideoFilterChip label={`${t('favorites')} ${videoSummary.favorites}`} active={videoFilter === 'favorites'} onClick={() => setVideoFilter('favorites')} />
              <VideoFilterChip label={`${t('watchLater')} ${videoSummary.watchLater}`} active={videoFilter === 'watch-later'} onClick={() => setVideoFilter('watch-later')} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-[74px] animate-pulse rounded-md bg-elevated-panel/70" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-muted-text">
            <VideoIcon className="mb-3 h-10 w-10 text-primary-blue/55" />
            <p className="text-sm font-medium text-text-primary">{t('noSupportedVideosFound')}</p>
            <p className="mt-1 text-xs">{t('recursiveRescanHint')}</p>
          </div>
        ) : visibleVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-muted-text">
            <SlidersHorizontal className="mb-3 h-10 w-10 text-primary-blue/55" />
            <p className="text-sm font-medium text-text-primary">{t('noVideosMatchView')}</p>
            <p className="mt-1 text-xs">{t('changeFilterHint')}</p>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-390px)] min-h-[280px] overflow-y-auto p-2">
            {visibleVideos.map((video) => (
              <PlaylistVideoRow
                key={video.id}
                index={originalIndexById.get(video.id) ?? 0}
                video={video}
                onPlay={() => onPlayVideo(video)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const DetailMetric: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="rounded-md border border-border bg-background/70 px-3 py-2 shadow-subtle">
    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-text">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <p className="text-sm font-semibold text-text-primary">{value}</p>
  </div>
);

const VideoFilterChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
      active
        ? 'border-primary-blue/35 bg-primary-blue/15 text-primary-blue'
        : 'border-border bg-panel text-muted-text hover:border-border-strong hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);

const PlaylistVideoRow: React.FC<{
  index: number;
  video: Video;
  onPlay: () => void;
}> = React.memo(({ index, video, onPlay }) => {
  const { t } = useI18n();
  const progressPercent = video.durationSeconds
    ? Math.min((video.progressSeconds / video.durationSeconds) * 100, 100)
    : 0;

  return (
    <button
      onClick={onPlay}
      className="group mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-panel-hover focus:outline-none focus:ring-1 focus:ring-primary-blue/40"
    >
      <div className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-text">
        {index + 1}
      </div>

      <div className="relative h-[58px] w-[104px] shrink-0 overflow-hidden rounded-md bg-background">
        <LocalThumbnail
          path={video.thumbnailPath}
          label={video.title}
          className="h-full w-full object-cover"
          iconClassName="h-5 w-5 text-muted-text/60"
          fallbackClassName="thumbnail-fallback"
        />
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
            <div className="h-full bg-primary-blue" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary group-hover:text-white" title={video.title}>
          {video.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-text">
          <span>{formatTime(video.durationSeconds)}</span>
          <span className="truncate" title={video.fileName}>{video.fileName}</span>
          {video.completed && <span className="text-success-green">{t('completed')}</span>}
          {video.favorite && (
            <span className="inline-flex items-center gap-1 text-danger-red">
              <Star className="h-3 w-3 fill-current" />
              {t('favorite')}
            </span>
          )}
          {video.watchLater && (
            <span className="inline-flex items-center gap-1 text-warning-orange">
              <Bookmark className="h-3 w-3 fill-current" />
              {t('watchLater')}
            </span>
          )}
          {video.thumbnailStatus === 'queued' && <span>{t('thumbnailQueued')}</span>}
          {(video.thumbnailStatus === 'failed' || video.thumbnailStatus === 'fallback') && <span>{t('fallbackThumbnail')}</span>}
        </div>
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-elevated-panel text-muted-text transition-colors group-hover:border-primary-blue/35 group-hover:bg-primary-blue group-hover:text-[#03110f]">
        <Play className="h-4 w-4 fill-current" />
      </div>
    </button>
  );
});

PlaylistVideoRow.displayName = 'PlaylistVideoRow';
