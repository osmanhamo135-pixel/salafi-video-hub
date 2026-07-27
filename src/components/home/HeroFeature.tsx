import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Play } from 'lucide-react';
import { ContinueWatchingItem } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { useAppStore } from '@/store/appStore';
import { useQuranStore } from '@/store/quranStore';
import { formatTime } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

/* The fallback has to go on LocalThumbnail's own element, not on the wrapper:
   it renders its fallback div INSIDE the box, so a plate on the parent is
   painted straight over and you get a black rectangle the size of a poster. */
const QUIET_FALLBACK = 'thumbnail-fallback thumbnail-fallback-quiet thumbnail-plate';

/**
 * The Dashboard's working hero.
 *
 * The route used to open on a 416px splash — calligraphy, a tagline and two
 * buttons — above a masthead that restated the sidebar, and only then reached
 * anything the reader could act on. A hero has to do work. This one carries
 * the lesson they were part-way through: artwork, title, speaker, real
 * progress, and Continue as the primary action with the mushaf beside it.
 *
 * When there is no lesson in progress it does not render a shrug. It falls
 * back to the mushaf — last-read position if there is one, al-Fatihah if not —
 * because on a route with nothing to resume, the next useful thing is still
 * reading rather than an apology.
 */
export const HeroFeature: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [item, setItem] = useState<ContinueWatchingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const progressRefreshVersion = useAppStore((s) => s.progressRefreshVersion);
  const importRefreshVersion = useAppStore((s) => s.importRefreshVersion);
  const thumbnailRefreshVersion = useAppStore((s) => s.thumbnailRefreshVersion);

  const lastRead = useQuranStore((s) => s.lastRead);
  const surahs = useQuranStore((s) => s.surahs);
  const openSurah = useQuranStore((s) => s.openSurah);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!loadedRef.current) setLoading(true);
        const data = await invoke<ContinueWatchingItem[]>('get_continue_watching', { limit: 1 });
        if (!cancelled) setItem(data?.[0] ?? null);
      } catch (error) {
        console.error('Failed to load the featured lesson:', error);
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) {
          loadedRef.current = true;
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [importRefreshVersion, progressRefreshVersion, thumbnailRefreshVersion]);

  const openMushaf = () => {
    if (lastRead) void openSurah(lastRead.surahId);
    navigate('/quran');
  };

  const lastSurah = lastRead ? surahs.find((s) => s.id === lastRead.surahId) : undefined;
  const lastSurahName = lastSurah
    ? language === 'ar'
      ? lastSurah.name
      : lastSurah.transliteration
    : null;

  if (loading) return <HeroFeatureSkeleton />;

  /* No lesson in progress — the mushaf becomes the subject rather than the
     card becoming an empty state. */
  if (!item) {
    return (
      <section className="hero-feature glass glow-edge p-6 sm:p-8">
        <div className="jadwal" aria-hidden="true" />
        <div className="relative z-[1] flex flex-col items-start gap-4 py-6 sm:py-10">
          <p className="text-[11px] font-medium text-accent-gold">{t('heroFeatureEyebrowMushaf')}</p>
          <h2 className="max-w-xl text-2xl font-semibold leading-tight text-text-primary sm:text-3xl">
            {lastSurahName ? `${lastSurahName} · ${t('quranAyah')} ${lastRead?.verseId}` : t('heroFeatureMushafTitle')}
          </h2>
          <p className="max-w-lg text-sm text-muted-text">{t('heroFeatureMushafBody')}</p>
          <button type="button" onClick={openMushaf} className="btn-primary mt-1 px-5 py-2.5 text-sm">
            <BookOpen className="h-4 w-4" />
            {lastSurahName ? t('heroContinue') : t('heroFeatureStartFatihah')}
          </button>
        </div>
      </section>
    );
  }

  const { video, playlist } = item;
  const pct = video.durationSeconds
    ? Math.min(100, Math.round((video.progressSeconds / video.durationSeconds) * 100))
    : 0;
  const remaining = Math.max(0, video.durationSeconds - video.progressSeconds);

  const resume = () => {
    if (playlist) {
      void openPlaylist(playlist.id, video.id);
    }
    navigate('/player');
  };

  return (
    <section className="hero-feature glass glow-edge p-4 sm:p-6">
      <div className="jadwal" aria-hidden="true" />

      <div className="relative z-[1] grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-center">
        <div className="hero-feature-art thumbnail-plate">
          <LocalThumbnail
            path={video.thumbnailPath}
            label={video.title}
            className="h-full w-full object-cover"
            fallbackClassName={QUIET_FALLBACK}
            loading="eager"
          />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-medium text-accent-gold">
            {t('heroFeatureEyebrowLesson')}
            {playlist ? ` · ${playlist.name}` : ''}
          </p>

          {/* Latin display tracking only — letter-spacing breaks the joins in
              a cursive script, and this string is user content in either. */}
          <h2
            className={`mt-2 line-clamp-2 font-semibold text-text-primary ${
              language === 'ar'
                ? 'text-2xl leading-[1.35] sm:text-[1.75rem]'
                : 'text-2xl leading-[1.12] tracking-[-0.015em] sm:text-[2rem]'
            }`}
          >
            {video.title}
          </h2>

          {video.speaker && (
            <p className="mt-2 text-sm text-muted-text">{video.speaker}</p>
          )}

          <div className="mt-5 max-w-md">
            <div
              className="hero-feature-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-label={t('continueWatching')}
            >
              <span style={{ width: `${pct}%` }} />
            </div>
            {/* <bdi> so the numeral run cannot reorder against Arabic around it. */}
            <p className="mt-2 text-xs text-muted-text">
              <bdi>{pct}%</bdi> · <bdi>{formatTime(remaining)}</bdi> {t('heroFeatureRemaining')}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={resume} className="btn-primary px-5 py-2.5 text-sm">
              <Play className="h-4 w-4" />
              {t('heroFeatureResume')}
            </button>
            <button type="button" onClick={openMushaf} className="btn-secondary px-5 py-2.5 text-sm">
              <BookOpen className="h-4 w-4" />
              {t('heroOpenMushaf')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

/* Matched to the block it replaces rather than a spinner in a card slot, so
   the layout does not jump when the lesson arrives. */
const HeroFeatureSkeleton: React.FC = () => (
  <section className="hero-feature glass glow-edge p-4 sm:p-6">
    <div className="relative z-[1] grid gap-5 sm:gap-7 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-center">
      <div className="hero-feature-art motion-safe:animate-pulse" />
      <div className="min-w-0">
        <div className="h-3 w-32 rounded bg-panel-hover motion-safe:animate-pulse" />
        <div className="mt-3 h-8 w-4/5 rounded bg-panel-hover motion-safe:animate-pulse" />
        <div className="mt-3 h-4 w-40 rounded bg-panel-hover motion-safe:animate-pulse" />
        <div className="mt-6 h-[3px] w-full max-w-md rounded bg-panel-hover motion-safe:animate-pulse" />
        <div className="mt-6 flex gap-3">
          <div className="h-10 w-32 rounded bg-panel-hover motion-safe:animate-pulse" />
          <div className="h-10 w-36 rounded bg-panel-hover motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  </section>
);
