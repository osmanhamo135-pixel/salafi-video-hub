import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type QuranRiwayah = 'hafs' | 'warsh';

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
  nameAr?: string;
  timingLevel: 'word' | 'ayah';
  folderUrl: string;
}

export interface AyahTiming {
  ayah: number;
  startMs: number;
  endMs: number;
}

export interface WordTiming {
  ayah: number;
  wordIndex: number;
  startMs: number;
  endMs: number;
}

export interface SyncedAyahWords {
  ayah: number;
  words: string[];
}

export interface SyncedSurahAudio {
  audioUrl: string;
  ayahTimings: AyahTiming[];
  wordTimings: WordTiming[];
  wordsByAyah: SyncedAyahWords[];
}

interface QuranState {
  /** Active riwayah: Hafs (default, Kufan numbering) or Warsh (Madani numbering). */
  riwayah: QuranRiwayah;
  surahs: SurahMeta[];
  /** Which riwayah `surahs` was actually loaded for. */
  surahsRiwayah: QuranRiwayah | null;
  surahsError: string | null;
  currentSurah: QuranSurah | null;
  /** Which riwayah `currentSurah`'s text was actually loaded for. */
  currentSurahRiwayah: QuranRiwayah | null;
  loadingSurah: boolean;

  fontSize: number;
  showTranslation: boolean;
  lastRead: QuranBookmark | null;
  bookmarks: QuranBookmark[];

  reciters: QuranReciter[];
  recitersLoading: boolean;
  recitersError: string | null;
  recitersLanguage: string | null;
  selectedReciterId: string | null;

  /** Reciters with exact word timing paired to the same chapter audio. */
  timingReads: TimingRead[];
  timingReadsError: string | null;
  selectedTimingReadId: string | null;
  /** Loaded audio and timing keyed by `${readId}:${surahId}`. */
  syncedAudio: Record<string, SyncedSurahAudio>;
  syncedAudioError: string | null;

  loadTimingReads: () => Promise<void>;
  selectTimingRead: (id: string) => void;
  loadSyncedAudio: (readId: string, surahId: number) => Promise<SyncedSurahAudio | null>;

  setRiwayah: (riwayah: QuranRiwayah) => void;
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

const RIWAYAH_KEY = 'salafi-hub.quran-riwayah.v1';
const lastReadKey = (riwayah: QuranRiwayah) =>
  riwayah === 'warsh' ? 'salafi-hub.quran-last-read.warsh.v1' : 'salafi-hub.quran-last-read.v1';
const bookmarksKey = (riwayah: QuranRiwayah) =>
  riwayah === 'warsh' ? 'salafi-hub.quran-bookmarks.warsh.v1' : 'salafi-hub.quran-bookmarks.v1';
const FONT_KEY = 'salafi-hub.quran-font-size.v1';
const TRANSLATION_KEY = 'salafi-hub.quran-show-translation.v1';
const RECITER_KEY = 'salafi-hub.quran-reciter.v1';
const TIMING_READ_KEY = 'salafi-hub.quran-timing-read.v1';

/**
 * Reads persisted JSON, falling back on anything that does not match the shape
 * the caller expects. Without the guard a value left by an older build (or a
 * corrupted one) reaches render as the wrong type — `bookmarks.some(...)` on a
 * non-array throws, and with no error boundary in the tree that is a permanent
 * white screen the user cannot recover from.
 */
const readJson = <T,>(key: string, fallback: T, isValid?: (value: unknown) => boolean): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (isValid && !isValid(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
};

const isBookmark = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  Number.isFinite((value as QuranBookmark).surahId) &&
  Number.isFinite((value as QuranBookmark).verseId);

const isBookmarkList = (value: unknown): boolean =>
  Array.isArray(value) && value.every(isBookmark);

const isNullableBookmark = (value: unknown): boolean => value === null || isBookmark(value);

const isRiwayah = (value: unknown): boolean => value === 'hafs' || value === 'warsh';

const isNullableString = (value: unknown): boolean =>
  value === null || typeof value === 'string';

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal.
  }
};

const getMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const initialRiwayah = readJson<QuranRiwayah>(RIWAYAH_KEY, 'hafs', isRiwayah);

/**
 * Monotonic ids for the two Qur'an fetches. Both are riwayah-sensitive: an
 * in-flight Hafs request must never be allowed to land after the reader has
 * switched to Warsh, or the mushaf would show one riwayah's text under the
 * other's attribution and verse numbering. Supersession also means a second
 * click is never silently dropped — the newer request simply wins.
 */
let surahListRequestId = 0;
let surahRequestId = 0;

export const useQuranStore = create<QuranState>((set, get) => ({
  riwayah: initialRiwayah,
  surahs: [],
  surahsRiwayah: null,
  surahsError: null,
  currentSurah: null,
  currentSurahRiwayah: null,
  loadingSurah: false,

  fontSize: readJson(FONT_KEY, 30, (value) => Number.isFinite(value)),
  showTranslation: readJson(TRANSLATION_KEY, false, (value) => typeof value === 'boolean'),
  lastRead: readJson<QuranBookmark | null>(lastReadKey(initialRiwayah), null, isNullableBookmark),
  bookmarks: readJson<QuranBookmark[]>(bookmarksKey(initialRiwayah), [], isBookmarkList),

  setRiwayah: (riwayah) => {
    if (get().riwayah === riwayah) return;
    writeJson(RIWAYAH_KEY, riwayah);
    const reopenSurah = get().currentSurah?.id ?? null;
    // Verse numbering differs between riwayat, so bookmarks and the last-read
    // position are kept separately per riwayah — never mixed.
    set({
      riwayah,
      surahs: [],
      surahsRiwayah: null,
      currentSurah: null,
      currentSurahRiwayah: null,
      lastRead: readJson<QuranBookmark | null>(lastReadKey(riwayah), null, isNullableBookmark),
      bookmarks: readJson<QuranBookmark[]>(bookmarksKey(riwayah), [], isBookmarkList),
      /* Recitation timing data is Hafs-only, word list included. Leaving it
         cached across a riwayah switch let the Hafs word text render inside
         a Warsh ayah — the one mixing the riwayah rule forbids outright. */
      syncedAudio: {},
      syncedAudioError: null,
    });
    void get()
      .loadSurahs()
      .then(() => {
        if (reopenSurah !== null && get().riwayah === riwayah) {
          void get().openSurah(reopenSurah);
        }
      });
  },

  reciters: [],
  recitersLoading: false,
  recitersError: null,
  recitersLanguage: null,
  selectedReciterId: readJson<string | null>(RECITER_KEY, null, isNullableString),

  timingReads: [],
  timingReadsError: null,
  selectedTimingReadId: readJson<string | null>(TIMING_READ_KEY, null, isNullableString),
  syncedAudio: {},
  syncedAudioError: null,

  loadTimingReads: async () => {
    if (get().timingReads.length > 0) return;
    try {
      const timingReads = await invoke<TimingRead[]>('get_quran_word_timing_reads');
      set({ timingReads, timingReadsError: null });
      const selected = get().selectedTimingReadId;
      if (!selected || !timingReads.some((read) => read.id === selected)) {
        const defaultRead = timingReads.find((read) => read.id === '7') ?? timingReads[0];
        if (defaultRead) {
          writeJson(TIMING_READ_KEY, defaultRead.id);
          set({ selectedTimingReadId: defaultRead.id });
        }
      }
    } catch (error) {
      set({ timingReadsError: getMessage(error) });
    }
  },

  selectTimingRead: (id) => {
    writeJson(TIMING_READ_KEY, id);
    set({ selectedTimingReadId: id });
  },

  loadSyncedAudio: async (readId, surahId) => {
    const key = `${readId}:${surahId}`;
    const cached = get().syncedAudio[key];
    if (cached) return cached;
    try {
      const synced = await invoke<SyncedSurahAudio>('get_quran_synced_audio', { readId, surahId });
      set({
        syncedAudio: { ...get().syncedAudio, [key]: synced },
        syncedAudioError: null,
      });
      return synced;
    } catch (error) {
      set({ syncedAudioError: getMessage(error) });
      return null;
    }
  },

  loadSurahs: async () => {
    const riwayah = get().riwayah;
    if (get().surahs.length > 0 && get().surahsRiwayah === riwayah) return;
    const requestId = ++surahListRequestId;
    try {
      const surahs = await invoke<SurahMeta[]>('get_quran_surahs', { riwayah });
      if (requestId !== surahListRequestId) return;
      set({ surahs, surahsRiwayah: riwayah, surahsError: null });
    } catch (error) {
      if (requestId !== surahListRequestId) return;
      set({ surahsError: getMessage(error) });
    }
  },

  openSurah: async (surahId) => {
    const riwayah = get().riwayah;
    // Re-open when the riwayah changed even if the surah id is the same: the
    // text, verse count and numbering are all different.
    if (get().currentSurah?.id === surahId && get().currentSurahRiwayah === riwayah) return;
    const requestId = ++surahRequestId;
    set({ loadingSurah: true, syncedAudioError: null });
    try {
      const surah = await invoke<QuranSurah>('get_quran_surah', { surahId, riwayah });
      if (requestId !== surahRequestId) return;
      set({ currentSurah: surah, currentSurahRiwayah: riwayah, loadingSurah: false });
    } catch (error) {
      if (requestId !== surahRequestId) return;
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
    writeJson(lastReadKey(get().riwayah), bookmark);
    set({ lastRead: bookmark });
  },

  toggleBookmark: (bookmark) => {
    const bookmarks = get().isBookmarked(bookmark)
      ? get().bookmarks.filter(
          (existing) => !(existing.surahId === bookmark.surahId && existing.verseId === bookmark.verseId),
        )
      : [...get().bookmarks, bookmark];
    writeJson(bookmarksKey(get().riwayah), bookmarks);
    set({ bookmarks });
  },

  isBookmarked: (bookmark) =>
    get().bookmarks.some(
      (existing) => existing.surahId === bookmark.surahId && existing.verseId === bookmark.verseId,
    ),

  loadReciters: async (language) => {
    const normalizedLanguage = language === 'ar' ? 'ar' : 'eng';
    if (get().recitersLanguage === normalizedLanguage) {
      if (get().recitersLoading || get().reciters.length > 0) return;
    }
    set({
      recitersLoading: true,
      recitersError: null,
      recitersLanguage: normalizedLanguage,
    });
    try {
      const reciters = await invoke<QuranReciter[]>('get_quran_reciters', {
        language: normalizedLanguage,
      });
      if (get().recitersLanguage !== normalizedLanguage) return;
      const selected = get().selectedReciterId;
      const selectedReciterId =
        selected && reciters.some((reciter) => reciter.id === selected)
          ? selected
          : reciters[0]?.id ?? null;
      set({
        reciters,
        recitersLoading: false,
        recitersLanguage: normalizedLanguage,
        selectedReciterId,
      });
      if (selectedReciterId) {
        writeJson(RECITER_KEY, selectedReciterId);
      }
    } catch (error) {
      if (get().recitersLanguage !== normalizedLanguage) return;
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
