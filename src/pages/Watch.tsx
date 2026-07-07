import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  History,
  Loader2,
  MonitorPlay,
  Play,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { useWatchStore, WatchHistoryItem, YoutubeSearchItem } from '@/store/watchStore';
import { useDownloadStore } from '@/store/downloadStore';
import { formatTime } from '@/utils/formatTime';
import { useI18n } from '@/i18n';

export const Watch: React.FC = () => {
  const { t } = useI18n();
  const query = useWatchStore((state) => state.query);
  const setQuery = useWatchStore((state) => state.setQuery);
  const search = useWatchStore((state) => state.search);
  const results = useWatchStore((state) => state.results);
  const hasSearched = useWatchStore((state) => state.hasSearched);
  const searching = useWatchStore((state) => state.searching);
  const searchError = useWatchStore((state) => state.searchError);
  const resolving = useWatchStore((state) => state.resolving);
  const resolvingTitle = useWatchStore((state) => state.resolvingTitle);
  const resolveError = useWatchStore((state) => state.resolveError);
  const history = useWatchStore((state) => state.history);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void search();
  };

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-6">
          <div className="premium-pill mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('watchAdFreePill')}
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('watchTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-text">{t('watchSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="premium-surface mb-5 flex flex-col gap-2 rounded-lg p-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('watchSearchPlaceholder')}
              className="surface-input w-full py-2.5 ps-10"
            />
          </div>
          <button type="submit" disabled={searching || !query.trim()} className="btn-primary justify-center px-5 py-2.5">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {searching ? t('searching') : t('watchSearchButton')}
          </button>
        </form>

        <WatchPlayer />

        {resolving && (
          <div className="premium-surface mb-5 flex items-center gap-3 rounded-lg p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary-blue" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{t('watchLoadingStream')}</p>
              {resolvingTitle && <p className="truncate text-xs text-muted-text">{resolvingTitle}</p>}
            </div>
          </div>
        )}

        {resolveError && !resolving && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-danger-red/25 bg-danger-red/10 p-3 text-xs text-danger-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="whitespace-pre-wrap">{resolveError}</span>
          </div>
        )}

        {searchError && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-danger-red/25 bg-danger-red/10 p-3 text-xs text-danger-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="whitespace-pre-wrap">{searchError}</span>
          </div>
        )}

        <WatchHistoryRow />

        {results.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
            {results.map((item) => (
              <ResultCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {!searching && hasSearched && results.length === 0 && !searchError && (
          <div className="premium-surface rounded-lg p-10 text-center">
            <Youtube className="mx-auto mb-3 h-9 w-9 text-muted-text" />
            <p className="text-sm font-medium text-text-primary">{t('watchNoResults')}</p>
          </div>
        )}

        {!hasSearched && !searching && results.length === 0 && history.length === 0 && (
          <div className="premium-surface ornate-corner relative rounded-lg p-10 text-center">
            <MonitorPlay className="mx-auto mb-3 h-10 w-10 text-primary-blue" />
            <p className="text-base font-semibold text-text-primary">{t('watchEmptyTitle')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-text">{t('watchEmptyHint')}</p>
            <p className="mx-auto mt-4 flex max-w-md items-center justify-center gap-1.5 text-xs text-accent-gold">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('watchAdFreeNote')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const PROGRESS_SAVE_MS = 5000;

const WatchPlayer: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const current = useWatchStore((state) => state.current);
  const useEmbed = useWatchStore((state) => state.useEmbed);
  const closePlayer = useWatchStore((state) => state.closePlayer);
  const enableEmbedFallback = useWatchStore((state) => state.enableEmbedFallback);
  const setDownloadUrl = useDownloadStore((state) => state.setUrl);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaveRef = useRef(0);

  // Save the position when leaving the page (or switching videos) so coming
  // back resumes exactly where the user stopped.
  useEffect(() => {
    const videoId = current?.videoId;
    return () => {
      const element = videoRef.current;
      if (!videoId || !element || !element.currentTime) return;
      useWatchStore
        .getState()
        .recordProgress(videoId, element.currentTime, element.duration || 0);
    };
  }, [current?.videoId]);

  const embedSrc = useMemo(
    () => (current ? `https://www.youtube-nocookie.com/embed/${current.videoId}?autoplay=1&rel=0` : ''),
    [current],
  );

  if (!current) return null;

  const saveProgress = (force = false) => {
    const element = videoRef.current;
    if (!element) return;
    const now = Date.now();
    if (!force && now - lastSaveRef.current < PROGRESS_SAVE_MS) return;
    lastSaveRef.current = now;
    useWatchStore
      .getState()
      .recordProgress(current.videoId, element.currentTime, element.duration || current.durationSeconds);
  };

  const handleLoadedMetadata = () => {
    const element = videoRef.current;
    if (!element) return;
    const resume = useWatchStore.getState().getResumePosition(current.videoId);
    if (resume > 5 && resume < (element.duration || Infinity) - 10) {
      element.currentTime = resume;
    }
  };

  const handleDownload = () => {
    setDownloadUrl(current.sourceUrl);
    navigate('/downloads');
  };

  return (
    <section className="premium-surface ornate-corner relative mb-5 overflow-hidden rounded-lg">
      <div className="gold-thread absolute inset-x-5 top-0" />
      <div className="aspect-video w-full bg-black">
        {useEmbed ? (
          <iframe
            key={`embed-${current.videoId}`}
            src={embedSrc}
            title={current.title}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            key={`stream-${current.videoId}`}
            src={current.videoUrl}
            poster={current.thumbnail}
            controls
            autoPlay
            playsInline
            className="h-full w-full"
            onError={enableEmbedFallback}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={() => saveProgress()}
            onPause={() => saveProgress(true)}
            onEnded={() => saveProgress(true)}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary" title={current.title}>
            {current.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-text">
            {current.channel && <span>{current.channel}</span>}
            {current.durationSeconds > 0 && <span>{formatTime(current.durationSeconds)}</span>}
            {!useEmbed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-green/15 px-2 py-0.5 font-medium text-success-green">
                <ShieldCheck className="h-3 w-3" />
                {t('watchAdFreeBadge')}
                {current.height > 0 && ` · ${current.height}p`}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!useEmbed && (
            <button type="button" onClick={enableEmbedFallback} className="btn-secondary px-3 py-2 text-xs">
              <Youtube className="h-3.5 w-3.5" />
              {t('watchUseEmbed')}
            </button>
          )}
          <button type="button" onClick={handleDownload} className="btn-secondary px-3 py-2 text-xs">
            <Download className="h-3.5 w-3.5" />
            {t('watchSaveToLibrary')}
          </button>
          <button type="button" onClick={closePlayer} className="btn-ghost border border-border px-3 py-2 text-xs">
            <X className="h-3.5 w-3.5" />
            {t('close')}
          </button>
        </div>
      </div>
    </section>
  );
};

const WatchHistoryRow: React.FC = () => {
  const { t } = useI18n();
  const history = useWatchStore((state) => state.history);
  const current = useWatchStore((state) => state.current);
  const clearHistory = useWatchStore((state) => state.clearHistory);

  // Hide the video that is playing right now — showing it again directly
  // under the player reads as a duplicate.
  const visible = history.filter((item) => item.id !== current?.videoId);

  if (visible.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <History className="h-4 w-4 text-primary-blue" />
          {t('continueWatching')}
        </h2>
        <button
          type="button"
          onClick={clearHistory}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-text transition-colors hover:bg-danger-red/10 hover:text-danger-red"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('watchClearHistory')}
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {visible.map((item) => (
          <HistoryCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
};

const HistoryCard: React.FC<{ item: WatchHistoryItem }> = React.memo(({ item }) => {
  const { t } = useI18n();
  const playUrl = useWatchStore((state) => state.playUrl);
  const removeFromHistory = useWatchStore((state) => state.removeFromHistory);
  const resolving = useWatchStore((state) => state.resolving);
  const progressPercent = item.durationSeconds > 0
    ? Math.min((item.positionSeconds / item.durationSeconds) * 100, 100)
    : 0;

  return (
    <div className="premium-card premium-card-hover group relative w-56 shrink-0 overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={() => void playUrl(item.url)}
        disabled={resolving}
        className="block w-full text-start disabled:opacity-60"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-elevated-panel">
          <img
            src={item.thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            draggable={false}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-blue/90 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <Play className="h-4 w-4 text-white" fill="currentColor" />
            </span>
          </div>
          {item.positionSeconds > 0 && (
            <span className="media-badge absolute bottom-1.5 end-1.5" dir="ltr">
              {formatTime(item.positionSeconds)} / {formatTime(item.durationSeconds)}
            </span>
          )}
          {progressPercent > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div className="h-full bg-primary-blue" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
        </div>
        <div className="p-2.5">
          <p className="line-clamp-2 text-xs font-medium leading-snug text-text-primary" title={item.title}>
            {item.title}
          </p>
          {item.channel && <p className="mt-0.5 truncate text-[11px] text-muted-text">{item.channel}</p>}
        </div>
      </button>
      <button
        type="button"
        onClick={() => removeFromHistory(item.id)}
        title={t('remove')}
        className="absolute end-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-danger-red group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});

HistoryCard.displayName = 'HistoryCard';

const ResultCard: React.FC<{ item: YoutubeSearchItem }> = React.memo(({ item }) => {
  const { t } = useI18n();
  const play = useWatchStore((state) => state.play);
  const resolving = useWatchStore((state) => state.resolving);

  return (
    <button
      type="button"
      onClick={() => void play(item)}
      disabled={resolving}
      className="premium-card premium-card-hover group overflow-hidden rounded-lg text-start transition-transform disabled:opacity-60"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-elevated-panel">
        <img
          src={item.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          draggable={false}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-blue/90 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 text-white" fill="currentColor" />
          </span>
        </div>
        {item.durationSeconds > 0 && (
          <span className="media-badge absolute bottom-2 end-2" dir="ltr">
            {formatTime(item.durationSeconds)}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary" title={item.title}>
          {item.title}
        </p>
        {/* <bdi> isolates each segment so Arabic channel names never scramble
            the "8.2K views" part (mixed RTL/LTR text reordering). */}
        <p className="mt-1 truncate text-xs text-muted-text">
          <bdi>{item.channel}</bdi>
          {item.viewCount ? (
            <>
              {' · '}
              <bdi>{`${formatViews(item.viewCount)} ${t('watchViews')}`}</bdi>
            </>
          ) : null}
        </p>
      </div>
    </button>
  );
});

ResultCard.displayName = 'ResultCard';

const formatViews = (views: number) => {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(views);
};
