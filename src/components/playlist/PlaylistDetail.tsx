import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  FolderClosed,
  Play,
  Search,
  SortAsc,
  Star,
  X,
} from 'lucide-react';
import { Playlist, Video } from '@/types';
import { formatDuration, formatTime } from '@/utils/formatTime';
import { PlaylistPoster, ProgressMeter, useCategoryLabel } from './PlaylistCard';
import { Select } from '@/components/ui/Select';
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
  const { t, language } = useI18n();
  const categoryLabel = useCategoryLabel(playlist.category);
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

  const isComplete = progressPercent >= 95;
  const detailMetrics = [
    { label: t('videosLower'), value: playlist.videoCount.toLocaleString() },
    { label: t('duration'), value: formatDuration(playlist.totalDurationSeconds, language) },
    { label: t('completed'), value: `${videoSummary.completed} / ${playlist.videoCount}` },
  ];

  return (
    <div>
      <button onClick={onBack} className="btn-ghost -ms-3 mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('backToLibrary')}
      </button>

      {/* Playlist header — one poster, one title, one metric band. The title
          carries the weight; the folder path is the quietest thing here. */}
      <section className="pb-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border border-border bg-elevated-panel sm:w-[22rem] lg:w-[26rem]">
            <PlaylistPoster path={heroThumbnailPath} name={playlist.name} seed={playlist.id} />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
            {progressPercent > 0 && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-background/70">
                <div
                  className={`h-full ${isComplete ? 'bg-success-green' : 'bg-accent-gold'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-5">
            <div className="min-w-0">
              {categoryLabel && (
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-gold">
                  <bdi>{categoryLabel}</bdi>
                </p>
              )}
              <h2
                className="text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.02em] text-text-primary"
                title={playlist.name}
              >
                <bdi>{playlist.name}</bdi>
              </h2>
              <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-text-faint" title={playlist.folderPath}>
                <FolderClosed className="h-3 w-3 shrink-0" />
                <span className="truncate"><bdi>{playlist.folderPath}</bdi></span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <ProgressMeter percent={progressPercent} done={isComplete} thick />
              <p className="text-xs text-muted-text">
                <span className="font-semibold tabular-nums text-accent-gold">
                  <bdi>{Math.round(progressPercent)}%</bdi>
                </span>{' '}
                <bdi>{formatDuration(playlist.progressSeconds, language)}</bdi> {t('of')}{' '}
                <bdi>{formatDuration(playlist.totalDurationSeconds, language)}</bdi> {t('watched')}
              </p>
            </div>

            <div className="grid grid-cols-3 border-y border-border">
              {detailMetrics.map((metric, i) => (
                <div key={metric.label} className={`min-w-0 px-4 py-3 first:ps-0 ${i > 0 ? 'border-s border-border' : ''}`}>
                  <p className="text-lg font-semibold tabular-nums tracking-[-0.01em] text-text-primary">
                    <bdi>{metric.value}</bdi>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>

            {videos[0] && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onPlayVideo(videos[0])} className="btn-primary px-3.5 py-2 text-xs">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {t('playFromStart')}
                </button>
                {continueVideo && (
                  <button onClick={() => onPlayVideo(continueVideo)} className="btn-secondary px-3.5 py-2 text-xs">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {t('continue')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="rule-head mb-1">
          <h3 className="text-sm font-semibold text-text-primary">{t('videosInPlaylist')}</h3>
          <span dir="ltr" className="text-xs tabular-nums text-muted-text">
            {visibleVideos.length} / {videos.length}
          </span>
        </div>

        {!loading && videos.length > 0 && (
          <div className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
              <input
                type="text"
                value={videoQuery}
                onChange={(event) => setVideoQuery(event.target.value)}
                placeholder={t('searchVideosInPlaylist')}
                className="field-quiet ps-6 pe-7 text-sm"
              />
              {videoQuery && (
                <button
                  type="button"
                  onClick={() => setVideoQuery('')}
                  title={t('clearSearch')}
                  className="icon-btn absolute end-0 top-1/2 h-6 w-6 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <div className="segmented" role="group" aria-label={t('view')}>
                <button type="button" aria-pressed={videoFilter === 'all'} onClick={() => setVideoFilter('all')}>
                  {t('all')} <bdi>{videos.length}</bdi>
                </button>
                <button type="button" aria-pressed={videoFilter === 'in-progress'} onClick={() => setVideoFilter('in-progress')}>
                  {t('inProgress')} <bdi>{videoSummary.inProgress}</bdi>
                </button>
                <button type="button" aria-pressed={videoFilter === 'unwatched'} onClick={() => setVideoFilter('unwatched')}>
                  {t('unwatched')}
                </button>
                <button type="button" aria-pressed={videoFilter === 'completed'} onClick={() => setVideoFilter('completed')}>
                  {t('completed')} <bdi>{videoSummary.completed}</bdi>
                </button>
                <button type="button" aria-pressed={videoFilter === 'favorites'} onClick={() => setVideoFilter('favorites')}>
                  {t('favorites')} <bdi>{videoSummary.favorites}</bdi>
                </button>
                <button type="button" aria-pressed={videoFilter === 'watch-later'} onClick={() => setVideoFilter('watch-later')}>
                  {t('watchLater')} <bdi>{videoSummary.watchLater}</bdi>
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-text">
                <SortAsc className="h-3.5 w-3.5" />
                <Select
                  label={t('sortBy')}
                  value={videoSort}
                  onChange={(v) => setVideoSort(v as VideoSortKey)}
                  options={[
                    { value: 'playlist', label: t('playlistOrder') },
                    { value: 'title', label: t('title') },
                    { value: 'duration', label: t('longest') },
                    { value: 'progress', label: t('progress') },
                    { value: 'recent', label: t('recentlyPlayed') },
                  ]}
                />
              </label>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rule-list">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rule-row">
                <div className="h-[54px] w-24 shrink-0 rounded bg-panel-hover motion-safe:animate-pulse" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/5 rounded bg-panel-hover motion-safe:animate-pulse" />
                  <div className="h-3 w-1/4 rounded bg-panel-hover motion-safe:animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-text-primary">{t('noSupportedVideosFound')}</p>
            <p className="mt-1 text-xs text-muted-text">{t('recursiveRescanHint')}</p>
          </div>
        ) : visibleVideos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-text-primary">{t('noVideosMatchView')}</p>
            <p className="mt-1 text-xs text-muted-text">{t('changeFilterHint')}</p>
          </div>
        ) : (
          <div className="rule-list max-h-[calc(100vh-420px)] min-h-[280px] overflow-y-auto">
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
    <button onClick={onPlay} className="rule-row group w-full text-start">
      <div className="w-7 shrink-0 text-end text-xs tabular-nums text-text-faint">
        <bdi>{index + 1}</bdi>
      </div>

      <div className="relative h-[58px] w-[104px] shrink-0 overflow-hidden rounded-md bg-background">
        <PlaylistPoster path={video.thumbnailPath} name={video.title} seed={video.id} dense />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/65 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5 fill-current text-text-primary" />
        </span>
        {progressPercent > 0 && (
          <span className="absolute inset-x-0 bottom-0 block h-[3px] bg-background/70">
            <span
              className={`block h-full ${video.completed ? 'bg-success-green' : 'bg-accent-gold'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium text-text-primary" title={video.title}>
          <bdi>{video.title}</bdi>
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-text">
          <span className="truncate text-text-faint" title={video.fileName}><bdi>{video.fileName}</bdi></span>
          {video.completed && <span>{t('completed')}</span>}
          {video.favorite && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-current" />
              {t('favorite')}
            </span>
          )}
          {video.watchLater && (
            <span className="inline-flex items-center gap-1">
              <Bookmark className="h-3 w-3 fill-current" />
              {t('watchLater')}
            </span>
          )}
          {video.thumbnailStatus === 'queued' && <span>{t('thumbnailQueued')}</span>}
          {(video.thumbnailStatus === 'failed' || video.thumbnailStatus === 'fallback') && <span>{t('fallbackThumbnail')}</span>}
        </div>
      </div>

      <span className="shrink-0 text-xs tabular-nums text-muted-text">
        <bdi>{formatTime(video.durationSeconds)}</bdi>
      </span>
    </button>
  );
});

PlaylistVideoRow.displayName = 'PlaylistVideoRow';
