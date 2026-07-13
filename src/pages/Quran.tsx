import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Headphones,
  Loader2,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
} from 'lucide-react';
import {
  AyahTiming,
  QuranBookmark,
  SurahMeta,
  SyncedSurahAudio,
  surahAudioUrl,
  useQuranStore,
} from '@/store/quranStore';
import { audioElementHolder, seekToSeconds, useRadioStore } from '@/store/radioStore';
import { useI18n } from '@/i18n';

const BASMALA_TEXT = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
const BASMALA_LIGATURE = '﷽';

type QuranTab = 'read' | 'listen';
type QuranRepeatMode = 'off' | 'ayah' | 'range' | 'surah';

interface QuranRepeatSelection {
  mode: QuranRepeatMode;
  startAyah: number;
  endAyah: number;
}

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
function findActiveIndex<T extends { startMs: number }>(timings: T[], clock: number): number {
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
}

/**
 * Positions the gliding recitation cue over one word. The cue is a single
 * absolutely-positioned pill inside the reading surface; CSS transitions make
 * it glide smoothly between verified word boundaries — the geometry animates,
 * never the timing, so the cue can never point at a word that is not being
 * recited.
 */
const positionWordCue = (cue: HTMLElement, word: HTMLElement) => {
  const container = cue.offsetParent as HTMLElement | null;
  if (!container) return;
  const wordRect = word.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  if (wordRect.width <= 0 || wordRect.height <= 0) return;
  // Size the pill from the glyph size, not the font's tall line box, and
  // center it on the word so it hugs the letters instead of a tall rectangle.
  const glyphSize = parseFloat(window.getComputedStyle(word).fontSize) || wordRect.height;
  const cueHeight = Math.min(glyphSize * 1.32, wordRect.height);
  const padX = glyphSize * 0.16;
  const top = wordRect.top + (wordRect.height - cueHeight) / 2 - containerRect.top;
  cue.style.opacity = '1';
  cue.style.transform = `translate(${wordRect.left - containerRect.left - padX}px, ${top}px)`;
  cue.style.width = `${wordRect.width + padX * 2}px`;
  cue.style.height = `${cueHeight}px`;
};

/**
 * Timing values are milliseconds for the word-exact recordings, but some
 * ayah-timing sources publish seconds. Detected once against the real audio
 * duration: the multiplier converts the audio clock into the timing values'
 * own unit — measured, never assumed.
 */
const detectClockScale = (timings: AyahTiming[], durationSeconds: number): number => {
  const lastEnd = timings[timings.length - 1]?.endMs ?? 0;
  return lastEnd < durationSeconds * 10 ? 1 : 1000;
};

/**
 * Exact word synchronization. React only updates when the ayah changes; the
 * currently spoken word is switched directly on the DOM so long surahs remain
 * smooth and do not re-render on every word.
 */
const useWordSync = (
  syncActive: boolean,
  synced: SyncedSurahAudio | null,
  surahId: number | null,
  repeat: QuranRepeatSelection,
) => {
  const [activeAyah, setActiveAyah] = useState<number | null>(null);
  const lastAyahRef = useRef<number | null>(null);
  const activeWordElementRef = useRef<HTMLElement | null>(null);
  const lastLoopAtRef = useRef(0);
  // Clock multiplier for the timing values; 0 = not yet detected.
  const scaleRef = useRef(0);

  useEffect(() => {
    lastAyahRef.current = null;
    scaleRef.current = 0;
    activeWordElementRef.current?.classList.remove('quran-word-active');
    activeWordElementRef.current = null;
    setActiveAyah(null);
    const hideCue = () => {
      if (surahId !== null) {
        const cue = document.getElementById(`quran-cue-${surahId}`);
        if (cue) cue.style.opacity = '0';
      }
    };
    hideCue();
    if (!syncActive || !synced || surahId === null) return;

    const { ayahTimings, wordTimings } = synced;
    if (ayahTimings.length === 0) return;

    let frame = 0;
    let frameCount = 0;
    const tick = () => {
      const element = audioElementHolder.current;
      if (element && !element.paused) {
        if (scaleRef.current === 0 && Number.isFinite(element.duration) && element.duration > 0) {
          scaleRef.current = detectClockScale(ayahTimings, element.duration);
        }
        if (scaleRef.current === 0) {
          // Wait for the audio duration before tracking — no unit guessing.
          frame = requestAnimationFrame(tick);
          return;
        }
        let clock = element.currentTime * scaleRef.current;
        frameCount += 1;

        if (repeat.mode === 'ayah' || repeat.mode === 'range') {
          const first = ayahTimings.find((timing) => timing.ayah === repeat.startAyah);
          const last = ayahTimings.find((timing) => timing.ayah === repeat.endAyah);
          const now = performance.now();
          if (
            first &&
            last &&
            clock >= last.endMs - 45 &&
            clock > first.startMs + 120 &&
            now - lastLoopAtRef.current > 250
          ) {
            lastLoopAtRef.current = now;
            element.currentTime = first.startMs / scaleRef.current;
            clock = first.startMs;
          }
        }

        const ayahIndex = findActiveIndex(ayahTimings, clock);
        const ayahSegment = ayahIndex >= 0 ? ayahTimings[ayahIndex] : null;
        // Segment "ayah 0" is the opening basmala/isti'adhah in some ayah
        // timing sources — nothing is highlighted for it (it is not an ayah).
        const nextAyah =
          ayahSegment && ayahSegment.ayah >= 1 && clock <= ayahSegment.endMs + 160
            ? ayahSegment.ayah
            : null;
        if (nextAyah !== lastAyahRef.current) {
          lastAyahRef.current = nextAyah;
          setActiveAyah(nextAyah);
        }

        const wordIndex = findActiveIndex(wordTimings, clock);
        const word = wordIndex >= 0 ? wordTimings[wordIndex] : null;
        const nextWordElement =
          word && clock <= word.endMs + 90
            ? document.getElementById(`quran-word-${surahId}-${word.ayah}-${word.wordIndex}`)
            : null;
        const cue = document.getElementById(`quran-cue-${surahId}`);
        if (nextWordElement !== activeWordElementRef.current) {
          activeWordElementRef.current?.classList.remove('quran-word-active');
          nextWordElement?.classList.add('quran-word-active');
          activeWordElementRef.current = nextWordElement;
          if (cue) {
            if (nextWordElement) positionWordCue(cue, nextWordElement);
            else cue.style.opacity = '0';
          }
        } else if (cue && nextWordElement && frameCount % 30 === 0) {
          // Re-anchor occasionally so font-size changes or resizes while a
          // long word is recited cannot leave the cue misplaced.
          positionWordCue(cue, nextWordElement);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      activeWordElementRef.current?.classList.remove('quran-word-active');
      activeWordElementRef.current = null;
      hideCue();
    };
  }, [repeat, syncActive, synced, surahId]);

  return activeAyah;
};

const QuranVerseWords: React.FC<{
  surahId: number;
  ayah: number;
  text: string;
  syncedWords?: string[];
}> = React.memo(({ surahId, ayah, text, syncedWords }) => {
  const words = syncedWords?.length ? syncedWords : text.trim().split(/\s+/u).filter(Boolean);

  return (
    <span className="quran-ayah-text">
      {words.map((word, index) => (
        <React.Fragment key={`${ayah}-${index}`}>
          <span
            id={`quran-word-${surahId}-${ayah}-${index + 1}`}
            className="quran-word"
          >
            {word}
          </span>{' '}
        </React.Fragment>
      ))}
    </span>
  );
});

QuranVerseWords.displayName = 'QuranVerseWords';

const SurahReader: React.FC = () => {
  const { t, language } = useI18n();
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
  const loadSyncedAudio = useQuranStore((state) => state.loadSyncedAudio);
  const syncedAudioBySurah = useQuranStore((state) => state.syncedAudio);
  const syncedAudioError = useQuranStore((state) => state.syncedAudioError);
  const playStation = useRadioStore((state) => state.play);
  const setLooping = useRadioStore((state) => state.setLooping);
  const currentStation = useRadioStore((state) => state.current);
  const [followPaused, setFollowPaused] = useState(false);
  const [preparingAudio, setPreparingAudio] = useState(false);
  const [repeatMode, setRepeatMode] = useState<QuranRepeatMode>('off');
  const [repeatStart, setRepeatStart] = useState(1);
  const [repeatEnd, setRepeatEnd] = useState(1);
  const programmaticScrollRef = useRef(false);
  const pendingInitialSeekRef = useRef<number | null>(null);

  useEffect(() => {
    void loadTimingReads();
  }, [loadTimingReads]);

  const read = timingReads.find((entry) => entry.id === selectedTimingReadId) ?? timingReads[0];
  const readName = read ? (language === 'ar' ? read.nameAr ?? read.name : read.name) : '';
  const syncStationId = surah && read ? `quran-sync-${read.id}-${surah.id}` : null;
  const syncActive = Boolean(syncStationId && currentStation?.id === syncStationId);
  const synced = surah && read ? syncedAudioBySurah[`${read.id}:${surah.id}`] ?? null : null;
  const syncedWordsByAyah = useMemo(
    () => new Map(synced?.wordsByAyah.map((entry) => [entry.ayah, entry.words]) ?? []),
    [synced],
  );
  const repeatSelection = useMemo<QuranRepeatSelection>(
    () => ({ mode: repeatMode, startAyah: repeatStart, endAyah: repeatEnd }),
    [repeatEnd, repeatMode, repeatStart],
  );
  const activeAyah = useWordSync(syncActive, synced, surah?.id ?? null, repeatSelection);

  useEffect(() => {
    if (!surah) return;
    setRepeatMode('off');
    setRepeatStart(1);
    setRepeatEnd(1);
  }, [surah?.id]);

  useEffect(() => {
    if (!syncActive) return;
    setLooping(repeatMode === 'surah');
  }, [repeatMode, setLooping, syncActive]);

  useEffect(() => {
    if (!syncActive || pendingInitialSeekRef.current === null) return;
    let cancelled = false;
    let timer = 0;
    const applyPendingSeek = () => {
      if (cancelled || pendingInitialSeekRef.current === null) return;
      const element = audioElementHolder.current;
      if (element && Number.isFinite(element.duration) && element.duration > 0) {
        const scale = synced ? detectClockScale(synced.ayahTimings, element.duration) : 1000;
        element.currentTime = pendingInitialSeekRef.current / scale;
        pendingInitialSeekRef.current = null;
        return;
      }
      timer = window.setTimeout(applyPendingSeek, 100);
    };
    applyPendingSeek();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentStation?.url, syncActive]);

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
    setPreparingAudio(true);
    try {
      const loaded = synced ?? (await loadSyncedAudio(read.id, surah.id));
      if (!loaded) return;
      const startTiming =
        repeatMode === 'ayah' || repeatMode === 'range'
          ? loaded.ayahTimings.find((timing) => timing.ayah === repeatStart)
          : null;
      pendingInitialSeekRef.current = startTiming?.startMs ?? null;
      playStation({
        id: `quran-sync-${read.id}-${surah.id}`,
        name: `${surah.transliteration} · ${readName}`,
        url: loaded.audioUrl,
      });
      setLooping(repeatMode === 'surah');
      setFollowPaused(false);
    } finally {
      setPreparingAudio(false);
    }
  };

  const handleAyahClick = (verseId: number) => {
    setLastRead({ surahId: surah.id, verseId });
    if (repeatMode === 'ayah') {
      setRepeatStart(verseId);
      setRepeatEnd(verseId);
    }
    if (syncActive && synced) {
      const segment = synced.ayahTimings.find((timing) => timing.ayah === verseId);
      if (segment) {
        const element = audioElementHolder.current;
        const scale =
          element && Number.isFinite(element.duration) && element.duration > 0
            ? detectClockScale(synced.ayahTimings, element.duration)
            : 1000;
        seekToSeconds(segment.startMs / scale);
        setFollowPaused(false);
      }
    }
  };

  const clampAyah = (value: number) =>
    Math.min(Math.max(Math.round(Number.isFinite(value) ? value : 1), 1), surah.total_verses);

  const handleRepeatMode = (mode: QuranRepeatMode) => {
    const preferredAyah = clampAyah(
      activeAyah ?? (lastRead?.surahId === surah.id ? lastRead.verseId : repeatStart),
    );
    if (mode === 'ayah') {
      setRepeatStart(preferredAyah);
      setRepeatEnd(preferredAyah);
    } else if (mode === 'range') {
      setRepeatStart(Math.min(repeatStart, repeatEnd));
      setRepeatEnd(Math.max(repeatStart, repeatEnd));
    }
    setRepeatMode(mode);
  };

  const handleReturnToAyah = () => {
    setFollowPaused(false);
  };

  const isBookmarked = (bookmark: QuranBookmark) =>
    bookmarks.some((b) => b.surahId === bookmark.surahId && b.verseId === bookmark.verseId);

  return (
    <div>
      {/* Slim glass toolbar: stays out of the way of the mushaf page. */}
      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-panel/75 px-3 py-2 backdrop-blur">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-text">
          <span className="truncate">
            {surah.id}. {surah.transliteration} · {surah.total_verses} {t('quranVerses')}
          </span>
          {syncActive && synced && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-green/15 px-2 py-0.5 font-medium text-success-green">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-green" />
              {t('quranSyncBadge')}
              {activeAyah !== null && <span className="tabular-nums" dir="ltr"> · {activeAyah}</span>}
            </span>
          )}
          {syncActive && !synced && (
            <span className="rounded-full bg-muted-text/15 px-2 py-0.5 font-medium text-muted-text">
              {t('quranSyncUnavailable')}
            </span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {timingReads.length > 0 && (
            <select
              value={read?.id ?? ''}
              onChange={(event) => selectTimingRead(event.target.value)}
              className="surface-input max-w-[190px] py-1 text-[11px]"
              title={t('quranSyncedReciter')}
            >
              {timingReads.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {language === 'ar' ? entry.nameAr ?? entry.name : entry.name}
                </option>
              ))}
            </select>
          )}
          {read && (
            <button
              type="button"
              onClick={() => void handlePlaySurah()}
              disabled={preparingAudio}
              className="btn-primary px-2.5 py-1 text-[11px]"
              title={t('quranPlaySurah')}
            >
              {preparingAudio ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" fill="currentColor" />
              )}
              {preparingAudio ? t('quranPreparingAudio') : t('quranPlaySurah')}
            </button>
          )}
          <div className="relative">
            <Repeat
              className={`pointer-events-none absolute start-2 top-1/2 h-3 w-3 -translate-y-1/2 ${
                repeatMode === 'off' ? 'text-muted-text' : 'text-success-green'
              }`}
            />
            <select
              value={repeatMode}
              onChange={(event) => handleRepeatMode(event.target.value as QuranRepeatMode)}
              className={`surface-input w-[126px] py-1 ps-7 text-[11px] ${
                repeatMode === 'off' ? '' : 'border-success-green/40 text-success-green'
              }`}
              title={t('quranRepeat')}
            >
              <option value="off">{t('quranRepeatOff')}</option>
              <option value="ayah">{t('quranRepeatAyah')}</option>
              <option value="range">{t('quranRepeatRange')}</option>
              <option value="surah">{t('quranRepeatSurah')}</option>
            </select>
          </div>
          {repeatMode === 'ayah' && (
            <label className="inline-flex items-center gap-1 text-[10px] text-muted-text">
              {t('quranAyah')}
              <input
                type="number"
                min={1}
                max={surah.total_verses}
                value={repeatStart}
                onChange={(event) => {
                  const next = clampAyah(Number(event.target.value));
                  setRepeatStart(next);
                  setRepeatEnd(next);
                }}
                className="surface-input w-14 py-1 text-center text-[11px] tabular-nums"
              />
            </label>
          )}
          {repeatMode === 'range' && (
            <div className="inline-flex items-center gap-1 text-[10px] text-muted-text">
              <input
                type="number"
                min={1}
                max={surah.total_verses}
                value={repeatStart}
                aria-label={t('quranRepeatFrom')}
                onChange={(event) => {
                  const next = clampAyah(Number(event.target.value));
                  setRepeatStart(next);
                  if (next > repeatEnd) setRepeatEnd(next);
                }}
                className="surface-input w-14 py-1 text-center text-[11px] tabular-nums"
              />
              <span>–</span>
              <input
                type="number"
                min={1}
                max={surah.total_verses}
                value={repeatEnd}
                aria-label={t('quranRepeatTo')}
                onChange={(event) => {
                  const next = clampAyah(Number(event.target.value));
                  setRepeatEnd(next);
                  if (next < repeatStart) setRepeatStart(next);
                }}
                className="surface-input w-14 py-1 text-center text-[11px] tabular-nums"
              />
            </div>
          )}
          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              onClick={() => setFontSize(fontSize - 2)}
              className="px-1.5 py-1 text-muted-text hover:text-text-primary"
              title="A-"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setFontSize(fontSize + 2)}
              className="px-1.5 py-1 text-muted-text hover:text-text-primary"
              title="A+"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowTranslation(!showTranslation)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              showTranslation
                ? 'border-primary-blue/45 bg-primary-blue/15 text-primary-blue'
                : 'border-border text-muted-text hover:text-text-primary'
            }`}
            title={t('quranTranslation')}
          >
            {t('quranTranslation')}
          </button>
        </div>
      </div>

      {syncedAudioError && !synced && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-warning-orange/25 bg-warning-orange/10 px-3 py-2 text-[11px] text-warning-orange">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{syncedAudioError}</span>
        </div>
      )}

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

      <div className="quran-reading-surface mx-auto mt-2 max-w-[68rem]">
        {/* The gliding recitation cue — one pill that follows the exact word. */}
        <span aria-hidden="true" id={`quran-cue-${surah.id}`} className="quran-word-cue" />
        <h2
          dir="rtl"
          className="quran-surah-heading quran-script arabic-text mb-5 text-center font-normal"
          style={{ fontSize: fontSize * 0.72, lineHeight: 1.4 }}
        >
          سُورَةُ {surah.name}
        </h2>

        {/* The unnumbered opening basmala: written before every surah except
            At-Tawbah in the Uthmani mushaf, in the traditional elongated
            calligraphic form on its own centered line (Al-Fatihah's basmala
            is verse 1 and appears inside the flow with its medallion). */}
        {surah.id !== 1 && surah.id !== 9 && (
          <p
            className="quran-basmala-calligraphy quran-script arabic-text mb-7 mt-2 text-center"
            dir="rtl"
            role="img"
            aria-label={BASMALA_TEXT}
            style={{ fontSize: fontSize * 1.5 }}
          >
            {BASMALA_LIGATURE}
          </p>
        )}

        {showTranslation ? (
          /* Ayah-list mode with translations. */
          <div className="space-y-5">
            {surah.verses.map((verse) => {
              const bookmark = { surahId: surah.id, verseId: verse.id };
              const marked = isBookmarked(bookmark);
              const isLastRead = lastRead?.surahId === surah.id && lastRead?.verseId === verse.id;
              const isActive = syncActive && activeAyah === verse.id;

              return (
                <div key={verse.id}>
                  <p dir="rtl" className="quran-script arabic-text" style={{ fontSize, lineHeight: 2.35 }}>
                    <span
                      id={`quran-verse-${surah.id}-${verse.id}`}
                      onClick={() => handleAyahClick(verse.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        toggleBookmark(bookmark);
                      }}
                      title={t('quranBookmarkHint')}
                      className={`quran-ayah-inline ${
                        isActive
                          ? 'quran-ayah-active'
                          : ''
                      } ${
                        marked ? 'quran-bookmarked' : ''
                      } ${isLastRead && !isActive ? 'quran-lastread' : ''}`}
                    >
                      <QuranVerseWords
                        surahId={surah.id}
                        ayah={verse.id}
                        text={verse.text}
                        syncedWords={syncedWordsByAyah.get(verse.id)}
                      />
                      <span className="quran-ayah-marker"> ۝{toArabicDigits(verse.id)} </span>
                    </span>
                  </p>
                  <p dir="ltr" className="quran-translation mt-1.5 text-sm leading-relaxed">
                    {verse.translation}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          /* Mushaf page mode: one continuous justified flow, like a real page. */
          <p dir="rtl" className="quran-flow quran-script arabic-text" style={{ fontSize, lineHeight: 2.2 }}>
            <span className="quran-passage-bracket" aria-hidden="true">﴿</span>{' '}
            {surah.verses.map((verse) => {
              const bookmark = { surahId: surah.id, verseId: verse.id };
              const marked = isBookmarked(bookmark);
              const isLastRead = lastRead?.surahId === surah.id && lastRead?.verseId === verse.id;
              const isActive = syncActive && activeAyah === verse.id;

              return (
                <span
                  key={verse.id}
                  id={`quran-verse-${surah.id}-${verse.id}`}
                  onClick={() => handleAyahClick(verse.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    toggleBookmark(bookmark);
                  }}
                  title={t('quranBookmarkHint')}
                  className={`quran-ayah-inline ${
                    isActive
                      ? 'quran-ayah-active'
                      : ''
                  } ${
                    marked ? 'quran-bookmarked' : ''
                  } ${isLastRead && !isActive ? 'quran-lastread' : ''}`}
                >
                  <QuranVerseWords
                    surahId={surah.id}
                    ayah={verse.id}
                    text={verse.text}
                    syncedWords={syncedWordsByAyah.get(verse.id)}
                  />
                  <span className="quran-ayah-marker"> ۝{toArabicDigits(verse.id)} </span>
                </span>
              );
            })}
            {' '}<span className="quran-passage-bracket" aria-hidden="true">﴾</span>
          </p>
        )}
      </div>
    </div>
  );
};

/** Converts 1 → ١ etc. for the traditional end-of-ayah ornament. */
const toArabicDigits = (value: number) =>
  String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

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
