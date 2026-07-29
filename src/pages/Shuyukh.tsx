import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  GraduationCap,
  Link2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useShuyukhStore } from '@/store/shuyukhStore';
import { useWatchStore, YoutubeSearchItem } from '@/store/watchStore';
import { formatTime } from '@/utils/formatTime';
import { Tilt } from '@/components/ui/Tilt';
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

const ProfileCard: React.FC<{ profileId: string; onOpen: () => void }> = ({
  profileId,
  onOpen,
}) => {
  const { t } = useI18n();
  const profile = useShuyukhStore((s) => s.profiles.find((p) => p.id === profileId));
  const loading = useShuyukhStore((s) => Boolean(s.loading[profileId]));
  const error = useShuyukhStore((s) => s.errors[profileId] ?? null);
  const catalog = useShuyukhStore((s) => s.catalogs[profileId]);
  const removeProfile = useShuyukhStore((s) => s.removeProfile);
  if (!profile) return null;

  return (
    <Tilt max={5}>
      <div className="surface-2 surface-lift glow-edge group relative flex h-full flex-col rounded-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start">
            <p className="truncate text-base font-semibold text-text-primary" dir="auto">
              {profile.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-text" dir="auto">
              {profile.channelName ?? profile.channelUrl}
            </p>
          </button>
          {profile.newCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent-gold/15 px-2 py-0.5 text-[11px] font-semibold leading-relaxed text-accent-gold">
              {profile.newCount} {t('shuyukhNew')}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-text">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('shuyukhChecking')}
            </span>
          ) : error ? (
            <span className="min-w-0 break-words text-danger-red">{error}</span>
          ) : catalog ? (
            <span>
              {catalog.videos.length} {t('shuyukhVideos')}
            </span>
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

const ProfileDetail: React.FC<{ profileId: string; onBack: () => void }> = ({
  profileId,
  onBack,
}) => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const profile = useShuyukhStore((s) => s.profiles.find((p) => p.id === profileId));
  const catalog = useShuyukhStore((s) => s.catalogs[profileId]);
  const loading = useShuyukhStore((s) => Boolean(s.loading[profileId]));
  const error = useShuyukhStore((s) => s.errors[profileId] ?? null);
  const refreshProfile = useShuyukhStore((s) => s.refreshProfile);
  const markSeen = useShuyukhStore((s) => s.markSeen);
  const play = useWatchStore((s) => s.play);
  const resolving = useWatchStore((s) => s.resolving);
  const newCount = profile?.newCount ?? 0;
  /* The seen boundary as it was when the reader OPENED the profile. markSeen
     below moves the stored pointer to the newest video immediately, and the
     per-video "New" pills must not vanish in the same frame — they mark what
     was new on arrival, for this visit. */
  const seenBoundaryRef = React.useRef(profile?.lastSeenVideoId ?? null);

  useEffect(() => {
    if (!catalog && !loading) void refreshProfile(profileId);
  }, [catalog, loading, profileId, refreshProfile]);

  /* Opening the profile IS seeing it: the badge resets here, on view, not on
     fetch — the whole point of the count is "since I last looked". */
  useEffect(() => {
    if (catalog && newCount >= 0) markSeen(profileId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, profileId]);

  const handlePlay = (item: YoutubeSearchItem) => {
    void play(item);
    navigate('/watch');
  };

  if (!profile) return null;

  return (
    <section className="mt-8">
      <div className="rule-head mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-text-primary">
          <button type="button" onClick={onBack} className="btn-ghost px-2 py-1 text-xs">
            {t('shuyukhBack')}
          </button>
          <bdi className="truncate">{profile.name}</bdi>
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
            disabled={loading}
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

      {error && <p className="mb-4 text-sm text-danger-red">{error}</p>}

      {!catalog && loading && (
        <div className="flex items-center gap-3 py-10 text-muted-text">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('shuyukhChecking')}
        </div>
      )}

      {catalog && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
          {catalog.videos.map((video, index) => (
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
                  {seenBoundaryRef.current &&
                    index <
                      Math.max(
                        catalog.videos.findIndex((v) => v.id === seenBoundaryRef.current),
                        0,
                      ) && (
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
    </section>
  );
};
