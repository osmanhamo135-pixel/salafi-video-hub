import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Play, PlayCircle } from 'lucide-react';
import { ContinueWatchingItem } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { useAppStore } from '@/store/appStore';
import { formatTime } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { SectionHead } from '@/components/ui/SectionHead';
import { useI18n } from '@/i18n';

/* .thumbnail-fallback bakes in an .icon-medallion (primary-blue border + fill)
   and a teal underline, which puts a second accent in every un-thumbnailed row.
   Neutralise both from the call site; the primitive itself is not ours to edit. */
const QUIET_FALLBACK = 'thumbnail-fallback thumbnail-fallback-quiet';

/* Arabic has no case, and letter-spacing BREAKS the joining of Arabic
   letterforms — so the eyebrow's tracking is applied to Latin only. */
export const useEyebrowClass = () => {
  const { language } = useI18n();
  return language === 'ar'
    ? 'text-[11px] font-medium text-muted-text'
    : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-text';
};

export const ContinueWatching: React.FC = () => {
  const { t } = useI18n();
  const eyebrow = useEyebrowClass();
  const navigate = useNavigate();
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const progressRefreshVersion = useAppStore((s) => s.progressRefreshVersion);
  const thumbnailRefreshVersion = useAppStore((s) => s.thumbnailRefreshVersion);
  const importRefreshVersion = useAppStore((s) => s.importRefreshVersion);

  useEffect(() => {
    let cancelled = false;
    const fetchItems = async () => {
      try {
        if (!loadedRef.current) setLoading(true);
        const data = await invoke<ContinueWatchingItem[]>('get_continue_watching', { limit: 20 });
        if (!cancelled) setItems(data || []);
      } catch (error) {
        console.error('Failed to load continue watching:', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) {
          loadedRef.current = true;
          setLoading(false);
        }
      }
    };
    fetchItems();
    return () => {
      cancelled = true;
    };
  }, [importRefreshVersion, progressRefreshVersion, thumbnailRefreshVersion]);

  const handlePlay = (item: ContinueWatchingItem) => {
    if (item.playlist) {
      openPlaylist(item.playlist.id, item.video.id);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: ContinueWatchingItem[] }>();

    /* The first item is the featured card at the top of the route — repeating
       it here as this section's lead put the same lesson on screen twice,
       at size, one viewport apart. This section owns everything after it. */
    for (const item of items.slice(1)) {
      const key = item.playlist?.id ?? item.video.folderPath ?? 'standalone';
      const title = item.playlist?.name ?? item.video.folderPath.split(/[\\/]/).filter(Boolean).pop() ?? t('standaloneVideos');
      const group = map.get(key);

      if (group) {
        group.items.push(item);
      } else {
        map.set(key, { title, items: [item] });
      }
    }

    return Array.from(map.entries()).map(([key, group]) => ({ key, ...group }));
  }, [items]);

  const [lead, ...rest] = groups;

  /* Everything this section could show is already on the featured card above:
     with zero or one lesson in progress there is nothing here but an empty
     shrug directly underneath a hero that is carrying that same lesson. */
  if (!loading && items.length <= 1) return null;

  return (
    /* The most useful thing on the page, so it is the first thing after the
       masthead and the only place below the hero that carries an image at
       size. Everything under it is deliberately quieter. */
    <section className="reveal mt-9">
      <SectionHead
        className="mb-5"
        title={t('continueWatching')}
        meta={!loading && items.length > 0 ? <bdi>{items.length}</bdi> : undefined}
      />

      {loading ? (
        <FeatureSkeleton />
      ) : !lead ? (
        <div className="glass rounded-lg px-8 py-16 text-center">
          <span
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-border"
            style={{ background: 'rgb(var(--accent-gold-rgb) / 0.06)' }}
          >
            <PlayCircle className="h-7 w-7 text-accent-gold/70" />
          </span>
          <p className="mt-6 text-lg font-medium text-text-primary">{t('noVideosInProgress')}</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-text">{t('startWatchingHint')}</p>
          <button type="button" onClick={() => navigate('/library')} className="btn-secondary mt-7">
            {t('openLibrary')}
          </button>
        </div>
      ) : (
        /* The rail only earns its own column once the card can still be wide
           enough to hold a two-line title beside its media — below that it
           stacks under the card behind a rule instead. */
        <div
          className={
            rest.length > 0
              ? 'grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)] xl:gap-12'
              : 'grid'
          }
        >
          <FeatureCard group={lead} onPlay={handlePlay} />
          {rest.length > 0 && (
            <div className="border-t border-border pt-6 xl:border-t-0 xl:border-s xl:border-border xl:pt-0 xl:ps-12">
              <p className={`${eyebrow} mb-1`}>{t('inProgress')}</p>
              <div className="flex flex-col">
                {rest.slice(0, 4).map((group) => (
                  <QueueRow
                    key={group.key}
                    title={group.title}
                    item={group.items[0]}
                    onPlay={handlePlay}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const percentOf = (item: ContinueWatchingItem) =>
  item.video.durationSeconds
    ? Math.min(Math.max((item.video.progressSeconds / item.video.durationSeconds) * 100, 0), 100)
    : 0;

/* The resume card. One tab stop: the whole card is the control, and the
   "Continue" affordance inside it is a span wearing the button's clothes —
   a nested <button> would be invalid and would split the hit target. */
const FeatureCard: React.FC<{
  group: { title: string; items: ContinueWatchingItem[] };
  onPlay: (item: ContinueWatchingItem) => void;
}> = ({ group, onPlay }) => {
  const { t } = useI18n();
  const item = group.items[0];
  const percent = percentOf(item);
  const canPlay = !!item.playlist;
  const remaining = Math.max(item.video.durationSeconds - item.video.progressSeconds, 0);

  return (
    <button
      type="button"
      onClick={() => canPlay && onPlay(item)}
      disabled={!canPlay}
      className="glass glass-hover group w-full overflow-hidden rounded-lg text-start disabled:cursor-default"
    >
      <div className="grid sm:grid-cols-[minmax(0,40%)_minmax(0,1fr)]">
        <div className="relative aspect-video w-full overflow-hidden sm:aspect-auto sm:min-h-[15rem]">
          {/* The placeholder's own medallion is suppressed rather than shown
              alongside the play mark: two circles land on the same centre and
              read as a rendering fault. The card supplies the one mark. */}
          <LocalThumbnail
            path={item.video.thumbnailPath}
            label={item.video.title}
            className="h-full w-full object-cover"
            iconClassName="h-7 w-7 opacity-0"
            fallbackClassName={QUIET_FALLBACK}
          />
          {/* Bottom-weighted scrim so the progress rail has something to sit on
              without flattening the still, plus a single warm sweep from the
              same direction as the hero's key light — enough that an
              un-thumbnailed slot reads as a lit surface rather than a hole. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(200deg, rgb(var(--accent-gold-rgb) / 0.07), transparent 58%), linear-gradient(to bottom, transparent 52%, rgb(var(--bg-main-rgb) / 0.42))',
            }}
          />
          {canPlay && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span
                className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-accent-gold/45 text-accent-gold motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:scale-105"
                style={{
                  background: 'rgb(var(--bg-main-rgb) / 0.55)',
                  boxShadow: '0 0 0 1px rgb(var(--accent-gold-rgb) / 0.12)',
                }}
              >
                <Play className="h-6 w-6 fill-current" />
              </span>
            </span>
          )}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 block h-1"
            style={{ background: 'rgb(var(--bg-main-rgb) / 0.5)' }}
          >
            <span
              className="block h-full"
              style={{ width: `${percent}%`, background: 'rgb(var(--accent-gold-rgb))' }}
            />
          </span>
        </div>

        <div className="flex min-w-0 flex-col justify-center gap-3 p-6 sm:p-9">
          <p className="truncate text-xs text-muted-text" title={group.title}>
            <bdi>{group.title}</bdi>
            {group.items.length > 1 && (
              <span className="text-text-faint">
                {' · '}
                <bdi className="tabular-nums">+{group.items.length - 1}</bdi>
              </span>
            )}
          </p>

          <h3
            className="line-clamp-2 text-xl font-semibold leading-snug text-text-primary sm:text-2xl"
            title={item.video.title}
          >
            <bdi>{item.video.title}</bdi>
          </h3>

          <div className="mt-1">
            <div
              className="h-[3px] w-full rounded-full"
              style={{ background: 'rgb(var(--text-muted-rgb) / 0.18)' }}
            >
              <div
                className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
                style={{ width: `${percent}%`, background: 'rgb(var(--accent-gold-rgb))' }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-3 text-xs text-muted-text">
              <span className="tabular-nums">
                <bdi>{Math.round(percent)}%</bdi>
              </span>
              {/* One LTR run: two <bdi>s either side of a neutral slash swap
                  places under the bidi algorithm and report the wrong time. */}
              <span dir="ltr" className="tabular-nums text-text-faint">
                {formatTime(item.video.progressSeconds)} / {formatTime(item.video.durationSeconds)}
              </span>
            </div>
          </div>

          {canPlay && (
            /* Looks and hit-tests as the card's call to action without being a
               nested <button>, which would be invalid and split the target. */
            <span className="mt-3 inline-flex w-fit items-center gap-2.5 rounded-md border border-accent-gold/45 px-4 py-2 text-sm font-medium text-accent-gold transition-colors group-hover:border-accent-gold group-hover:bg-accent-gold/10">
              <Play className="h-3.5 w-3.5 fill-current" />
              {t('continue')}
              <span className="tabular-nums text-accent-gold/60" dir="ltr">
                {formatTime(remaining)}
              </span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

/* The rail: no images, no icons, just a title, a percentage and a hairline
   meter — deliberately a different density from the card beside it. */
const QueueRow: React.FC<{
  title: string;
  item: ContinueWatchingItem;
  onPlay: (item: ContinueWatchingItem) => void;
}> = ({ title, item, onPlay }) => {
  const percent = percentOf(item);
  const canPlay = !!item.playlist;

  return (
    <button
      type="button"
      onClick={() => canPlay && onPlay(item)}
      disabled={!canPlay}
      className="group border-b border-border py-4 text-start last:border-b-0 disabled:cursor-default"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="truncate text-sm text-text-primary transition-colors group-hover:text-accent-gold"
          title={item.video.title}
        >
          <bdi>{item.video.title}</bdi>
        </p>
        <span className="shrink-0 text-[11px] tabular-nums text-text-faint">
          <bdi>{Math.round(percent)}%</bdi>
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-text" title={title}>
        <bdi>{title}</bdi>
      </p>
      <div className="mt-3 h-px w-full" style={{ background: 'rgb(var(--text-muted-rgb) / 0.18)' }}>
        <div
          className="h-px"
          style={{ width: `${percent}%`, background: 'rgb(var(--accent-gold-rgb) / 0.75)' }}
        />
      </div>
    </button>
  );
};

const FeatureSkeleton: React.FC = () => (
  <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)] xl:gap-12">
    <div className="glass overflow-hidden rounded-lg">
      <div className="grid sm:grid-cols-[minmax(0,40%)_minmax(0,1fr)]">
        <div className="aspect-video w-full bg-panel-hover motion-safe:animate-pulse" />
        <div className="flex flex-col justify-center gap-4 p-8">
          <div className="h-3 w-24 rounded bg-panel-hover motion-safe:animate-pulse" />
          <div className="h-5 w-3/4 rounded bg-panel-hover motion-safe:animate-pulse" />
          <div className="h-[3px] w-full rounded bg-panel-hover motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
    <div className="border-t border-border pt-6 xl:border-t-0 xl:border-s xl:border-border xl:pt-0 xl:ps-12">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border-b border-border py-4 last:border-b-0">
          <div className="h-3 w-3/5 rounded bg-panel-hover motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-2/5 rounded bg-panel-hover motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);
