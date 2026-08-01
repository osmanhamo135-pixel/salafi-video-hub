import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
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
  SkipBack,
  SkipForward,
  Type,
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
import { TranslationKey, useI18n } from '@/i18n';
import { juzFor } from '@/utils/juz';
import { SplitGrid } from '@/components/ui/SplitGrid';

const BASMALA_TEXT = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
const BASMALA_LIGATURE = '﷽';

/**
 * Makki / Madani — the one fact a mushaf prints in every surah header and the
 * list did not carry at all. The store publishes `revelationType` as the API's
 * own 'meccan' / 'medinan'.
 */
const revelationKey = (revelationType: string): TranslationKey =>
  revelationType?.toLowerCase().startsWith('med') ? 'quranMadani' : 'quranMakki';

/** Al-Baqarah, the longest surah — the scale every length mark is read against. */
const LONGEST_SURAH_VERSES = 286;

/**
 * The length mark's width, compressed by a fractional power rather than drawn
 * linearly.
 *
 * Linear, 95 of the 114 surahs sit under a fifth of the bar and every one of
 * the mufassal reads as the same stub. Square-rooted, the top of the list
 * flattens instead — An-Nisa and Al-An'am come out within two pixels of each
 * other. 0.62 is the exponent where both ends stay separable: Al-Baqarah 100,
 * An-Nisa 74, Yasin 43, Al-Mulk 25, An-Nas 9.
 */
const surahLengthPercent = (totalVerses: number) =>
  Math.max(
    5,
    Math.round(
      Math.pow(Math.min(totalVerses, LONGEST_SURAH_VERSES) / LONGEST_SURAH_VERSES, 0.62) * 100,
    ),
  );

type QuranTab = 'read' | 'listen';
type QuranRepeatMode = 'off' | 'ayah' | 'range' | 'surah';
type QuranToolbarMenu = 'none' | 'reciter' | 'repeat' | 'more';

interface QuranRepeatSelection {
  mode: QuranRepeatMode;
  startAyah: number;
  endAyah: number;
  /** How many times to play the segment before continuing on. 0 = forever. */
  times: number;
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
  const { t, language } = useI18n();
  const surahs = useQuranStore((state) => state.surahs);
  const currentSurah = useQuranStore((state) => state.currentSurah);
  const loadingSurah = useQuranStore((state) => state.loadingSurah);
  const lastRead = useQuranStore((state) => state.lastRead);
  const bookmarks = useQuranStore((state) => state.bookmarks);
  const openSurah = useQuranStore((state) => state.openSurah);
  const [query, setQuery] = useState('');
  const pendingScrollRef = useRef<number | null>(null);

  // Which surahs the reader has marked. Computed once for the whole list rather
  // than scanned per row: 114 rows x every bookmark is the kind of quiet O(n·m)
  // that only shows up once somebody has a few hundred bookmarks.
  const bookmarkedSurahIds = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.surahId)),
    [bookmarks],
  );
  const lastReadSurah = useMemo(
    () => (lastRead ? surahs.find((surah) => surah.id === lastRead.surahId) ?? null : null),
    [lastRead, surahs],
  );

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

  /**
   * Keep the open surah visible in the index.
   *
   * Resuming at Al-Kahf left the list showing surahs 1–10 with the marked row
   * eighteen rows below the fold, so the one row the reader most needs to see
   * was the one row they could not.
   *
   * Scrolls `list.scrollTop` directly rather than calling scrollIntoView: that
   * walks up and scrolls EVERY ancestor scroller, which here includes the page
   * container — and dragging the whole page because a sidebar row moved is
   * exactly the kind of thing that fights the reader.
   */
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !currentSurah) return;
    const row = list.querySelector<HTMLElement>('[aria-current="true"]');
    if (!row) return;
    const listRect = list.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    // Already fully in view: leave it alone. Re-centring a row the reader can
    // see reads as the list twitching under their hand.
    if (rowRect.top >= listRect.top && rowRect.bottom <= listRect.bottom) return;
    list.scrollTop += rowRect.top - listRect.top - (listRect.height - rowRect.height) / 2;
  }, [currentSurah?.id, filtered.length]);

  return (
    /* The surah list column is resizable and remembered. The reading pane's
       subtree is untouched by this — SplitGrid adds no wrappers around it,
       which matters because .quran-reading-surface must not gain positioned
       or scrolling ancestors (the word-cue coordinate invariant). */
    <SplitGrid
      storageKey="salafi-hub.quran-split.v1"
      label={t('quranSplitLabel')}
      className="grid gap-5 xl:grid-cols-[var(--split,320px)_11px_minmax(0,1fr)]"
    >
      <aside className="flex max-h-[70vh] flex-col overflow-hidden border-border pb-1 xl:pe-2">
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
          {/* Resume. This used to be an 11px text link lost between the search
              field and the list; it is the single most-used thing on the page
              for anyone reading through a long surah, so it now names where
              they were and reads as the first row of the list. */}
          {lastRead && lastReadSurah && (
            <button
              type="button"
              onClick={handleContinue}
              className="rule-row mt-1 w-full items-center py-2.5 text-start"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent-gold/35 text-accent-gold"
              >
                <BookMarked className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] leading-4 text-accent-gold">
                  {t('quranContinue')}
                </span>
                <span className="mt-0.5 flex items-baseline gap-1.5 truncate text-[13px] leading-5 text-text-primary">
                  <bdi className="truncate">
                    {language === 'ar' ? lastReadSurah.name : lastReadSurah.transliteration}
                  </bdi>
                  <span className="shrink-0 text-[11px] text-text-faint">
                    <bdi>
                      {t('quranAyah')} {lastRead.verseId}
                    </bdi>
                  </span>
                </span>
              </span>
            </button>
          )}
        </div>
        <div ref={listRef} className="rule-list min-h-0 flex-1 overflow-y-auto">
          {filtered.map((surah) => (
            <SurahRow
              key={surah.id}
              surah={surah}
              active={currentSurah?.id === surah.id}
              bookmarked={bookmarkedSurahIds.has(surah.id)}
              onOpen={() => void openSurah(surah.id)}
            />
          ))}
        </div>
      </aside>

      <section className="min-h-[50vh]">
        {loadingSurah && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-text" />
          </div>
        )}
        {!loadingSurah && !currentSurah && <ReaderPlaceholder />}
        {!loadingSurah && currentSurah && <SurahReader />}
      </section>
    </SplitGrid>
  );
};

/**
 * Nothing open yet. The reading pane is a framed mushaf page, so its empty
 * state is the same frame standing empty rather than an icon floating in a
 * void — the shape of what is about to appear.
 */
const ReaderPlaceholder: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-[19rem] max-w-[68rem] flex-col items-center justify-center px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="mb-5 flex h-16 w-16 items-center justify-center border border-accent-gold/25"
      >
        <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center border border-accent-gold/15">
          <BookOpen className="h-6 w-6 text-accent-gold/70" />
        </span>
      </span>
      <p className="text-sm text-text-soft">{t('quranSelectSurah')}</p>
      <span aria-hidden="true" className="gold-thread mt-5 w-28" />
    </div>
  );
};

/**
 * One surah in the index.
 *
 * This is the app's main navigation and it used to be `number · name · arabic ·
 * count` on one line, 114 times, every cell the same size and weight. A reader
 * choosing a surah wants four things the old row never carried: which one they
 * have marked, whether it was revealed at Makkah or al-Madinah, roughly how
 * long it is, and what its name means. They are laid out on two lines with a
 * clear primary — the name — so the eye tracks down the names and only drops to
 * the second line when it has found something. Still a ruled row, not a card:
 * no border, no fill, no radius. The length mark is a hairline, not a chart.
 */
const SurahRow: React.FC<{
  surah: SurahMeta;
  active: boolean;
  bookmarked: boolean;
  onOpen: () => void;
}> = React.memo(({ surah, active, bookmarked, onOpen }) => {
  const { t, language } = useI18n();
  // In Arabic the surah's own name leads and the transliteration becomes the
  // secondary script; in English it is the other way round. Both scripts stay
  // on every row — that bicameral pairing is most of the list's texture.
  const arabicLeads = language === 'ar';
  const primary = arabicLeads ? surah.name : surah.transliteration;
  const secondary = arabicLeads ? surah.transliteration : surah.name;
  const caption = arabicLeads
    ? t(revelationKey(surah.revelationType))
    : [t(revelationKey(surah.revelationType)), surah.translation].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={`rule-row w-full items-start gap-3 py-2.5 text-start ${active ? 'rule-row-active' : ''}`}
    >
      {/* Fixed-width numeral gutter: the ids line up as a ruled column. */}
      <span
        className={`mt-[3px] w-6 shrink-0 text-end text-[11px] leading-4 tabular-nums ${
          active ? 'text-accent-gold' : 'text-text-faint'
        }`}
      >
        <bdi>{surah.id}</bdi>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-medium leading-5 text-text-primary" title={primary}>
            <bdi>{primary}</bdi>
          </span>
          {bookmarked && (
            <Bookmark
              className="h-2.5 w-2.5 shrink-0 text-accent-gold"
              fill="currentColor"
              aria-label={t('quranBookmark')}
            />
          )}
        </span>
        <span className="mt-px block truncate text-[11px] leading-4 text-text-faint" title={caption}>
          <bdi>{caption}</bdi>
        </span>
      </span>

      <span className="shrink-0">
        <span
          className={`block max-w-[8.5rem] truncate text-end text-[13px] leading-5 text-muted-text ${
            arabicLeads ? '' : 'arabic-text'
          }`}
          title={secondary}
        >
          <bdi>{secondary}</bdi>
        </span>
        {/* Length at a glance: the count, and a hairline measure beside it so
            the whole index reads as a descending shape from Al-Baqarah down to
            the mufassal. */}
        <span className="mt-1.5 flex items-center justify-end gap-2" title={t('quranVerses')}>
          <span className="w-8 text-end text-[10px] leading-none tabular-nums text-text-faint">
            <bdi>{surah.totalVerses}</bdi>
          </span>
          <span aria-hidden="true" className="block h-[2px] w-12 bg-accent-gold/10">
            {/* No physical side is set, so the fill grows from the reading
                start in both directions — right-anchored under RTL. */}
            <span
              className={`block h-full ${active ? 'bg-accent-gold/70' : 'bg-accent-gold/35'}`}
              style={{ width: `${surahLengthPercent(surah.totalVerses)}%` }}
            />
          </span>
        </span>
      </span>
    </button>
  );
});

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
  /* Completed passes of the repeat segment, surfaced so the toolbar chip can
     say "2/3". Set only when a loop closes — once every few seconds at most —
     never per frame; the per-frame rule (INV: the tick writes no React state
     except on ayah change) still holds. */
  const [loopsDone, setLoopsDone] = useState(0);
  const lastAyahRef = useRef<number | null>(null);
  const activeWordElementRef = useRef<HTMLElement | null>(null);
  const lastLoopAtRef = useRef(0);
  // Clock multiplier for the timing values; 0 = not yet detected.
  const scaleRef = useRef(0);

  /* The repeat selection is read through a ref, NOT an effect dependency.
     When it was a dependency, every keystroke in the repeat panel's number
     inputs tore the whole engine down — cue hidden, active word cleared,
     clock scale re-measured — a visible flicker for typing one digit. The
     tick reads the ref each frame instead, and this tiny effect resets the
     loop counter whenever the target changes, which is the only part of the
     old teardown that was actually wanted. */
  const repeatRef = useRef(repeat);
  const loopCountRef = useRef(0);
  const loopArmedRef = useRef(false);
  useEffect(() => {
    repeatRef.current = repeat;
    loopCountRef.current = 0;
    loopArmedRef.current = false;
    setLoopsDone(0);
  }, [repeat]);

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
    /* Whether the paused-state cleanup has already run, so the paused branch
       does one pass of DOM work and then nothing, rather than thrashing the
       classList thirty times a second while the reader thinks. */
    let clearedWhilePaused = false;
    const tick = () => {
      const element = audioElementHolder.current;
      /* Paused or ended: the green word and the cue used to stay frozen on
         the last spoken word, so a paused mushaf was indistinguishable from a
         playing one. Clear them once; they come straight back on resume. */
      if ((!element || element.paused) && !clearedWhilePaused) {
        clearedWhilePaused = true;
        activeWordElementRef.current?.classList.remove('quran-word-active');
        activeWordElementRef.current = null;
        if (surahId !== null) {
          const cue = document.getElementById(`quran-cue-${surahId}`);
          if (cue) cue.style.opacity = '0';
        }
      }
      if (element && !element.paused) {
        clearedWhilePaused = false;
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

        const repeatNow = repeatRef.current;
        if (repeatNow.mode === 'ayah' || repeatNow.mode === 'range') {
          const first = ayahTimings.find((timing) => timing.ayah === repeatNow.startAyah);
          const last = ayahTimings.find((timing) => timing.ayah === repeatNow.endAyah);
          const now = performance.now();
          /* The latch: a pass only counts after the playhead has actually
             been INSIDE the segment. Without it, the moment the final pass
             flows onward the end-of-segment condition stays true and the
             counter climbs forever, once per debounce window. */
          if (first && last && clock >= first.startMs + 120 && clock < last.endMs - 500) {
            loopArmedRef.current = true;
          }
          if (
            first &&
            last &&
            loopArmedRef.current &&
            clock >= last.endMs - 45 &&
            clock > first.startMs + 120 &&
            now - lastLoopAtRef.current > 250
          ) {
            lastLoopAtRef.current = now;
            loopArmedRef.current = false;
            /* times = 0 means forever. Otherwise count completed passes and,
               once the asked-for number has played, let the recitation flow
               on past the segment instead of looping — which is what a
               memorisation pass actually wants: repeat ayah 12 three times,
               then continue the surah. */
            loopCountRef.current += 1;
            setLoopsDone(loopCountRef.current);
            if (repeatNow.times === 0 || loopCountRef.current < repeatNow.times) {
              element.currentTime = first.startMs / scaleRef.current;
              clock = first.startMs;
            }
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
    /* `repeat` is deliberately NOT here — it is read through repeatRef. See
       the comment on repeatRef for the flicker this dependency caused. */
  }, [syncActive, synced, surahId]);

  return { activeAyah, loopsDone };
};

const QuranVerseWords: React.FC<{
  surahId: number;
  ayah: number;
  text: string;
  syncedWords?: string[];
}> = React.memo(({ surahId, ayah, text, syncedWords }) => {
  /* Split on the ASCII space ONLY — never `\s`. Both corpora use a second,
     deliberate space that is *inside* a word and must never become a split
     point: Hafs carries U+2009 THIN SPACE in 2:72 (فَٱدَّٰرَٰٔتُمۡ), and Warsh
     carries 434 U+00A0 NBSPs binding ۞ to the word it opens. `\s` matches
     both. Splitting there put combining marks — a superscript alef and a
     hamza with no base — at the head of their own span, and WebKit shapes
     each span as its own run, so HarfBuzz stamps a dotted circle onto
     Qur'anic text; it also broke the NBSP's whole purpose by letting the
     ornament orphan at a line end, and shifted every later word index. */
  const words = syncedWords?.length ? syncedWords : text.trim().split(/ +/).filter(Boolean);

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

/**
 * A hairline between toolbar groups. Direction-agnostic by construction (a 1px
 * box in the flow, no physical side), so it needs no RTL variant.
 */
const ToolbarDivider: React.FC = () => (
  <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-border sm:block" />
);

/**
 * An ayah-number field that lets the reader actually type.
 *
 * The naive controlled number input clamped on every keystroke, and
 * `Number('')` is 0, so CLEARING the field snapped it to 1 — a two-digit ayah
 * could literally not be typed. The draft lives here as a string; the clamp
 * and the commit happen on blur or Enter — when the reader has said what they
 * mean — and an emptied field reverts to the last committed value.
 */
const AyahField: React.FC<{
  value: number;
  max: number;
  label: string;
  onCommit: (value: number) => void;
}> = ({ value, max, label, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    setDraft(null);
    if (raw.trim() === '') return; // an emptied field reverts, never snaps to 1
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    onCommit(Math.min(Math.max(Math.round(parsed), 1), max));
  };

  return (
    <input
      type="number"
      min={1}
      max={max}
      value={draft ?? value}
      aria-label={label}
      title={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit((event.target as HTMLInputElement).value);
      }}
      className="field-quiet w-16 py-1 text-center text-[11px] tabular-nums"
    />
  );
};

/**
 * The reading position: surah, the ayah currently at the top of the viewport,
 * and — in Hafs only — the juz.
 *
 * The ayah is observed rather than stored: an IntersectionObserver over the
 * rendered ayat reports the topmost one still on screen. It deliberately does
 * NOT write to the store on every scroll tick — the word-sync engine already
 * owns per-frame state, and a second writer on the same path is how that kind
 * of machinery starts dropping frames.
 */
const ReadingPosition: React.FC<{ surahId: number; riwayah: 'hafs' | 'warsh' }> = ({
  surahId,
  riwayah,
}) => {
  const { t } = useI18n();
  const [ayah, setAyah] = useState<number | null>(null);

  useEffect(() => {
    setAyah(null);
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-verse-id]'));
    if (!nodes.length) return;

    const visible = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.verseId);
          if (!Number.isFinite(id)) continue;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        setAyah(visible.size ? Math.min(...visible) : null);
      },
      { root: document.querySelector('.quran-reading-viewport'), threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [surahId]);

  const juz = ayah != null ? juzFor(riwayah, surahId, ayah) : null;

  return (
    <p className="reading-position mx-auto max-w-[68rem]">
      <span className="reading-position-label">{t('quranAyah')}</span>
      <bdi className="tabular-nums">{ayah ?? '\u2014'}</bdi>
      {juz != null && (
        <>
          <span aria-hidden="true" className="reading-position-dot">&middot;</span>
          <span className="reading-position-label">{t('quranJuz')}</span>
          <bdi className="tabular-nums">{juz}</bdi>
        </>
      )}
    </p>
  );
};

const SurahReader: React.FC = () => {
  const { t, language } = useI18n();
  const surah = useQuranStore((state) => state.currentSurah);
  const surahIndex = useQuranStore((state) => state.surahs);
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
  /* 0 = repeat forever. Any other value plays the segment that many times and
     then lets the recitation continue — the memorisation flow. */
  const [repeatTimes, setRepeatTimes] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
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
  /* Gated on `!warshMode` for the same reason `syncActive` is: the timing
     data — and the word list that comes with it — is quran.com's HAFS text.
     Without the gate, `syncedWordsByAyah` still fed QuranVerseWords, which
     prefers it over the bundled ayah, so playing a Hafs recitation and then
     switching riwayah rendered the HAFS words under Warsh attribution and
     Warsh numbering. The two readings are never mixed. */
  const synced = !warshMode && surah && read ? syncedAudioBySurah[`${read.id}:${surah.id}`] ?? null : null;
  const syncedWordsByAyah = useMemo(
    () => new Map(synced?.wordsByAyah.map((entry) => [entry.ayah, entry.words]) ?? []),
    [synced],
  );
  const repeatSelection = useMemo<QuranRepeatSelection>(
    () => ({ mode: repeatMode, startAyah: repeatStart, endAyah: repeatEnd, times: repeatTimes }),
    [repeatEnd, repeatMode, repeatStart, repeatTimes],
  );
  const { activeAyah, loopsDone } = useWordSync(
    syncActive,
    synced,
    surah?.id ?? null,
    repeatSelection,
  );

  useEffect(() => {
    if (!surah) return;
    setRepeatMode('off');
    setRepeatStart(1);
    setRepeatEnd(1);
    setRepeatTimes(0);
  }, [surah?.id]);

  /* Recitation speed. Applied only while OUR station is the one playing, and
     reset to 1 the moment it is not — the radio and the Listen tab share this
     same element, and a 1.5x radio stream would be a bug shipped to every
     station. The element remounts when the station changes (its key is
     id+url), so the rate is re-applied on syncActive/url transitions. The
     word tracker is unaffected: it reads currentTime, which runs on the same
     accelerated clock as the audio itself. */
  useEffect(() => {
    const element = audioElementHolder.current;
    if (!element) return;
    element.playbackRate = syncActive ? playbackRate : 1;
    return () => {
      element.playbackRate = 1;
    };
  }, [playbackRate, syncActive, currentStation?.url]);

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

  /* Committing a repeat target while the recitation is playing seeks to it
     immediately. Before this, typing a new ayah number changed only the loop
     bounds — playback stayed wherever it was until it happened to drift past
     the segment's end, which read as the control simply not working. */
  const seekToAyahIfPlaying = (ayah: number) => {
    if (!syncActive || !synced) return;
    const segment = synced.ayahTimings.find((timing) => timing.ayah === ayah);
    if (segment) {
      seekToTimingMs(segment.startMs);
      setFollowPaused(false);
    }
  };

  /* Step one ayah in either direction. Anchored on the ayah being recited
     when there is one, else the reader's last-read ayah — so the very first
     press after starting playback goes where the reader expects rather than
     to ayah 2 of a surah they are forty ayat into. */
  const stepAyah = (delta: 1 | -1) => {
    if (!syncActive || !synced) return;
    const anchor =
      activeAyah ?? (lastRead?.surahId === surah.id ? lastRead.verseId : 1);
    const target = Math.min(Math.max(anchor + delta, 1), surah.total_verses);
    const segment = synced.ayahTimings.find((timing) => timing.ayah === target);
    if (segment) {
      seekToTimingMs(segment.startMs);
      setFollowPaused(false);
      setLastRead({ surahId: surah.id, verseId: target });
    }
  };

  const handleRepeatMode = (mode: QuranRepeatMode) => {
    const preferredAyah = clampAyah(
      activeAyah ?? (lastRead?.surahId === surah.id ? lastRead.verseId : repeatStart),
    );
    if (mode === 'ayah') {
      setRepeatStart(preferredAyah);
      setRepeatEnd(preferredAyah);
      seekToAyahIfPlaying(preferredAyah);
    } else if (mode === 'range') {
      setRepeatStart(Math.min(repeatStart, repeatEnd));
      setRepeatEnd(Math.max(repeatStart, repeatEnd));
      seekToAyahIfPlaying(Math.min(repeatStart, repeatEnd));
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
  // The cartouche naming the surah scrolls away with the page, so the sticky
  // toolbar carries the same identity in UI type: after ten screens of
  // Al-Baqarah the chrome still says which surah is open.
  const meta = surahIndex.find((entry) => entry.id === surah.id) ?? null;
  const surahCaption = [
    `${surah.total_verses} ${t('quranVerses')}`,
    meta ? t(revelationKey(meta.revelationType)) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const repeatOptions: Array<{ mode: QuranRepeatMode; label: string }> = [
    { mode: 'off', label: t('quranRepeatOff') },
    { mode: 'ayah', label: t('quranRepeatAyah') },
    { mode: 'range', label: t('quranRepeatRange') },
    { mode: 'surah', label: t('quranRepeatSurah') },
  ];
  /* "ayah 12 · 2/3" — the live summary of what repeat is doing. Null when off,
     which is what hides the chip. loopsDone can exceed times briefly on the
     final pass, so it is clamped for display. */
  const repeatChip = (() => {
    if (repeatMode === 'off') return null;
    if (repeatMode === 'surah') return t('quranRepeatSurah');
    const target =
      repeatMode === 'ayah'
        ? `${t('quranAyah')} ${repeatStart}`
        : `${repeatStart}–${repeatEnd}`;
    const progress =
      repeatTimes === 0
        ? '∞'
        : `${Math.min(loopsDone + 1, repeatTimes)}/${repeatTimes}`;
    return `${target} · ${progress}`;
  })();

  return (
    <div>
      {/* Toolbar: the surah's identity, then three primary objects on the line —
          play, reciter, riwayah — everything else folds into a panel, so the
          mushaf keeps the page. Hairline separators group them instead of a run
          of same-weight words floating at equal spacing. */}
      <div className="quran-toolbar sticky top-0 z-20 mb-4 px-1 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="me-1 min-w-0">
            <p className="truncate text-sm font-medium leading-5 text-text-primary">
              <bdi>{language === 'ar' ? surah.name : surah.transliteration}</bdi>
            </p>
            <p className="truncate text-[11px] leading-4 text-text-faint">
              <bdi>{surahCaption}</bdi>
            </p>
          </div>

          <ToolbarDivider />

          {!warshMode && read && (
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() => (syncActive ? togglePlay() : void handlePlaySurah())}
                disabled={preparingAudio}
                title={syncPlaying ? t('pause') : t('quranPlaySurah')}
                aria-label={syncPlaying ? t('pause') : t('quranPlaySurah')}
                className="group inline-flex items-center gap-2 py-1 text-xs font-medium text-text-primary transition-colors hover:text-accent-gold disabled:opacity-60 motion-reduce:transition-none"
              >
                {/* The page's one primary action, so it gets a transport ring
                    rather than another word at the same weight as the rest. */}
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-accent-gold/40 transition-colors group-hover:border-accent-gold motion-reduce:transition-none"
                >
                  {preparingAudio ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-text" />
                  ) : syncPlaying ? (
                    <Pause className="h-3 w-3 text-accent-gold" fill="currentColor" />
                  ) : (
                    <Play className="h-3 w-3 text-accent-gold" fill="currentColor" />
                  )}
                </span>
                {!syncPlaying && (
                  <span>{preparingAudio ? t('quranPreparingAudio') : t('quranPlaySurah')}</span>
                )}
              </button>

              {/* Ayah stepping — only while our station is live, because a
                  seek needs the timings AND the element to be ours. */}
              {syncActive && (
                <>
                  <button
                    type="button"
                    onClick={() => stepAyah(-1)}
                    title={t('quranPrevAyah')}
                    aria-label={t('quranPrevAyah')}
                    className="icon-btn h-7 w-7"
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepAyah(1)}
                    title={t('quranNextAyah')}
                    aria-label={t('quranNextAyah')}
                    className="icon-btn h-7 w-7"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {/* Repeat lives with the play control. It stays available before
                  playback too: setting a start ayah here is what seeds the
                  initial seek on the first press. */}
              <button
                type="button"
                onClick={() => toggleMenu('repeat')}
                aria-haspopup="dialog"
                aria-expanded={openMenu === 'repeat'}
                aria-pressed={repeatMode !== 'off'}
                title={repeatChip ? `${t('quranRepeat')} · ${repeatChip}` : t('quranRepeat')}
                aria-label={repeatChip ? `${t('quranRepeat')} · ${repeatChip}` : t('quranRepeat')}
                className={`icon-btn h-7 w-7 ${repeatMode === 'off' ? '' : 'text-accent-gold'}`}
              >
                <Repeat className="h-3.5 w-3.5" />
              </button>
              {/* The chip: repeat state used to live only inside the popover,
                  signalled outside it by a 14px icon changing colour. A
                  memorisation session runs for minutes — what it repeats and
                  how far through it is belongs on the toolbar. */}
              {repeatChip && (
                <span className="rounded-full border border-accent-gold/25 bg-accent-gold/10 px-2 py-0.5 text-[10px] font-medium leading-none text-accent-gold">
                  <bdi>{repeatChip}</bdi>
                </span>
              )}
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
                        <div className="mt-2 flex items-center justify-between gap-2 px-0.5 text-[11px] text-muted-text">
                          {t('quranAyah')}
                          <AyahField
                            value={repeatStart}
                            max={surah.total_verses}
                            label={t('quranAyah')}
                            onCommit={(next) => {
                              setRepeatStart(next);
                              setRepeatEnd(next);
                              seekToAyahIfPlaying(next);
                            }}
                          />
                        </div>
                      )}
                      {repeatMode === 'range' && (
                        <div className="mt-2 flex items-center justify-between gap-1.5 px-0.5 text-[11px] text-muted-text">
                          <AyahField
                            value={repeatStart}
                            max={surah.total_verses}
                            label={t('quranRepeatFrom')}
                            onCommit={(next) => {
                              setRepeatStart(next);
                              if (next > repeatEnd) setRepeatEnd(next);
                              seekToAyahIfPlaying(next);
                            }}
                          />
                          <span aria-hidden="true">–</span>
                          <AyahField
                            value={repeatEnd}
                            max={surah.total_verses}
                            label={t('quranRepeatTo')}
                            onCommit={(next) => {
                              setRepeatEnd(next);
                              if (next < repeatStart) setRepeatStart(next);
                            }}
                          />
                        </div>
                      )}
                      {/* How many passes. Off (infinite) or a count — after the
                          count, the recitation flows on. Hidden for surah mode,
                          which loops the file itself. */}
                      {(repeatMode === 'ayah' || repeatMode === 'range') && (
                        <div className="mt-2 px-0.5">
                          <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-faint">
                            {t('quranRepeatTimes')}
                          </p>
                          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('quranRepeatTimes')}>
                            {[0, 2, 3, 5, 10].map((count) => (
                              <button
                                key={count}
                                type="button"
                                role="radio"
                                aria-checked={repeatTimes === count}
                                onClick={() => setRepeatTimes(count)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors motion-reduce:transition-none ${
                                  repeatTimes === count
                                    ? 'border-accent-gold/60 bg-accent-gold/15 text-accent-gold'
                                    : 'border-border text-muted-text hover:text-text-primary'
                                }`}
                              >
                                {count === 0 ? '∞' : `${count}×`}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Recitation speed. Pitch is preserved by the platform
                          default; the word tracker reads the same accelerated
                          clock, so sync holds at every rate. */}
                      <div className="mt-2 border-t border-border pt-2 px-0.5">
                        <p className="mb-1 text-[10px] uppercase tracking-[0.12em] text-text-faint">
                          {t('playbackSpeed')}
                        </p>
                        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('playbackSpeed')}>
                          {[0.75, 1, 1.25, 1.5].map((rate) => (
                            <button
                              key={rate}
                              type="button"
                              role="radio"
                              aria-checked={playbackRate === rate}
                              onClick={() => setPlaybackRate(rate)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums transition-colors motion-reduce:transition-none ${
                                playbackRate === rate
                                  ? 'border-accent-gold/60 bg-accent-gold/15 text-accent-gold'
                                  : 'border-border text-muted-text hover:text-text-primary'
                              }`}
                            >
                              {rate}×
                            </button>
                          ))}
                        </div>
                      </div>
                </ToolbarPanel>
              )}
            </div>
          )}

          {!warshMode && read && <ToolbarDivider />}

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
                className="inline-flex max-w-[15rem] items-center gap-1 py-1 text-xs text-muted-text transition-colors hover:text-text-primary motion-reduce:transition-none"
              >
                <span className="truncate">
                  <bdi>{readName}</bdi>
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

          {!warshMode && timingReads.length > 0 && <ToolbarDivider />}

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
                {/* Two unlabelled ± buttons gave no idea what they changed or
                    where the size currently sat. The specimen A and the live
                    value say both without needing a dictionary string. */}
                <div className="flex items-center justify-between gap-3 px-1 py-1">
                  <Type aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-text" />
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFontSize(fontSize - 2)}
                      className="icon-btn h-7 w-7"
                      title="A-"
                      aria-label="A-"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-[11px] tabular-nums text-text-faint">
                      <bdi>{Math.round(fontSize)}</bdi>
                    </span>
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
      {/* Where you are, which a reader checks constantly and the app could not
          previously tell them. Juz appears only in Hafs: the thirty boundaries
          are agreed in the Kufan numbering, and 50 of the 114 surahs carry a
          different ayah count in Warsh, so the same table would name the wrong
          juz there. A missing figure beats a confidently wrong one. */}
      <ReadingPosition surahId={surah.id} riwayah={riwayah} />

      <div className="quran-reading-frame mx-auto mt-2 max-w-[68rem]">
        {/* The illuminated band. It is a sibling of the scroller, not a child,
            so it frames the visible page and does not scroll away with the
            text. */}
        <div className="quran-jadwal" aria-hidden="true" />
        {/* The opaque page margin, painted over the scrolling text so no ayah
            ever crosses the rules or the band. See .quran-frame-shutter. */}
        <div className="quran-frame-shutter" aria-hidden="true" />
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
                <div key={verse.id} data-verse-id={verse.id}>
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
                      <AyahMarker ayah={verse.id} />
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
                  data-verse-id={verse.id}
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
                  <AyahMarker ayah={verse.id} />
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

/**
 * The end-of-ayah medallion.
 *
 * The obvious markup — U+06DD followed by the digits, and let the font put
 * them inside the ring — is not portable. That composition is done by the
 * SHAPER, and HarfBuzz only performs it from a certain version on: measured
 * side by side on one binary, HarfBuzz 8.3 sets the digits inside the ring
 * while HarfBuzz 2.7 leaves the ring empty and strands the number beside it.
 * Windows never shows it (DirectWrite, no HarfBuzz), and neither does a
 * developer machine on a current distro — but a reader on an older one gets
 * a page of empty medallions, which is what was reported from the field.
 *
 * So nothing here depends on the shaper. The ring is U+06DD ALONE — no digit
 * follows it in its text run, so there is nothing to compose and every
 * HarfBuzz draws the same glyph — and the number is a separate element that
 * CSS centres on top of it. The marker is an ornament, not Qur'anic text
 * (hence the Amiri face and `role="img"`), so composing it this way is a
 * typographic choice, not a change to the mushaf.
 */
const AyahMarker: React.FC<{ ayah: number }> = ({ ayah }) => (
  <span className="quran-ayah-marker" role="img" aria-label={`\u0622\u064a\u0629 ${ayah}`}>
    <span className="quran-ayah-ring" aria-hidden="true">
      {'\u06dd'}
    </span>
    <span className="quran-ayah-number" aria-hidden="true">
      {toArabicDigits(ayah)}
    </span>
  </span>
);

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
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex max-h-[70vh] flex-col overflow-hidden border-border pb-1 xl:border-e xl:pe-5">
        <div className="shrink-0">
          <div className="rule-head">
            <span className="text-xs font-semibold tracking-wide text-text-primary">
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
            <p className="py-3 text-xs text-danger-red">
              <bdi>{recitersError}</bdi>
            </p>
          )}
          {/* Same two-line rhythm as the surah index, so Read and Listen read as
              one page rather than two designs. */}
          {filteredReciters.map((entry) => {
            const selected = reciter?.id === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => selectReciter(entry.id)}
                aria-current={selected ? 'true' : undefined}
                className={`rule-row w-full items-start gap-3 py-2.5 text-start ${
                  selected ? 'rule-row-active' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-accent-gold/45 text-accent-gold' : 'border-border text-text-faint'
                  }`}
                >
                  <Headphones className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] font-medium leading-5 text-text-primary"
                    title={entry.name}
                  >
                    <bdi>{entry.name}</bdi>
                  </span>
                  <span
                    className="mt-px block truncate text-[11px] leading-4 text-text-faint"
                    title={entry.moshafName}
                  >
                    <bdi>{entry.moshafName}</bdi>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex max-h-[70vh] min-h-[19rem] flex-col">
        {reciter ? (
          <>
            <div className="rule-head shrink-0">
              <span className="min-w-0 truncate text-sm font-semibold text-text-primary" title={reciter.name}>
                <bdi>{reciter.name}</bdi>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-text">
                <bdi>{availableSurahs.length}</bdi>
              </span>
            </div>
            {/* Ruled rows in columns, not a grid of bordered boxes. The boxes
                also carried `primary-blue` for the playing surah, which is a
                SECOND accent on a page that otherwise has exactly one. */}
            <div className="min-h-0 flex-1 overflow-y-auto pe-1">
              <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 2xl:grid-cols-3">
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
                      className={`rule-row group w-full py-2 text-start ${
                        isCurrent ? 'rule-row-active' : ''
                      }`}
                    >
                      <span
                        className={`w-6 shrink-0 text-end text-[11px] tabular-nums ${
                          isCurrent ? 'text-accent-gold' : 'text-text-faint'
                        }`}
                      >
                        <bdi>{surah.id}</bdi>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">
                        <bdi>{surah.transliteration}</bdi>
                      </span>
                      <span className="arabic-text shrink-0 max-w-[7rem] truncate text-[13px] text-muted-text">
                        <bdi>{surah.name}</bdi>
                      </span>
                      {/* One hundred and fourteen play glyphs at full strength
                          is a field of arrowheads; the mark belongs to the row
                          being pointed at, and to whatever is playing. */}
                      {isCurrent && playing ? (
                        <Pause className="h-3.5 w-3.5 shrink-0 text-accent-gold" fill="currentColor" />
                      ) : (
                        <Play
                          className={`h-3.5 w-3.5 shrink-0 transition-opacity motion-reduce:transition-none ${
                            isCurrent
                              ? 'text-accent-gold'
                              : 'text-text-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                          }`}
                          fill="currentColor"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          !recitersLoading && (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <span
                aria-hidden="true"
                className="mb-5 flex h-16 w-16 items-center justify-center border border-accent-gold/25"
              >
                <span className="flex h-[3.25rem] w-[3.25rem] items-center justify-center border border-accent-gold/15">
                  <Headphones className="h-6 w-6 text-accent-gold/70" />
                </span>
              </span>
              <p className="max-w-sm text-sm text-text-soft">
                <bdi>{recitersError ?? t('quranNoReciters')}</bdi>
              </p>
              <span aria-hidden="true" className="gold-thread mt-5 w-28" />
            </div>
          )
        )}
      </section>
    </div>
  );
};
