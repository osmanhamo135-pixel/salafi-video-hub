import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  Loader2,
  MonitorPlay,
  Play,
  Search,
  ShieldCheck,
  X,
  Youtube,
} from 'lucide-react';
import { useWatchStore, YoutubeSearchItem } from '@/store/watchStore';
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

        {!hasSearched && !searching && results.length === 0 && (
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

const WatchPlayer: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const current = useWatchStore((state) => state.current);
  const useEmbed = useWatchStore((state) => state.useEmbed);
  const closePlayer = useWatchStore((state) => state.closePlayer);
  const enableEmbedFallback = useWatchStore((state) => state.enableEmbedFallback);
  const setDownloadUrl = useDownloadStore((state) => state.setUrl);

  const embedSrc = useMemo(
    () => (current ? `https://www.youtube-nocookie.com/embed/${current.videoId}?autoplay=1&rel=0` : ''),
    [current],
  );

  if (!current) return null;

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
            key={`stream-${current.videoId}`}
            src={current.videoUrl}
            poster={current.thumbnail}
            controls
            autoPlay
            playsInline
            className="h-full w-full"
            onError={enableEmbedFallback}
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
        <p className="mt-1 truncate text-xs text-muted-text">
          {item.channel}
          {item.viewCount ? ` · ${formatViews(item.viewCount)} ${t('watchViews')}` : ''}
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
