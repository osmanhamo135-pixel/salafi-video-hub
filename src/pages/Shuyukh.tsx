import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  GraduationCap,
  Link2,
  ListVideo,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { QUICK_LIMIT, useShuyukhStore } from '@/store/shuyukhStore';
import { useWatchStore, YoutubeSearchItem } from '@/store/watchStore';
import { formatTime } from '@/utils/formatTime';
import { Tilt } from '@/components/ui/Tilt';
import { WatchPlayer } from '@/pages/Watch';
import { useI18n } from '@/i18n';

/**
 * The Shuyukh page — profiles for the mashayikh the owner names, each
 * carrying that shaykh's channel, kept current, with a running count of what
 * is new since the reader last looked.
 *
 * Playback goes through the app's own ad-free stream resolver (the Watch
 * machinery), so a lesson opened from here plays with no ads, no overlays,
 * and no recommendations rail — the whole reason this app exists.
 */
export const Shuyukh: React.FC = () => {
  const { t } = useI18n();
  const profiles = useShuyukhStore((s) => s.profiles);
  const refreshStale = useShuyukhStore((s) => s.refreshStale);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void refreshStale();
  }, [refreshStale]);

  const open = profiles.find((p) => p.id === openId) ?? null;

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-6">
          <div className="premium-pill mb-2">
            <GraduationCap className="h-3.5 w-3.5" />
            {t('shuyukhPill')}
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-text-primary">
            {t('shuyukhTitle')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-text">{t('shuyukhSubtitle')}</p>
        </div>

        <AddProfileForm />

        {profiles.length === 0 ? (
          <div className="glass mt-8 rounded-lg px-8 py-16 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-accent-gold/60" />
            <p className="mt-5 text-lg font-medium text-text-primary">{t('shuyukhEmptyTitle')}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-text">{t('shuyukhEmptyHint')}</p>
          </div>
        ) : open ? (
          <ProfileDetail profileId={open.id} onBack={() => setOpenId(null)} />
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard key={profile.id} profileId={profile.id} onOpen={() => setOpenId(profile.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AddProfileForm: React.FC = () => {
  const { t } = useI18n();
  const addProfile = useShuyukhStore((s) => s.addProfile);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !url.trim() || busy) return;
    setBusy(true);
    try {
      const created = await addProfile(name, url);
      if (created) {
        setName('');
        setUrl('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="min-w-[14rem] flex-1">
        <span className="mb-1 block text-[11px] font-medium text-muted-text">
          {t('shuyukhNameLabel')}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('shuyukhNamePlaceholder')}
          className="field-quiet w-full"
          dir="auto"
        />
      </label>
      <label className="min-w-[18rem] flex-[2]">
        <span className="mb-1 block text-[11px] font-medium text-muted-text">
          {t('shuyukhChannelLabel')}
        </span>
        <span className="relative block">
          <Link2 className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/@..."
            className="field-quiet w-full ps-6"
            dir="ltr"
          />
        </span>
      </label>
      <button
        type="submit"
        disabled={busy || !name.trim() || !url.trim()}
        className="btn-primary px-5 py-2.5 text-sm"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {t('shuyukhAdd')}
      </button>
    </form>
  );
};

/**
 * The channel's profile picture, with a geometric fallback. The fallback is
 * the page's own cap mark on a soft gold field — never a silhouette or any
 * placeholder "person" glyph (manhaj: no depiction of animate beings in the
 * app's own art; the photo itself is channel content, like a thumbnail).
 */
const ChannelAvatar: React.FC<{ src: string | null; sizeClass: string }> = ({
  src,
  sizeClass,
}) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full bg-accent-gold/10 text-accent-gold ring-1 ring-accent-gold/25 ${sizeClass}`}
      >
        <GraduationCap className="h-[45%] w-[45%]" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover shadow-md ring-1 ring-accent-gold/30 ${sizeClass}`}
    />
  );
};

/** 231000 → "231K" / "٢٣١ ألف", in the reader's language. */
const useCompactNumber = () => {
  const { language } = useI18n();
  return useMemo(
    () =>
      new Intl.NumberFormat(language === 'ar' ? 'ar' : 'en', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    [language],
  );
};

const ProfileCard: React.FC<{ profileId: string; onOpen: () => void }> = ({
  profileId,
  onOpen,
}) => {
  const { t } = useI18n();
  const compact = useCompactNumber();
  const profile = useShuyukhStore((s) => s.profiles.find((p) => p.id === profileId));
  const loading = useShuyukhStore((s) => Boolean(s.loading[profileId]));
  const error = useShuyukhStore((s) => s.errors[profileId] ?? null);
  const catalog = useShuyukhStore((s) => s.catalogs[profileId]);
  const fullyLoaded = useShuyukhStore((s) => Boolean(s.fullyLoaded[profileId]));
  const removeProfile = useShuyukhStore((s) => s.removeProfile);
  if (!profile) return null;

  /* A quick refresh caps at QUICK_LIMIT, so a catalog that fills the cap is
     almost certainly a slice of a longer channel — the count reads "90+"
     until the reader loads the whole channel from the profile. */
  const truncated = Boolean(catalog) && !fullyLoaded && catalog.videos.length >= QUICK_LIMIT;

  return (
    <Tilt max={5}>
      <div className="surface-2 surface-lift glow-edge group relative flex h-full flex-col rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 flex-1 items-center gap-3.5 text-start"
          >
            <ChannelAvatar src={profile.channelAvatar} sizeClass="h-14 w-14" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-text-primary" dir="auto">
                {profile.name}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-text" dir="auto">
                {profile.channelName ?? profile.channelUrl}
              </span>
              {profile.channelHandle && (
                <span className="mt-0.5 block truncate text-[11px] text-muted-text/80" dir="ltr">
                  {profile.channelHandle}
                </span>
              )}
            </span>
          </button>
          {profile.newCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent-gold/15 px-2 py-0.5 text-[11px] font-semibold leading-relaxed text-accent-gold">
              {profile.newCount} {t('shuyukhNew')}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-text">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('shuyukhChecking')}
            </span>
          ) : error ? (
            <span className="min-w-0 break-words text-danger-red">{error}</span>
          ) : catalog ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <ListVideo className="h-3.5 w-3.5 text-accent-gold/70" />
                <span dir="ltr">
                  {catalog.videos.length}
                  {truncated ? '+' : ''}
                </span>{' '}
                {t('shuyukhVideos')}
              </span>
              {profile.subscriberCount != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-accent-gold/70" />
                  {compact.format(profile.subscriberCount)} {t('shuyukhSubscribers')}
                </span>
              )}
            </>
          ) : (
            <span>{t('shuyukhNotChecked')}</span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <button type="button" onClick={onOpen} className="btn-secondary px-3 py-1.5 text-xs">
            {t('shuyukhOpen')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('shuyukhRemoveConfirm'))) removeProfile(profile.id);
            }}
            className="rounded p-1.5 text-muted-text opacity-0 transition-opacity hover:text-danger-red group-hover:opacity-100 focus:opacity-100"
            title={t('remove')}
            aria-label={t('remove')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </Tilt>
  );
};

/** How many lesson cards mount at once. The full catalog of a big channel is
    ten thousand entries; the DOM gets them a page at a time. */
const PAGE_INITIAL = 60;
const PAGE_STEP = 120;

const ProfileDetail: React.FC<{ profileId: string; onBack: () => void }> = ({
  profileId,
  onBack,
}) => {
  const { t } = useI18n();
  const compact = useCompactNumber();
  const profile = useShuyukhStore((s) => s.profiles.find((p) => p.id === profileId));
  const catalog = useShuyukhStore((s) => s.catalogs[profileId]);
  const loading = useShuyukhStore((s) => Boolean(s.loading[profileId]));
  const loadingFull = useShuyukhStore((s) => Boolean(s.loadingFull[profileId]));
  const fullyLoaded = useShuyukhStore((s) => Boolean(s.fullyLoaded[profileId]));
  const error = useShuyukhStore((s) => s.errors[profileId] ?? null);
  const refreshProfile = useShuyukhStore((s) => s.refreshProfile);
  const loadFullCatalog = useShuyukhStore((s) => s.loadFullCatalog);
  const markSeen = useShuyukhStore((s) => s.markSeen);
  const play = useWatchStore((s) => s.play);
  const resolving = useWatchStore((s) => s.resolving);
  const current = useWatchStore((s) => s.current);
  const resolveError = useWatchStore((s) => s.resolveError);
  const newCount = profile?.newCount ?? 0;
  const [filter, setFilter] = useState('');
  /* Playback stays on this page: clicking a lesson opens the ad-free player
     right here instead of bouncing the reader to the Watch route. */
  const [inlinePlayback, setInlinePlayback] = useState(false);
  const playerRef = React.useRef<HTMLDivElement>(null);
  /* The pager reset must land in the SAME render as a filter or profile
     change: with a ten-thousand-lesson catalog paged far down, an effect-based
     reset would first commit one frame of the whole expanded list against the
     new filter before snapping back — a jank spike mid-typing. Deriving the
     count from a key makes the reset atomic. */
  const listKey = `${profileId}\u0000${filter}`;
  const [pager, setPager] = useState({ key: listKey, count: PAGE_INITIAL });
  const visibleCount = pager.key === listKey ? pager.count : PAGE_INITIAL;
  /* The seen boundary as it was when the reader OPENED the profile. markSeen
     below moves the stored pointer to the newest video immediately, and the
     per-video "New" pills must not vanish in the same frame — they mark what
     was new on arrival, for this visit. */
  const seenBoundaryRef = React.useRef(profile?.lastSeenVideoId ?? null);

  /* No retry on error: without the guard this refires the yt-dlp helper in a
     loop for a channel that permanently fails (deleted, private). The reader
     retries deliberately with the Refresh button, which clears the error. */
  useEffect(() => {
    if (!catalog && !loading && !error) void refreshProfile(profileId);
  }, [catalog, loading, error, profileId, refreshProfile]);

  /* Bring the player into view when it opens or switches lessons — the card
     the reader clicked may be far down the grid. */
  useEffect(() => {
    if (inlinePlayback && (resolving || current)) {
      playerRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [inlinePlayback, resolving, current]);

  /* Opening the profile IS seeing it: the badge resets here, on view, not on
     fetch — the whole point of the count is "since I last looked". */
  useEffect(() => {
    if (catalog && newCount >= 0) markSeen(profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, profileId]);

  /* Ids above the seen boundary, as a set — index arithmetic breaks the
     moment the list is filtered. */
  const newIds = useMemo(() => {
    if (!catalog || !seenBoundaryRef.current) return new Set<string>();
    const boundary = catalog.videos.findIndex((v) => v.id === seenBoundaryRef.current);
    if (boundary <= 0) return new Set<string>();
    return new Set(catalog.videos.slice(0, boundary).map((v) => v.id));
  }, [catalog]);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return catalog.videos;
    return catalog.videos.filter((v) => v.title.toLowerCase().includes(needle));
  }, [catalog, filter]);

  const visible = filtered.slice(0, visibleCount);
  const truncated = Boolean(catalog) && !fullyLoaded && catalog.videos.length >= QUICK_LIMIT;

  const handlePlay = (item: YoutubeSearchItem) => {
    setInlinePlayback(true);
    void play(item);
  };

  if (!profile) return null;

  return (
    <section className="mt-8">
      <div className="rule-head mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
          <button type="button" onClick={onBack} className="btn-ghost px-2 py-1 text-xs">
            {t('shuyukhBack')}
          </button>
        </h2>
        <span className="flex shrink-0 items-center gap-2">
          <a
            href={profile.channelUrl}
            target="_blank"
            rel="noreferrer"
            title={profile.channelUrl}
            className="inline-flex items-center gap-1 text-xs text-muted-text hover:text-text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => void refreshProfile(profileId)}
            disabled={loading || loadingFull}
            className="btn-secondary px-2.5 py-1 text-xs"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t('shuyukhRefresh')}
          </button>
        </span>
      </div>

      <div className="mb-5 flex items-center gap-4">
        <ChannelAvatar src={profile.channelAvatar} sizeClass="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-text-primary" dir="auto">
            {profile.name}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-text" dir="auto">
            {profile.channelName ?? profile.channelUrl}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-text">
            {profile.channelHandle && (
              <span dir="ltr" className="text-muted-text/80">
                {profile.channelHandle}
              </span>
            )}
            {profile.subscriberCount != null && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-accent-gold/70" />
                {compact.format(profile.subscriberCount)} {t('shuyukhSubscribers')}
              </span>
            )}
            {catalog && (
              <span className="inline-flex items-center gap-1.5">
                <ListVideo className="h-3.5 w-3.5 text-accent-gold/70" />
                <span dir="ltr">
                  {catalog.videos.length}
                  {truncated ? '+' : ''}
                </span>{' '}
                {t('shuyukhVideos')}
              </span>
            )}
          </p>
        </div>
      </div>

      {inlinePlayback && (resolving || current || resolveError) && (
        <div ref={playerRef}>
          {resolving ? (
            <div className="glass mb-5 flex items-center gap-3 rounded-lg px-4 py-6 text-sm text-muted-text">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('watchLoadingStream')}
            </div>
          ) : resolveError ? (
            <p className="mb-4 text-sm text-danger-red">{resolveError}</p>
          ) : (
            <WatchPlayer />
          )}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-danger-red">{error}</p>}

      {truncated && (
        <div className="glass mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
          <p className="min-w-0 flex-1 text-xs text-muted-text">
            {loadingFull ? t('shuyukhLoadingAll') : t('shuyukhLatestOnly')}
          </p>
          <button
            type="button"
            onClick={() => void loadFullCatalog(profileId)}
            disabled={loadingFull || loading}
            className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
          >
            {loadingFull ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ListVideo className="h-3.5 w-3.5" />
            )}
            {t('shuyukhLoadAll')}
          </button>
        </div>
      )}

      {catalog && catalog.videos.length > 24 && (
        <label className="relative mb-5 block max-w-md">
          <Search className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('shuyukhFilterPlaceholder')}
            className="field-quiet w-full ps-6"
            dir="auto"
          />
        </label>
      )}

      {!catalog && loading && (
        <div className="flex items-center gap-3 py-10 text-muted-text">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('shuyukhChecking')}
        </div>
      )}

      {catalog && filtered.length === 0 && (
        <p className="py-8 text-sm text-muted-text">{t('shuyukhNoMatches')}</p>
      )}

      {catalog && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
          {visible.map((video) => (
            <Tilt key={video.id} max={6}>
              <button
                type="button"
                onClick={() => handlePlay(video)}
                disabled={resolving}
                className="glass glass-hover group block w-full overflow-hidden rounded-lg text-start disabled:opacity-60"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-elevated-panel">
                  <img
                    src={video.thumbnail}
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
                  {newIds.has(video.id) && (
                    <span className="absolute start-2 top-2 rounded-full bg-accent-gold px-2 py-0.5 text-[10px] font-semibold text-background">
                      {t('shuyukhNew')}
                    </span>
                  )}
                  {video.durationSeconds > 0 && (
                    <span
                      className="absolute bottom-2 end-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums text-white"
                      dir="ltr"
                    >
                      {formatTime(video.durationSeconds)}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p
                    className="line-clamp-2 text-xs font-medium leading-snug text-text-primary"
                    title={video.title}
                    dir="auto"
                  >
                    {video.title}
                  </p>
                </div>
              </button>
            </Tilt>
          ))}
        </div>
      )}

      {catalog && filtered.length > visibleCount && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPager({ key: listKey, count: visibleCount + PAGE_STEP })}
            className="btn-secondary px-6 py-2 text-xs"
          >
            {t('shuyukhShowMore')}
          </button>
          <span className="text-[11px] tabular-nums text-muted-text" dir="ltr">
            {visible.length} / {filtered.length}
          </span>
        </div>
      )}
    </section>
  );
};
