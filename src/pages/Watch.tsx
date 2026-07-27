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
import { CONTENT_CATEGORIES } from '@/utils/constants';
import { formatTime } from '@/utils/formatTime';
import { DashboardRails } from '@/components/dashboard/DashboardRails';
import { useI18n } from '@/i18n';

/**
 * What the empty state offers to search for. Taken from the app's own content
 * taxonomy rather than invented copy, so the labels are already translated and
 * a new category appears here for free. The first six are the disciplines a
 * student is most likely to be looking for.
 */
const SUGGESTED_CATEGORIES = CONTENT_CATEGORIES.slice(0, 6);

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

        {/* The search field is what this page IS, so it is set at reading size
            rather than as one more 14px control. */}
        <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-0 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('watchSearchPlaceholder')}
              className="field-quiet ps-7 text-base"
              // On an <input> `dir="auto"` is the right tool (unlike on a block
              // in a row): it flips the caret and alignment once the reader
              // starts typing Arabic, and follows the placeholder until then.
              dir="auto"
            />
          </div>
          <button type="submit" disabled={searching || !query.trim()} className="btn-primary shrink-0 justify-center px-5 py-2.5">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {searching ? t('searching') : t('watchSearchButton')}
          </button>
        </form>

        <WatchPlayer />

        {resolving && (
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-text" />
            <div className="min-w-0">
              <p className="text-sm text-text-primary">{t('watchLoadingStream')}</p>
              {resolvingTitle && <p className="truncate text-xs text-muted-text" dir="auto">{resolvingTitle}</p>}
            </div>
          </div>
        )}

        {resolveError && !resolving && (
          <div className="mb-5 flex items-start gap-2 border-b border-danger-red/30 pb-3 text-xs text-danger-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="whitespace-pre-wrap" dir="auto">{resolveError}</span>
          </div>
        )}

        {searchError && (
          <div className="mb-5 flex items-start gap-2 border-b border-danger-red/30 pb-3 text-xs text-danger-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="whitespace-pre-wrap" dir="auto">{searchError}</span>
          </div>
        )}

        <WatchHistoryRow />

        {results.length > 0 && (
          <section>
            {/* Results arrived with no header at all — the grid simply appeared
                where the empty state had been, with nothing saying what it is
                or how much of it there is. */}
            <div className="rule-head mb-4">
              {/* The query itself is the heading — the one label that says what
                  this grid is without needing a new dictionary string. */}
              <h2 className="flex min-w-0 items-center gap-2 text-xs font-semibold text-text-primary">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-text" />
                <span className="truncate">
                  <bdi>{query}</bdi>
                </span>
              </h2>
              <span className="shrink-0 text-xs tabular-nums text-muted-text">
                <bdi>{results.length}</bdi>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
              {results.map((item) => (
                <ResultCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {!searching && hasSearched && results.length === 0 && !searchError && (
          <WatchPlaceholder icon={Youtube} title={t('watchNoResults')} />
        )}

        {!hasSearched && !searching && results.length === 0 && history.length === 0 && (
          <WatchPlaceholder
            icon={MonitorPlay}
            title={t('watchEmptyTitle')}
            hint={t('watchEmptyHint')}
            note={t('watchAdFreeNote')}
            suggestions
          />
        )}

        {/* The route measured 473px of dead ground below the chips at 1080p —
            nearly half the frame, on a page whose whole purpose is finding
            something to watch. The local library answers that better than
            empty navy does. */}
        {!hasSearched && !searching && results.length === 0 && <DashboardRails />}

        {/* Returning reader, nothing searched yet: the history strip is on
            screen but everything under it was empty. The same starting points
            carry the rest of the page. */}
        {!hasSearched && !searching && results.length === 0 && history.length > 0 && (
          <section className="mt-2">
            <SearchSuggestions />
            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-text-faint">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent-gold/70" />
              <span>{t('watchAdFreeNote')}</span>
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

/**
 * The first thing a new user sees on this page. It used to be an icon and two
 * grey sentences centred in a 1600px void, which told them the page existed but
 * gave them nothing to do — and the one real promise this page makes (no ads,
 * ever) was the faintest text on the screen.
 *
 * Now: a framed mark, the promise stated plainly, and six real starting points
 * taken from the app's own taxonomy so the very first click is one keystroke
 * away. The suggestions are ordinary buttons that fill the field and search —
 * no behaviour the form does not already have.
 */
/**
 * Six real starting points, one click each. Ordinary buttons that fill the
 * field and submit — no behaviour the form does not already have.
 */
const SearchSuggestions: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useI18n();
  const setQuery = useWatchStore((state) => state.setQuery);
  const search = useWatchStore((state) => state.search);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {SUGGESTED_CATEGORIES.map((category) => {
        const label = t(category.labelKey);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => {
              setQuery(label);
              void search();
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-text transition-colors hover:border-border-strong hover:text-text-primary motion-reduce:transition-none"
          >
            <bdi>{label}</bdi>
          </button>
        );
      })}
    </div>
  );
};

const WatchPlaceholder: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  note?: string;
  suggestions?: boolean;
}> = ({ icon: Icon, title, hint, note, suggestions }) => {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="mb-6 flex h-16 w-16 items-center justify-center border border-accent-gold/25"
      >
        <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center border border-accent-gold/15">
          <Icon className="h-6 w-6 text-accent-gold/70" />
        </span>
      </span>
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      {hint && <p className="mt-2 text-sm leading-relaxed text-muted-text">{hint}</p>}

      {suggestions && (
        <>
          <span aria-hidden="true" className="gold-thread mt-7 w-full max-w-xs" />
          <SearchSuggestions className="mt-5 justify-center" />
        </>
      )}

      {note && (
        <p className="mt-7 flex items-start gap-2 text-xs leading-relaxed text-text-faint">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-accent-gold/70" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
};

const PROGRESS_SAVE_MS = 5000;

// A quiet text action: no chip, no border, no fill. Repeated as a constant
// rather than a class because src/index.css is owned elsewhere — see report.
const QUIET_ACTION = 'quiet-action';

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
  // Last position seen, tagged with the video it belongs to. The cleanup below
  // cannot read videoRef: the <video> is keyed on the id, so by the time a
  // passive cleanup runs the ref already points at the *new* element. Reading it
  // there wrote the new video's clock onto the previous video's history entry
  // (or, when it was still 0, dropped the resume point entirely).
  const positionRef = useRef<{ videoId: string; currentTime: number; duration: number } | null>(null);

  // Save the position when leaving the page (or switching videos) so coming
  // back resumes exactly where the user stopped.
  useEffect(() => {
    const videoId = current?.videoId;
    return () => {
      const snapshot = positionRef.current;
      if (!videoId || !snapshot || snapshot.videoId !== videoId || !snapshot.currentTime) return;
      useWatchStore.getState().recordProgress(videoId, snapshot.currentTime, snapshot.duration);
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
    positionRef.current = {
      videoId: current.videoId,
      currentTime: element.currentTime,
      duration: element.duration || current.durationSeconds,
    };
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
    <section className="reveal glass mb-5 overflow-hidden rounded-lg">
      {/* A player letterbox is black on every theme — that is what a video
          frame is, not a themed surface. */}
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
          <p className="truncate text-sm font-medium text-text-primary" title={current.title} dir="auto">
            {current.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-text">
            {current.channel && <bdi>{current.channel}</bdi>}
            {current.durationSeconds > 0 && <bdi>{formatTime(current.durationSeconds)}</bdi>}
            {!useEmbed && (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <bdi>
                  {t('watchAdFreeBadge')}
                  {current.height > 0 && ` · ${current.height}p`}
                </bdi>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {!useEmbed && (
            <button type="button" onClick={enableEmbedFallback} className={QUIET_ACTION}>
              <Youtube className="h-3.5 w-3.5" />
              {t('watchUseEmbed')}
            </button>
          )}
          <button type="button" onClick={handleDownload} className={QUIET_ACTION}>
            <Download className="h-3.5 w-3.5" />
            {t('watchSaveToLibrary')}
          </button>
          <button type="button" onClick={closePlayer} className={QUIET_ACTION}>
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
    <section className="reveal mb-5">
      <div className="rule-head">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          <History className="h-3.5 w-3.5 text-muted-text" />
          {t('continueWatching')}
        </h2>
        <button
          type="button"
          onClick={clearHistory}
          className="inline-flex items-center gap-1.5 py-1 text-xs font-medium text-muted-text transition-colors hover:text-danger-red motion-reduce:transition-none"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('watchClearHistory')}
        </button>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
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
    <div className="glass glass-hover group relative w-56 shrink-0 overflow-hidden rounded-lg">
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
          {/* Scrim over a thumbnail: theme-independent by nature. The play
              medallion is not — it takes the theme accent, and its glyph the
              page ground, so it stays legible on the pale-accent themes where
              a white glyph washed out. */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35 motion-reduce:transition-none">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gold opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none">
              <Play className="h-4 w-4 text-background" fill="currentColor" />
            </span>
          </div>
          {item.positionSeconds > 0 && (
            <span className="media-badge absolute bottom-1.5 end-1.5" dir="ltr">
              {formatTime(item.positionSeconds)} / {formatTime(item.durationSeconds)}
            </span>
          )}
          {progressPercent > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div className="h-full bg-accent-gold" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
        </div>
        <div className="p-2.5">
          <p className="line-clamp-2 text-xs font-medium leading-snug text-text-primary" title={item.title} dir="auto">
            {item.title}
          </p>
          {item.channel && <p className="mt-0.5 truncate text-[11px] text-muted-text" dir="auto">{item.channel}</p>}
        </div>
      </button>
      <button
        type="button"
        onClick={() => removeFromHistory(item.id)}
        title={t('remove')}
        className="absolute end-1.5 top-1.5 rounded-full bg-black/60 p-1 text-text-primary opacity-0 transition-opacity hover:bg-danger-red group-hover:opacity-100 focus:opacity-100 motion-reduce:transition-none"
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
      className="glass glass-hover group overflow-hidden rounded-lg text-start disabled:opacity-60"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-elevated-panel">
        <img
          src={item.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          draggable={false}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35 motion-reduce:transition-none">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-gold opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none">
            <Play className="h-5 w-5 text-background" fill="currentColor" />
          </span>
        </div>
        {item.durationSeconds > 0 && (
          <span className="media-badge absolute bottom-2 end-2" dir="ltr">
            {formatTime(item.durationSeconds)}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text-primary" title={item.title} dir="auto">
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
