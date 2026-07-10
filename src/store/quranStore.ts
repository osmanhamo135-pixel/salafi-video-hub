import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface SurahMeta {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  revelationType: string;
  totalVerses: number;
}

export interface QuranVerse {
  id: number;
  text: string;
  translation: string;
}

export interface QuranSurah {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  total_verses: number;
  verses: QuranVerse[];
}

export interface QuranReciter {
  id: string;
  name: string;
  moshafName: string;
  server: string;
  availableSurahs: number[];
}

export interface QuranBookmark {
  surahId: number;
  verseId: number;
}

export interface TimingRead {
  id: string;
  name: string;
  folderUrl: string;
}

export interface AyahTiming {
  ayah: number;
  startMs: number;
  endMs: number;
}

interface QuranState {
  surahs: SurahMeta[];
  surahsError: string | null;
  currentSurah: QuranSurah | null;
  loadingSurah: boolean;

  fontSize: number;
  showTranslation: boolean;
  lastRead: QuranBookmark | null;
  bookmarks: QuranBookmark[];

  reciters: QuranReciter[];
  recitersLoading: boolean;
  recitersError: string | null;
  selectedReciterId: string | null;

  /** Reciters that provide trusted per-ayah timing for synced highlighting. */
  timingReads: TimingRead[];
  timingReadsError: string | null;
  selectedTimingReadId: string | null;
  /** Loaded timings keyed by `${readId}:${surahId}`. */
  timings: Record<string, AyahTiming[]>;

  loadTimingReads: () => Promise<void>;
  selectTimingRead: (id: string) => void;
  loadTimings: (readId: string, surahId: number) => Promise<AyahTiming[] | null>;

  loadSurahs: () => Promise<void>;
  openSurah: (surahId: number) => Promise<void>;
  setFontSize: (size: number) => void;
  setShowTranslation: (show: boolean) => void;
  setLastRead: (bookmark: QuranBookmark) => void;
  toggleBookmark: (bookmark: QuranBookmark) => void;
  isBookmarked: (bookmark: QuranBookmark) => boolean;
  loadReciters: (language: string) => Promise<void>;
  selectReciter: (id: string) => void;
}

const LAST_READ_KEY = 'salafi-hub.quran-last-read.v1';
const BOOKMARKS_KEY = 'salafi-hub.quran-bookmarks.v1';
const FONT_KEY = 'salafi-hub.quran-font-size.v1';
const TRANSLATION_KEY = 'salafi-hub.quran-show-translation.v1';
const RECITER_KEY = 'salafi-hub.quran-reciter.v1';
const TIMING_READ_KEY = 'salafi-hub.quran-timing-read.v1';

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal.
  }
};

const getMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const useQuranStore = create<QuranState>((set, get) => ({
  surahs: [],
  surahsError: null,
  currentSurah: null,
  loadingSurah: false,

  fontSize: readJson(FONT_KEY, 30),
  showTranslation: readJson(TRANSLATION_KEY, false),
  lastRead: readJson<QuranBookmark | null>(LAST_READ_KEY, null),
  bookmarks: readJson<QuranBookmark[]>(BOOKMARKS_KEY, []),

  reciters: [],
  recitersLoading: false,
  recitersError: null,
  selectedReciterId: readJson<string | null>(RECITER_KEY, null),

  timingReads: [],
  timingReadsError: null,
  selectedTimingReadId: readJson<string | null>(TIMING_READ_KEY, null),
  timings: {},

  loadTimingReads: async () => {
    if (get().timingReads.length > 0) return;
    try {
      const timingReads = await invoke<TimingRead[]>('get_quran_timing_reads');
      set({ timingReads, timingReadsError: null });
      if (!get().selectedTimingReadId && timingReads.length > 0) {
        set({ selectedTimingReadId: timingReads[0].id });
      }
    } catch (error) {
      set({ timingReadsError: getMessage(error) });
    }
  },

  selectTimingRead: (id) => {
    writeJson(TIMING_READ_KEY, id);
    set({ selectedTimingReadId: id });
  },

  loadTimings: async (readId, surahId) => {
    const key = `${readId}:${surahId}`;
    const cached = get().timings[key];
    if (cached) return cached;
    try {
      const timings = await invoke<AyahTiming[]>('get_quran_ayah_timings', { readId, surahId });
      set({ timings: { ...get().timings, [key]: timings } });
      return timings;
    } catch {
      return null;
    }
  },

  loadSurahs: async () => {
    if (get().surahs.length > 0) return;
    try {
      const surahs = await invoke<SurahMeta[]>('get_quran_surahs');
      set({ surahs, surahsError: null });
    } catch (error) {
      set({ surahsError: getMessage(error) });
    }
  },

  openSurah: async (surahId) => {
    if (get().loadingSurah || get().currentSurah?.id === surahId) return;
    set({ loadingSurah: true });
    try {
      const surah = await invoke<QuranSurah>('get_quran_surah', { surahId });
      set({ currentSurah: surah, loadingSurah: false });
    } catch (error) {
      set({ loadingSurah: false, surahsError: getMessage(error) });
    }
  },

  setFontSize: (size) => {
    const clamped = Math.min(Math.max(Math.round(size), 20), 48);
    writeJson(FONT_KEY, clamped);
    set({ fontSize: clamped });
  },

  setShowTranslation: (show) => {
    writeJson(TRANSLATION_KEY, show);
    set({ showTranslation: show });
  },

  setLastRead: (bookmark) => {
    writeJson(LAST_READ_KEY, bookmark);
    set({ lastRead: bookmark });
  },

  toggleBookmark: (bookmark) => {
    const bookmarks = get().isBookmarked(bookmark)
      ? get().bookmarks.filter(
          (existing) => !(existing.surahId === bookmark.surahId && existing.verseId === bookmark.verseId),
        )
      : [...get().bookmarks, bookmark];
    writeJson(BOOKMARKS_KEY, bookmarks);
    set({ bookmarks });
  },

  isBookmarked: (bookmark) =>
    get().bookmarks.some(
      (existing) => existing.surahId === bookmark.surahId && existing.verseId === bookmark.verseId,
    ),

  loadReciters: async (language) => {
    if (get().recitersLoading || get().reciters.length > 0) return;
    set({ recitersLoading: true, recitersError: null });
    try {
      const reciters = await invoke<QuranReciter[]>('get_quran_reciters', { language });
      set({ reciters, recitersLoading: false });
      if (!get().selectedReciterId && reciters.length > 0) {
        set({ selectedReciterId: reciters[0].id });
      }
    } catch (error) {
      set({ recitersLoading: false, recitersError: getMessage(error) });
    }
  },

  selectReciter: (id) => {
    writeJson(RECITER_KEY, id);
    set({ selectedReciterId: id });
  },
}));

/** Builds the audio URL for a surah: `{server}{surah padded to 3 digits}.mp3`. */
export const surahAudioUrl = (server: string, surahId: number) =>
  `${server.endsWith('/') ? server : `${server}/`}${String(surahId).padStart(3, '0')}.mp3`;
