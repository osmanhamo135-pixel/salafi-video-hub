import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Bookmark,
  Headphones,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  Search,
} from 'lucide-react';
import { AyahTiming, QuranBookmark, SurahMeta, surahAudioUrl, useQuranStore } from '@/store/quranStore';
import { audioElementHolder, seekToSeconds, useRadioStore } from '@/store/radioStore';
import { useI18n } from '@/i18n';

const BASMALA = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';

type QuranTab = 'read' | 'listen';

export const Quran: React.FC = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState<QuranTab>('read');
  const loadSurahs = useQuranStore((state) => state.loadSurahs);
  const surahsError = useQuranStore((state) => state.surahsError);

  useEffect(() => {
    void loadSurahs();
  }, [loadSurahs]);

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-5">
          <div className="premium-pill mb-2">
            <BookOpen className="h-3.5 w-3.5" />
            {t('quranPill')}
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('quranTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-text">{t('quranSubtitle')}</p>
        </div>

        <div className="mb-5 flex gap-2">
          <TabButton active={tab === 'read'} icon={BookOpen} label={t('quranRead')} onClick={() => setTab('read')} />
          <TabButton active={tab === 'listen'} icon={Headphones} label={t('quranListen')} onClick={() => setTab('listen')} />
        </div>

        {surahsError && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-danger-red/25 bg-danger-red/10 p-3 text-xs text-danger-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{surahsError}</span>
          </div>
        )}

        {tab === 'read' ? <ReadTab /> : <ListenTab />}

        <p className="mt-6 text-center text-[11px] text-muted-text">{t('quranAttribution')}</p>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}> = ({ active, icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? 'border-primary-blue/45 bg-primary-blue/15 text-primary-blue'
        : 'border-border bg-panel text-muted-text hover:border-border-strong hover:text-text-primary'
    }`}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

const ReadTab: React.FC = () => {
  const { t } = useI18n();
  const surahs = useQuranStore((state) => state.surahs);
  const currentSurah = useQuranStore((state) => state.currentSurah);
  const loadingSurah = useQuranStore((state) => state.loadingSurah);
  const lastRead = useQuranStore((state) => state.lastRead);
  const openSurah = useQuranStore((state) => state.openSurah);
  const [query, setQuery] = useState('');
  const pendingScrollRef = useRef<number | null>(null);

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalized
        ? surahs.filter(
            (surah) =>
              surah.name.includes(query.trim()) ||
              surah.transliteration.toLowerCase().includes(normalized) ||
              String(surah.id) === normalized,
          )
        : surahs,
    [surahs, normalized, query],
  );

  const handleContinue = () => {
    if (!lastRead) return;
    pendingScrollRef.current = lastRead.verseId;
    void openSurah(lastRead.surahId);
  };

  useEffect(() => {
    if (!currentSurah || pendingScrollRef.current === null) return;
    const verse = pendingScrollRef.current;
    pendingScrollRef.current = null;
    window.setTimeout(() => {
      document
        .getElementById(`quran-verse-${currentSurah.id}-${verse}`)
        ?.scrollIntoView({ block: 'center' });
    }, 60);
  }, [currentSurah]);

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="premium-surface flex max-h-[70vh] flex-col overflow-hidden rounded-lg">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('quranSearchSurah')}
              className="surface-input w-full py-2 ps-10"
            />
          </div>
          {lastRead && (
            <button
              type="button"
              onClick={handleContinue}
              className="btn-secondary mt-2 w-full justify-center px-3 py-1.5 text-xs"
            >
              <BookMarked className="h-3.5 w-3.5" />
              {t('quranContinue')}
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.map((surah) => (
            <SurahRow key={surah.id} surah={surah} active={currentSurah?.id === surah.id} onOpen={() => void openSurah(surah.id)} />
          ))}
        </div>
      </aside>

      <section className="premium-surface ornate-corner relative min-h-[50vh] rounded-lg p-5">
        <div className="gold-thread absolute inset-x-5 top-0" />
        {loadingSurah && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary-blue" />
          </div>
        )}
        {!loadingSurah && !currentSurah && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-primary-blue" />
            <p className="text-sm text-muted-text">{t('quranSelectSurah')}</p>
          </div>
        )}
        {!loadingSurah && currentSurah && <SurahReader />}
      </section>
    </div>
  );
};

const SurahRow: React.FC<{ surah: SurahMeta; active: boolean; onOpen: () => void }> = React.memo(
  ({ surah, active, onOpen }) => {
    const { t } = useI18n();
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`mb-1 flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors ${
          active
            ? 'border-primary-blue/40 bg-primary-blue/10'
            : 'border-transparent hover:bg-panel-hover'
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-blue/12 text-xs font-semibold tabular-nums text-primary-blue">
          {surah.id}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-primary">{surah.transliteration}</span>
          <span className="block truncate text-[11px] text-muted-text">
            {surah.totalVerses} {t('quranVerses')}
          </span>
        </span>
        <span className="quran-script arabic-text shrink-0 text-base text-accent-gold">{surah.name}</span>
      </button>
    );
  },
);

SurahRow.displayName = 'SurahRow';

/** Binary search: index of the last timing segment whose start is <= the clock. */
const findActiveIndex = (timings: AyahTiming[], clock: number): number => {
  let lo = 0;
  let hi = timings.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timings[mid].startMs <= clock) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
};

/**
 * Ayah synchronization engine (Level B — ayah sync). Reads the audio clock
 * every animation frame directly from the media element and updates React
 * state only when the active ayah actually changes.
 */
const useAyahSync = (syncActive: boolean, timings: AyahTiming[] | null, surahId: number | null) => {
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const lastAyahRef = useRef<number | null>(null);
  // Milliseconds multiplier for the timing values; 0 = not yet detected.
  const scaleRef = useRef(0);

  useEffect(() => {
    lastAyahRef.current = null;
    scaleRef.current = 0;
    setActiveAyah(null);
    if (!syncActive || !timings || timings.length === 0 || surahId === null) return;

    let frame = 0;
    const tick = () => {
      const element = audioElementHolder.current;
      if (element) {
        // Some timing sources report seconds instead of milliseconds. Detect
        // the unit once against the real audio duration: if the last segment
        // ends far below duration*10, the values are seconds.
        if (scaleRef.current === 0 && Number.isFinite(element.duration) && element.duration > 0) {
          const lastEnd = timings[timings.length - 1].endMs;
          scaleRef.current = lastEnd < element.duration * 10 ? 1000 : 1;
        }
        if (scaleRef.current !== 0 && !element.paused) {
          // Convert the audio clock into the timing values' native unit.
          const clock = (element.currentTime * 1000) / scaleRef.current;
          const index = findActiveIndex(timings, clock);
          const segment = index >= 0 ? timings[index] : null;
          const next = segment && segment.ayah >= 1 ? segment.ayah : null;

          if (next !== lastAyahRef.current) {
            lastAyahRef.current = next;
            setActiveAyah(next);
          }

          // Drive the green sweep across the ayah text with a direct CSS
          // variable update — the reading direction fill follows the voice.
          if (next !== null && segment) {
            const span = segment.endMs - segment.startMs;
            const progress = span > 0 ? Math.min(Math.max((clock - segment.startMs) / span, 0), 1) : 1;
            document
              .getElementById(`quran-verse-${surahId}-${next}`)
              ?.style.setProperty('--ayah-progress', `${(progress * 100).toFixed(1)}%`);
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [syncActive, timings, surahId]);

  return activeAyah;
};

const SurahReader: React.FC = () => {
  const { t } = useI18n();
  const surah = useQuranStore((state) => state.currentSurah);
  const fontSize = useQuranStore((state) => state.fontSize);
  const showTranslation = useQuranStore((state) => state.showTranslation);
  const lastRead = useQuranStore((state) => state.lastRead);
  const setFontSize = useQuranStore((state) => state.setFontSize);
  const setShowTranslation = useQuranStore((state) => state.setShowTranslation);
  const setLastRead = useQuranStore((state) => state.setLastRead);
  const toggleBookmark = useQuranStore((state) => state.toggleBookmark);
  const bookmarks = useQuranStore((state) => state.bookmarks);
  const timingReads = useQuranStore((state) => state.timingReads);
  const selectedTimingReadId = useQuranStore((state) => state.selectedTimingReadId);
  const loadTimingReads = useQuranStore((state) => state.loadTimingReads);
  const selectTimingRead = useQuranStore((state) => state.selectTimingRead);
  const loadTimings = useQuranStore((state) => state.loadTimings);
  const storeTimings = useQuranStore((state) => state.timings);
  const playStation = useRadioStore((state) => state.play);
  const currentStation = useRadioStore((state) => state.current);
  const [followPaused, setFollowPaused] = useState(false);
  const programmaticScrollRef = useRef(false);

  useEffect(() => {
    void loadTimingReads();
  }, [loadTimingReads]);

  const read = timingReads.find((entry) => entry.id === selectedTimingReadId) ?? timingReads[0];
  const syncStationId = surah && read ? `quran-sync-${read.id}-${surah.id}` : null;
  const syncActive = Boolean(syncStationId && currentStation?.id === syncStationId);
  const timings = surah && read ? storeTimings[`${read.id}:${surah.id}`] ?? null : null;
  const activeAyah = useAyahSync(syncActive, timings, surah?.id ?? null);

  // Follow the recitation: gently keep the active ayah visible, but never
  // fight the user — manual scrolling pauses auto-follow until they return.
  useEffect(() => {
    if (!syncActive || followPaused || activeAyah === null || !surah) return;
    const element = document.getElementById(`quran-verse-${surah.id}-${activeAyah}`);
    if (!element) return;
    programmaticScrollRef.current = true;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeAyah, syncActive, followPaused, surah]);

  useEffect(() => {
    if (!syncActive) {
      setFollowPaused(false);
      return;
    }
    const pauseFollow = () => {
      if (!programmaticScrollRef.current) setFollowPaused(true);
    };
    window.addEventListener('wheel', pauseFollow, { passive: true });
    window.addEventListener('touchmove', pauseFollow, { passive: true });
    return () => {
      window.removeEventListener('wheel', pauseFollow);
      window.removeEventListener('touchmove', pauseFollow);
    };
  }, [syncActive]);

  if (!surah) return null;

  const handlePlaySurah = async () => {
    if (!read) return;
    // Load this reciter's own timing for this surah first (cached after once),
    // then start playback through the global player.
    void loadTimings(read.id, surah.id);
    playStation({
      id: `quran-sync-${read.id}-${surah.id}`,
      name: `${surah.transliteration} · ${read.name}`,
      url: surahAudioUrl(read.folderUrl, surah.id),
    });
    setFollowPaused(false);
  };

  const handleAyahClick = (verseId: number) => {
    setLastRead({ surahId: surah.id, verseId });
    if (syncActive && timings && timings.length > 0) {
      const segment = timings.find((timing) => timing.ayah === verseId);
      if (segment) {
        const element = audioElementHolder.current;
        const lastEnd = timings[timings.length - 1].endMs;
        const valuesAreSeconds =
          element && Number.isFinite(element.duration) && element.duration > 0
            ? lastEnd < element.duration * 10
            : false;
        seekToSeconds(valuesAreSeconds ? segment.startMs : segment.startMs / 1000);
        setFollowPaused(false);
      }
    }
  };

  const handleReturnToAyah = () => {
    setFollowPaused(false);
  };

  const isBookmarked = (bookmark: QuranBookmark) =>
    bookmarks.some((b) => b.surahId === bookmark.surahId && b.verseId === bookmark.verseId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-text">
            <span>
              {surah.id}. {surah.transliteration} — {surah.translation} · {surah.total_verses} {t('quranVerses')}
            </span>
            {syncActive && timings && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-green/15 px-2 py-0.5 font-medium text-success-green">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-green" />
                {t('quranSyncBadge')}
                {activeAyah !== null && <span className="tabular-nums" dir="ltr"> · {activeAyah}</span>}
              </span>
            )}
            {syncActive && !timings && (
              <span className="rounded-full bg-muted-text/15 px-2 py-0.5 font-medium text-muted-text">
                {t('quranSyncUnavailable')}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {timingReads.length > 0 && (
            <select
              value={read?.id ?? ''}
              onChange={(event) => selectTimingRead(event.target.value)}
              className="surface-input max-w-[220px] py-1.5 text-xs"
              title={t('quranSyncedReciter')}
            >
              {timingReads.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          )}
          {read && (
            <button type="button" onClick={() => void handlePlaySurah()} className="btn-secondary px-3 py-1.5 text-xs">
              <Play className="h-3.5 w-3.5" />
              {t('quranPlaySurah')}
            </button>
          )}
          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              onClick={() => setFontSize(fontSize - 2)}
              className="px-2 py-1.5 text-muted-text hover:text-text-primary"
              title="A-"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-xs tabular-nums text-muted-text">{fontSize}</span>
            <button
              type="button"
              onClick={() => setFontSize(fontSize + 2)}
              className="px-2 py-1.5 text-muted-text hover:text-text-primary"
              title="A+"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-text-primary">
            <input
              type="checkbox"
              checked={showTranslation}
              onChange={(event) => setShowTranslation(event.target.checked)}
              className="h-3.5 w-3.5 accent-primary-blue"
            />
            {t('quranTranslation')}
          </label>
        </div>
      </div>

      {syncActive && followPaused && (
        <button
          type="button"
          onClick={handleReturnToAyah}
          className="btn-primary fixed bottom-24 left-1/2 z-30 -translate-x-1/2 px-4 py-2 text-xs shadow-2xl"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {t('quranFollowAyah')}
        </button>
      )}

      <div className="quran-reading-surface mx-auto mt-3 max-w-[54rem]">
        <div className="quran-ornament">
          <span className="quran-ornament-line" />
          <h2
            className="quran-ornament-name quran-script arabic-text font-semibold"
            style={{ fontSize: Math.max(fontSize * 0.95, 24), lineHeight: 1.8 }}
          >
            ﴿ {surah.name} ﴾
          </h2>
          <span className="quran-ornament-line" />
        </div>

        {surah.id !== 1 && surah.id !== 9 && (
          <p
            className="quran-script arabic-text mb-8 text-center text-accent-gold"
            style={{ fontSize: fontSize * 0.85, lineHeight: 2 }}
          >
            {BASMALA}
          </p>
        )}

        <div className="space-y-2">
          {surah.verses.map((verse) => {
            const bookmark = { surahId: surah.id, verseId: verse.id };
            const marked = isBookmarked(bookmark);
            const isLastRead = lastRead?.surahId === surah.id && lastRead?.verseId === verse.id;
            const isActive = syncActive && activeAyah === verse.id;

            return (
              <div
                key={verse.id}
                id={`quran-verse-${surah.id}-${verse.id}`}
                onClick={() => handleAyahClick(verse.id)}
                className={`quran-ayah group cursor-pointer rounded-xl px-4 py-3.5 ${
                  isActive
                    ? 'quran-ayah-active'
                    : isLastRead
                      ? 'bg-primary-blue/[0.07] ring-1 ring-primary-blue/25'
                      : 'hover:bg-panel-hover/60'
                }`}
              >
                <p
                  dir="rtl"
                  className="quran-ayah-text quran-script arabic-text text-text-primary"
                  style={{ fontSize, lineHeight: 2.35 }}
                >
                  {verse.text}
                  <span
                    className="quran-verse-num"
                    style={{
                      width: Math.round(fontSize * 1.3),
                      height: Math.round(fontSize * 1.3),
                      fontSize: Math.max(Math.round(fontSize * 0.34), 10),
                    }}
                  >
                    {verse.id}
                  </span>
                </p>
                {showTranslation && (
                  <p dir="ltr" className="quran-translation mt-2 text-sm leading-relaxed">
                    {verse.translation}
                  </p>
                )}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleBookmark(bookmark);
                  }}
                  title={t('quranBookmark')}
                  className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-opacity ${
                    marked
                      ? 'text-accent-gold opacity-100'
                      : 'text-muted-text opacity-0 hover:text-accent-gold group-hover:opacity-100'
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" fill={marked ? 'currentColor' : 'none'} />
                  {t('quranBookmark')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ListenTab: React.FC = () => {
  const { t, language } = useI18n();
  const surahs = useQuranStore((state) => state.surahs);
  const reciters = useQuranStore((state) => state.reciters);
  const recitersLoading = useQuranStore((state) => state.recitersLoading);
  const recitersError = useQuranStore((state) => state.recitersError);
  const selectedReciterId = useQuranStore((state) => state.selectedReciterId);
  const loadReciters = useQuranStore((state) => state.loadReciters);
  const selectReciter = useQuranStore((state) => state.selectReciter);
  const playStation = useRadioStore((state) => state.play);
  const current = useRadioStore((state) => state.current);
  const playing = useRadioStore((state) => state.playing);
  const togglePlay = useRadioStore((state) => state.togglePlay);
  const [reciterQuery, setReciterQuery] = useState('');

  useEffect(() => {
    void loadReciters(language === 'ar' ? 'ar' : 'eng');
  }, [language, loadReciters]);

  const reciter = reciters.find((entry) => entry.id === selectedReciterId) ?? reciters[0];
  const normalized = reciterQuery.trim().toLowerCase();
  const filteredReciters = normalized
    ? reciters.filter((entry) => entry.name.toLowerCase().includes(normalized))
    : reciters;
  const availableSurahs =
    reciter && reciter.availableSurahs.length > 0
      ? surahs.filter((surah) => reciter.availableSurahs.includes(surah.id))
      : surahs;

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="premium-surface flex max-h-[70vh] flex-col overflow-hidden rounded-lg">
        <div className="border-b border-border p-3">
          <p className="mb-2 text-xs font-semibold text-text-primary">{t('quranReciters')}</p>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={reciterQuery}
              onChange={(event) => setReciterQuery(event.target.value)}
              placeholder={t('quranSearchReciter')}
              className="surface-input w-full py-2 ps-10"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {recitersLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary-blue" />
            </div>
          )}
          {recitersError && !recitersLoading && (
            <p className="p-3 text-xs text-danger-red">{recitersError}</p>
          )}
          {filteredReciters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectReciter(entry.id)}
              className={`mb-1 w-full rounded-md border px-3 py-2 text-start transition-colors ${
                reciter?.id === entry.id
                  ? 'border-primary-blue/40 bg-primary-blue/10'
                  : 'border-transparent hover:bg-panel-hover'
              }`}
            >
              <span className="block truncate text-sm font-medium text-text-primary">{entry.name}</span>
              <span className="block truncate text-[11px] text-muted-text">{entry.moshafName}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="premium-surface rounded-lg p-4">
        {reciter ? (
          <>
            <p className="mb-3 text-sm font-semibold text-text-primary">{reciter.name}</p>
            <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4">
              {availableSurahs.map((surah) => {
                const stationId = `quran-${reciter.id}-${surah.id}`;
                const isCurrent = current?.id === stationId;
                return (
                  <button
                    key={surah.id}
                    type="button"
                    onClick={() =>
                      isCurrent
                        ? togglePlay()
                        : playStation({
                            id: stationId,
                            name: `${surah.transliteration} · ${reciter.name}`,
                            url: surahAudioUrl(reciter.server, surah.id),
                          })
                    }
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-start transition-colors ${
                      isCurrent
                        ? 'border-primary-blue/45 bg-primary-blue/10'
                        : 'border-border bg-background/50 hover:border-border-strong hover:bg-panel-hover'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-blue/12 text-[10px] font-semibold tabular-nums text-primary-blue">
                      {surah.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">
                      {surah.transliteration}
                    </span>
                    {isCurrent && playing ? (
                      <Pause className="h-3.5 w-3.5 shrink-0 text-primary-blue" fill="currentColor" />
                    ) : (
                      <Play className="h-3.5 w-3.5 shrink-0 text-muted-text" fill="currentColor" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          !recitersLoading && <p className="py-10 text-center text-sm text-muted-text">{recitersError ?? ''}</p>
        )}
      </section>
    </div>
  );
};
