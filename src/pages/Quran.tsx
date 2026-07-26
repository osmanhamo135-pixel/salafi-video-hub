import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  Headphones,
  Loader2,
  Minus,
  MoreHorizontal,
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
import { audioElementHolder, useRadioStore } from '@/store/radioStore';
import { useI18n } from '@/i18n';

const BASMALA_TEXT = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
const BASMALA_LIGATURE = '﷽';

type QuranTab = 'read' | 'listen';
type QuranRepeatMode = 'off' | 'ayah' | 'range' | 'surah';
type QuranToolbarMenu = 'none' | 'reciter' | 'repeat' | 'more';

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
  const riwayah = useQuranStore((state) => state.riwayah);

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

        <div className="mb-5 flex gap-5 border-b border-border">
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

        <p className="mt-6 text-center text-[11px] text-muted-text">
          {t(riwayah === 'warsh' ? 'quranAttributionWarsh' : 'quranAttribution')}
        </p>
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
  // Read / Listen share a baseline rule instead of being filled bordered
  // pills. They were the last pair of Language-B chips left in the app: a
  // 15%-fill box with a 45% border and a 12px radius, sitting directly above a
  // page built entirely from rules and value steps.
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`inline-flex items-center gap-2 border-b-2 px-1 pb-2 pt-1 text-sm font-medium transition-colors ${
      active
        ? 'border-accent-gold text-text-primary'
        : 'border-transparent text-muted-text hover:text-text-primary'
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

  const scrollToVerse = (surahId: number, verseId: number) => {
    window.setTimeout(() => {
      document
        .getElementById(`quran-verse-${surahId}-${verseId}`)
        ?.scrollIntoView({ block: 'center' });
    }, 60);
  };

  const handleContinue = () => {
    if (!lastRead) return;
    // When the surah is already open `openSurah` is a no-op, so `currentSurah`
    // never changes identity and the effect below would never fire. Scroll
    // directly — this is the case where the button is most likely to be used.
    if (currentSurah?.id === lastRead.surahId) {
      scrollToVerse(lastRead.surahId, lastRead.verseId);
      return;
    }
    pendingScrollRef.current = lastRead.verseId;
    void openSurah(lastRead.surahId);
  };

  useEffect(() => {
    if (!currentSurah || pendingScrollRef.current === null) return;
    const verse = pendingScrollRef.current;
    pendingScrollRef.current = null;
    scrollToVerse(currentSurah.id, verse);
  }, [currentSurah]);

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex max-h-[70vh] flex-col overflow-hidden border-border pb-1 xl:border-e xl:pe-5">
        <div className="shrink-0">
          <div className="rule-head">
            <span className="text-xs font-semibold tracking-wide text-text-primary" dir="auto">
              {t('quranSurahs')}
            </span>
            <span className="text-[11px] tabular-nums text-muted-text">
              <bdi>{filtered.length}</bdi>
            </span>
          </div>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('quranSearchSurah')}
              className="field-quiet ps-6 text-sm"
            />
          </div>
          {lastRead && (
            <button
              type="button"
              onClick={handleContinue}
              className="mt-2 inline-flex items-center gap-1.5 py-1 text-[11px] font-medium text-muted-text transition-colors hover:text-text-primary"
            >
              <BookMarked className="h-3.5 w-3.5" />
              {t('quranContinue')}
            </button>
          )}
        </div>
        <div className="rule-list min-h-0 flex-1 overflow-y-auto">
          {filtered.map((surah) => (
            <SurahRow key={surah.id} surah={surah} active={currentSurah?.id === surah.id} onOpen={() => void openSurah(surah.id)} />
          ))}
        </div>
      </aside>

      <section className="min-h-[50vh]">
        {loadingSurah && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-text" />
          </div>
        )}
        {!loadingSurah && !currentSurah && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BookOpen className="mb-3 h-9 w-9 text-text-faint" />
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
        aria-current={active ? 'true' : undefined}
        className={`rule-row w-full py-2.5 text-start ${active ? 'rule-row-active' : ''}`}
      >
        {/* Fixed-width numeral gutter: the ids line up as a ruled column. */}
        <span className="w-6 shrink-0 text-end text-[11px] tabular-nums text-text-faint">
          <bdi>{surah.id}</bdi>
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-text-primary" dir="auto">
          {surah.transliteration}
        </span>
        <span className="arabic-text shrink-0 truncate text-sm text-muted-text" dir="auto">
          {surah.name}
        </span>
        <span
          className="w-7 shrink-0 text-end text-[11px] tabular-nums text-text-faint"
          title={t('quranVerses')}
        >
          <bdi>{surah.totalVerses}</bdi>
        </span>
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

/**
 * A quiet toolbar popover: one hairline-bordered panel that sits on the page's
 * own darkness. Nothing it contains ever covers Quranic text permanently — the
 * backdrop dismisses it on the first click anywhere else.
 */
const ToolbarPanel: React.FC<{
  label: string;
  align?: 'start' | 'end';
  onClose: () => void;
  children: React.ReactNode;
}> = ({ label, align = 'start', onClose, children }) => (
  <>
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onClose}
      className="fixed inset-0 z-30 cursor-default"
    />
    <div
      role="group"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className={`absolute top-full z-40 mt-2 min-w-[11rem] rounded-md border border-border bg-background p-1.5 ${
        align === 'end' ? 'end-0' : 'start-0'
      }`}
    >
      {children}
    </div>
  </>
);

const SurahReader: React.FC = () => {
  const { t, language } = useI18n();
  const surah = useQuranStore((state) => state.currentSurah);
  const riwayah = useQuranStore((state) => state.riwayah);
  const setRiwayah = useQuranStore((state) => state.setRiwayah);
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
  const playing = useRadioStore((state) => state.playing);
  const togglePlay = useRadioStore((state) => state.togglePlay);
  const [followPaused, setFollowPaused] = useState(false);
  const [preparingAudio, setPreparingAudio] = useState(false);
  const [repeatMode, setRepeatMode] = useState<QuranRepeatMode>('off');
  const [repeatStart, setRepeatStart] = useState(1);
  const [repeatEnd, setRepeatEnd] = useState(1);
  // Only one toolbar panel is ever open, so the mushaf is never covered twice.
  const [openMenu, setOpenMenu] = useState<QuranToolbarMenu>('none');
  const programmaticScrollRef = useRef(false);
  const pendingInitialSeekRef = useRef<number | null>(null);

  useEffect(() => {
    void loadTimingReads();
  }, [loadTimingReads]);

  const warshMode = riwayah === 'warsh';
  const read = timingReads.find((entry) => entry.id === selectedTimingReadId) ?? timingReads[0];
  const readName = read ? (language === 'ar' ? read.nameAr ?? read.name : read.name) : '';
  const syncStationId = surah && read ? `quran-sync-${read.id}-${surah.id}` : null;
  // Recitation timing data uses the Hafs (Kufan) numbering; the tracker is
  // Hafs-only so it can never point at a differently numbered Warsh ayah.
  const syncActive = !warshMode && Boolean(syncStationId && currentStation?.id === syncStationId);
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

  /**
   * Seeks to a position expressed in the timing file's own clock.
   *
   * The audio element has no duration until metadata arrives, and the clock
   * scale is *measured* against that duration rather than assumed — so a seek
   * requested before metadata cannot be applied yet. Poll for it instead of
   * dropping the request silently, which is what made an ayah click right after
   * pressing play appear to do nothing. Bounded to ~10s so a dead stream does
   * not leave an unbounded retry re-arming for as long as the reader is mounted.
   */
  const seekPollRef = useRef(0);
  const seekToTimingMs = useCallback(
    (ms: number) => {
      window.clearTimeout(seekPollRef.current);
      let attemptsLeft = 100;
      const attempt = () => {
        const element = audioElementHolder.current;
        if (element && Number.isFinite(element.duration) && element.duration > 0) {
          // Without timings to measure against there is no safe guess at the
          // scale, so drop the seek rather than risk landing on a wrong ayah.
          if (!synced) return;
          element.currentTime = ms / detectClockScale(synced.ayahTimings, element.duration);
          return;
        }
        if (attemptsLeft-- <= 0) return;
        seekPollRef.current = window.setTimeout(attempt, 100);
      };
      attempt();
    },
    [synced],
  );

  useEffect(() => () => window.clearTimeout(seekPollRef.current), []);

  useEffect(() => {
    if (!syncActive || pendingInitialSeekRef.current === null) return;
    const target = pendingInitialSeekRef.current;
    pendingInitialSeekRef.current = null;
    seekToTimingMs(target);
  }, [currentStation?.url, syncActive, seekToTimingMs]);

  // Follow the recitation: gently keep the active ayah visible, but never
  // fight the user — manual scrolling pauses auto-follow until they return.
  useEffect(() => {
    if (!syncActive || followPaused || activeAyah === null || !surah) return;
    const element = document.getElementById(`quran-verse-${surah.id}-${activeAyah}`);
    if (!element) return;
    programmaticScrollRef.current = true;
    // Smooth scrolling is motion too. CSS `scroll-behavior` cannot override a
    // behaviour passed explicitly to scrollIntoView, so the preference has to
    // be read here — otherwise the page keeps gliding for a reader who asked
    // the system for no animation.
    element.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
    const timer = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 700);
    // Reset the flag as well as cancelling the timer. Where ayahs are shorter
    // than 700ms of audio the timer is cleared and rescheduled forever, so
    // clearing alone leaves the flag stuck true and the user can never pause
    // auto-follow — the page keeps yanking them back to the active ayah.
    return () => {
      window.clearTimeout(timer);
      programmaticScrollRef.current = false;
    };
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
        seekToTimingMs(segment.startMs);
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

  const closeMenu = () => setOpenMenu('none');
  const toggleMenu = (menu: QuranToolbarMenu) =>
    setOpenMenu((current) => (current === menu ? 'none' : menu));
  const syncPlaying = syncActive && playing;
  const repeatOptions: Array<{ mode: QuranRepeatMode; label: string }> = [
    { mode: 'off', label: t('quranRepeatOff') },
    { mode: 'ayah', label: t('quranRepeatAyah') },
    { mode: 'range', label: t('quranRepeatRange') },
    { mode: 'surah', label: t('quranRepeatSurah') },
  ];

  return (
    <div>
      {/* Toolbar: three primary objects on the line — play, reciter, riwayah —
          everything else folds into a panel, so the mushaf keeps the page. */}
      <div className="quran-toolbar sticky top-0 z-20 mb-4 px-1 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!warshMode && read && (
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() => (syncActive ? togglePlay() : void handlePlaySurah())}
                disabled={preparingAudio}
                title={t('quranPlaySurah')}
                aria-label={t('quranPlaySurah')}
                className="inline-flex items-center gap-1.5 rounded-sm py-1 text-[11px] font-medium text-text-primary transition-colors hover:text-accent-gold disabled:opacity-60"
              >
                {preparingAudio ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-text" />
                ) : syncPlaying ? (
                  <Pause className="h-3.5 w-3.5 text-accent-gold" fill="currentColor" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-accent-gold" fill="currentColor" />
                )}
                {!syncPlaying && (
                  <span>{preparingAudio ? t('quranPreparingAudio') : t('quranPlaySurah')}</span>
                )}
              </button>

              {/* Repeat lives with the play control. It stays available before
                  playback too: setting a start ayah here is what seeds the
                  initial seek on the first press. */}
              <button
                type="button"
                onClick={() => toggleMenu('repeat')}
                aria-haspopup="dialog"
                aria-expanded={openMenu === 'repeat'}
                title={t('quranRepeat')}
                aria-label={t('quranRepeat')}
                className={`icon-btn h-7 w-7 ${repeatMode === 'off' ? '' : 'text-text-primary'}`}
              >
                <Repeat className="h-3.5 w-3.5" />
              </button>
              {openMenu === 'repeat' && (
                <ToolbarPanel label={t('quranRepeat')} onClose={closeMenu}>
                      <div className="rule-list" role="radiogroup" aria-label={t('quranRepeat')}>
                        {repeatOptions.map((option) => (
                          <button
                            key={option.mode}
                            type="button"
                            role="radio"
                            aria-checked={repeatMode === option.mode}
                            onClick={() => handleRepeatMode(option.mode)}
                            className={`rule-row w-full py-2 text-start text-[11px] ${
                              repeatMode === option.mode ? 'rule-row-active' : 'text-muted-text'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      {repeatMode === 'ayah' && (
                        <label className="mt-2 flex items-center justify-between gap-2 px-0.5 text-[11px] text-muted-text">
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
                            className="field-quiet w-16 py-1 text-center text-[11px] tabular-nums"
                          />
                        </label>
                      )}
                      {repeatMode === 'range' && (
                        <div className="mt-2 flex items-center justify-between gap-1.5 px-0.5 text-[11px] text-muted-text">
                          <input
                            type="number"
                            min={1}
                            max={surah.total_verses}
                            value={repeatStart}
                            aria-label={t('quranRepeatFrom')}
                            title={t('quranRepeatFrom')}
                            onChange={(event) => {
                              const next = clampAyah(Number(event.target.value));
                              setRepeatStart(next);
                              if (next > repeatEnd) setRepeatEnd(next);
                            }}
                            className="field-quiet w-16 py-1 text-center text-[11px] tabular-nums"
                          />
                          <span aria-hidden="true">–</span>
                          <input
                            type="number"
                            min={1}
                            max={surah.total_verses}
                            value={repeatEnd}
                            aria-label={t('quranRepeatTo')}
                            title={t('quranRepeatTo')}
                            onChange={(event) => {
                              const next = clampAyah(Number(event.target.value));
                              setRepeatEnd(next);
                              if (next < repeatStart) setRepeatStart(next);
                            }}
                            className="field-quiet w-16 py-1 text-center text-[11px] tabular-nums"
                          />
                        </div>
                      )}
                </ToolbarPanel>
              )}
            </div>
          )}

          {/* The reciter reads as a name, not a form control. */}
          {!warshMode && timingReads.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleMenu('reciter')}
                aria-haspopup="listbox"
                aria-expanded={openMenu === 'reciter'}
                title={t('quranSyncedReciter')}
                aria-label={t('quranSyncedReciter')}
                className="inline-flex max-w-[15rem] items-center gap-1 py-1 text-[11px] text-muted-text transition-colors hover:text-text-primary"
              >
                <span className="truncate" dir="auto">
                  {readName}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
              {openMenu === 'reciter' && (
                <ToolbarPanel label={t('quranSyncedReciter')} onClose={closeMenu}>
                  <div className="rule-list max-h-64 overflow-y-auto" role="listbox">
                    {timingReads.map((entry) => {
                      const selected = read?.id === entry.id;
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          dir="auto"
                          onClick={() => {
                            selectTimingRead(entry.id);
                            closeMenu();
                          }}
                          className={`rule-row w-full py-2 text-start text-[11px] ${
                            selected ? 'rule-row-active' : 'text-muted-text'
                          }`}
                        >
                          {language === 'ar' ? entry.nameAr ?? entry.name : entry.name}
                        </button>
                      );
                    })}
                  </div>
                </ToolbarPanel>
              )}
            </div>
          )}

          {/* Riwayah: both readings stay legible at all times — which riwayah
              is on screen is a correctness question, never a hidden setting. */}
          <div className="segmented" role="group" aria-label={t('quranRiwayah')}>
            <button type="button" aria-pressed={!warshMode} onClick={() => setRiwayah('hafs')}>
              {t('quranRiwayahHafs')}
            </button>
            <button type="button" aria-pressed={warshMode} onClick={() => setRiwayah('warsh')}>
              {t('quranRiwayahWarsh')}
            </button>
          </div>

          <div className="relative ms-auto">
            <button
              type="button"
              onClick={() => toggleMenu('more')}
              aria-haspopup="menu"
              aria-expanded={openMenu === 'more'}
              title={t('quranTranslation')}
              aria-label={t('quranTranslation')}
              className="icon-btn"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {openMenu === 'more' && (
              <ToolbarPanel label={t('quranTranslation')} align="end" onClose={closeMenu}>
                <div className="flex items-center justify-between gap-3 px-1 py-1">
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setFontSize(fontSize - 2)}
                      className="icon-btn h-7 w-7"
                      title="A-"
                      aria-label="A-"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSize(fontSize + 2)}
                      className="icon-btn h-7 w-7"
                      title="A+"
                      aria-label="A+"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                {!warshMode && (
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={showTranslation}
                    onClick={() => setShowTranslation(!showTranslation)}
                    className="mt-1 flex w-full items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-[11px] text-text-primary transition-colors hover:bg-panel-hover"
                  >
                    <span>{t('quranTranslation')}</span>
                    {showTranslation ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-text-primary" />
                    ) : (
                      <span className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                )}
              </ToolbarPanel>
            )}
          </div>
        </div>

        {/* One quiet status line — only the live following state is accented. */}
        {(syncActive || warshMode) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[11px] text-muted-text">
            {syncActive && synced && (
              <span className="inline-flex items-center gap-1.5 text-accent-gold">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-gold" />
                {t('quranSyncBadge')}
                {activeAyah !== null && <bdi className="tabular-nums">{activeAyah}</bdi>}
              </span>
            )}
            {syncActive && !synced && <span>{t('quranSyncUnavailable')}</span>}
            {warshMode && <span dir="auto">{t('quranWarshNote')}</span>}
          </p>
        )}
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
          className="fixed bottom-24 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-text transition-colors hover:text-text-primary"
        >
          <BookOpen className="h-3 w-3" />
          {t('quranFollowAyah')}
        </button>
      )}

      {/* Three elements, and the split matters:
            .quran-reading-frame     holds the jadwal and bounds the height
            .quran-reading-viewport  the scroller
            .quran-reading-surface   unchanged; still the cue's offsetParent
          Al-Baqarah rendered 36,000px tall inside a 900px window — 42 screens of
          page scroll — because only the surah sidebar was ever bounded. The
          scroll cannot go on the surface itself: positionWordCue derives the
          cue's transform from the delta between the word's rect and its
          offsetParent's, and an absolutely positioned child of a scroller moves
          with the content, so the cue would sit scrollTop pixels out. With the
          scroller one level up, both rects move together and the delta holds. */}
      <div className="quran-reading-frame mx-auto mt-2 max-w-[68rem]">
        <div className="quran-reading-viewport">
      <div className={`quran-reading-surface ${warshMode ? 'quran-riwayah-warsh' : ''}`}>
        {/* The gliding recitation cue — one pill that follows the exact word. */}
        <span aria-hidden="true" id={`quran-cue-${surah.id}`} className="quran-word-cue" />
        {/* The surah header band: the name in a quiet cartouche between two
            hairlines, which is what a printed mushaf's surah header is. */}
        <h2
          dir="rtl"
          className="quran-surah-heading quran-script arabic-text mb-6 text-center font-normal"
          style={{ fontSize: fontSize * 0.66, lineHeight: 1.5 }}
        >
          <span className="quran-surah-title">سُورَةُ {surah.name}</span>
        </h2>

        {/* The unnumbered opening basmala: written before every surah except
            At-Tawbah in the Uthmani mushaf, in the traditional elongated
            calligraphic form on its own centered line (Al-Fatihah's basmala
            is verse 1 and appears inside the flow with its medallion). */}
        {(warshMode ? surah.id !== 9 : surah.id !== 1 && surah.id !== 9) && (
          <p
            className="quran-basmala-calligraphy quran-script arabic-text mb-7 mt-2 text-center"
            dir="rtl"
            role="img"
            aria-label={BASMALA_TEXT}
            style={{ fontSize: `min(${fontSize * 1.5}px, 11vw)` }}
          >
            {BASMALA_LIGATURE}
          </p>
        )}

        {showTranslation && !warshMode ? (
          /* Ayah-list mode with translations. */
          <div className="space-y-5">
            {surah.verses.map((verse) => {
              const bookmark = { surahId: surah.id, verseId: verse.id };
              const marked = isBookmarked(bookmark);
              const isLastRead = lastRead?.surahId === surah.id && lastRead?.verseId === verse.id;
              const isActive = syncActive && activeAyah === verse.id;

              return (
                <div key={verse.id}>
                  <p dir="rtl" className="quran-ayah-line quran-script arabic-text" style={{ fontSize, lineHeight: 2.3 }}>
                    <span
                      id={`quran-verse-${surah.id}-${verse.id}`}
                      onClick={() => handleAyahClick(verse.id)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        toggleBookmark(bookmark);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleAyahClick(verse.id);
                        }
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
          <p dir="rtl" className="quran-flow quran-script arabic-text" style={{ fontSize, lineHeight: 2.3 }}>
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
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleAyahClick(verse.id);
                    }
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
          </p>
        )}
      </div>
        </div>
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
      <aside className="flex max-h-[70vh] flex-col overflow-hidden border-border pb-1 xl:border-e xl:pe-5">
        <div className="shrink-0">
          <div className="rule-head">
            <span className="text-xs font-semibold tracking-wide text-text-primary" dir="auto">
              {t('quranReciters')}
            </span>
            <span className="text-[11px] tabular-nums text-muted-text">
              <bdi>{filteredReciters.length}</bdi>
            </span>
          </div>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
            <input
              type="text"
              value={reciterQuery}
              onChange={(event) => setReciterQuery(event.target.value)}
              placeholder={t('quranSearchReciter')}
              className="field-quiet ps-6 text-sm"
            />
          </div>
        </div>
        <div className="rule-list min-h-0 flex-1 overflow-y-auto">
          {recitersLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-text" />
            </div>
          )}
          {recitersError && !recitersLoading && (
            <p className="py-3 text-xs text-danger-red">{recitersError}</p>
          )}
          {filteredReciters.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => selectReciter(entry.id)}
              aria-current={reciter?.id === entry.id ? 'true' : undefined}
              className={`rule-row w-full py-2.5 text-start ${
                reciter?.id === entry.id ? 'rule-row-active' : ''
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary" dir="auto">
                {entry.name}
              </span>
              <span className="max-w-[9rem] shrink-0 truncate text-[11px] text-text-faint" dir="auto">
                {entry.moshafName}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="premium-surface rounded-lg p-4">
        {reciter ? (
          <>
            <p className="mb-3 text-sm font-semibold text-text-primary" dir="auto">
              {reciter.name}
            </p>
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
                    <span className="w-5 shrink-0 text-end text-[10px] tabular-nums text-text-faint">
                      <bdi>{surah.id}</bdi>
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary"
                      dir="auto"
                    >
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
          !recitersLoading && (
            <p className="py-10 text-center text-sm text-muted-text">
              {recitersError ?? t('quranNoReciters')}
            </p>
          )
        )}
      </section>
    </div>
  );
};
