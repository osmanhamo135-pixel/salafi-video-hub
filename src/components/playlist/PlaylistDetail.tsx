import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Play,
  Search,
  SortAsc,
  Star,
  X,
} from 'lucide-react';
import { Playlist, Video } from '@/types';
import { formatDuration, formatTime } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

/* .thumbnail-fallback bakes in an .icon-medallion (primary-blue border + fill)
   and a teal underline, which puts a second accent in every un-thumbnailed row.
   Neutralise both from the call site; the primitive itself is not ours to edit. */
const QUIET_FALLBACK =
  'thumbnail-fallback after:hidden [&_.icon-medallion]:border-border [&_.icon-medallion]:bg-transparent [&_.icon-medallion]:shadow-none [&_.icon-medallion]:after:hidden';

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

  const detailMetrics = [
    { label: t('videosLower'), value: playlist.videoCount.toLocaleString() },
    { label: t('duration'), value: formatDuration(playlist.totalDurationSeconds, language) },
    { label: t('progress'), value: `${Math.round(progressPercent)}%` },
  ];

  return (
    <div>
      <button onClick={onBack} className="btn-ghost -ms-3 mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('backToLibrary')}
      </button>

      {/* Playlist header — a poster, a title and a metric strip separated by
          hairlines. No card, no ornate corners, no drop shadow. */}
      <section className="pb-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-elevated-panel sm:w-[300px]">
            <LocalThumbnail
              path={heroThumbnailPath}
              label={playlist.name}
              className="h-full w-full object-cover"
              iconClassName="h-10 w-10 text-muted-text/45"
              fallbackClassName={QUIET_FALLBACK}
            />
            {progressPercent > 0 && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-background/70">
                <div className="h-full bg-muted-text" style={{ width: `${progressPercent}%` }} />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold leading-tight text-text-primary" title={playlist.name}>
                <bdi>{playlist.name}</bdi>
              </h2>
              <p className="mt-1.5 truncate text-sm text-muted-text" title={playlist.folderPath}>
                <bdi>{playlist.folderPath}</bdi>
              </p>
            </div>

            <div className="flex border-t border-border pt-3">
              {detailMetrics.map((metric, i) => (
                <div key={metric.label} className={`min-w-0 flex-1 ${i > 0 ? 'border-s border-border ps-4' : 'pe-4'}`}>
                  <p className="text-lg font-semibold tabular-nums text-text-primary">
                    <bdi>{metric.value}</bdi>
                  </p>
                  <p className="truncate text-xs text-muted-text">{metric.label}</p>
                </div>
              ))}
            </div>

            {videos[0] && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onPlayVideo(videos[0])} className="btn-primary px-3 py-2 text-xs">
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {t('playFromStart')}
                </button>
                {continueVideo && (
                  <button onClick={() => onPlayVideo(continueVideo)} className="btn-secondary px-3 py-2 text-xs">
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

      <div className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded bg-background">
        <LocalThumbnail
          path={video.thumbnailPath}
          label={video.title}
          className="h-full w-full object-cover"
          iconClassName="h-4 w-4 text-muted-text"
          fallbackClassName={QUIET_FALLBACK}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5 fill-current text-text-primary" />
        </span>
        {progressPercent > 0 && (
          <span className="absolute inset-x-0 bottom-0 block h-0.5 bg-background/70">
            <span className="block h-full bg-muted-text" style={{ width: `${progressPercent}%` }} />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary" title={video.title}>
          <bdi>{video.title}</bdi>
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-text">
          <span className="truncate" title={video.fileName}><bdi>{video.fileName}</bdi></span>
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
