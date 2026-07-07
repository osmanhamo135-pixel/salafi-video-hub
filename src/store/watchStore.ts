import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface YoutubeSearchItem {
  id: string;
  title: string;
  channel: string;
  durationSeconds: number;
  thumbnail: string;
  url: string;
  viewCount: number | null;
}

export interface YoutubeStream {
  videoId: string;
  videoUrl: string;
  title: string;
  channel: string;
  durationSeconds: number;
  thumbnail: string;
  sourceUrl: string;
  height: number;
}

export interface WatchHistoryItem {
  id: string;
  url: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number;
  positionSeconds: number;
  updatedAt: number;
}

const HISTORY_KEY = 'salafi-hub.watch-history.v1';
const HISTORY_LIMIT = 30;

const loadHistory = (): WatchHistoryItem[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHistory = (items: WatchHistoryItem[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    // Storage may be unavailable; history simply won't persist.
  }
};

interface WatchState {
  query: string;
  results: YoutubeSearchItem[];
  hasSearched: boolean;
  searching: boolean;
  searchError: string | null;

  current: YoutubeStream | null;
  resolving: boolean;
  resolvingTitle: string | null;
  resolveError: string | null;
  /** When the direct ad-free stream cannot play, fall back to the embed player. */
  useEmbed: boolean;
  /** Recently watched videos with resume positions, persisted across restarts. */
  history: WatchHistoryItem[];

  setQuery: (query: string) => void;
  search: () => Promise<void>;
  play: (item: YoutubeSearchItem) => Promise<void>;
  playUrl: (url: string) => Promise<void>;
  closePlayer: () => void;
  enableEmbedFallback: () => void;
  getResumePosition: (videoId: string) => number;
  recordProgress: (videoId: string, positionSeconds: number, durationSeconds: number) => void;
  removeFromHistory: (videoId: string) => void;
  clearHistory: () => void;
}

const getMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong.';
};

let searchRequestId = 0;
let resolveRequestId = 0;

export const useWatchStore = create<WatchState>((set, get) => ({
  query: '',
  results: [],
  hasSearched: false,
  searching: false,
  searchError: null,

  current: null,
  resolving: false,
  resolvingTitle: null,
  resolveError: null,
  useEmbed: false,
  history: loadHistory(),

  setQuery: (query) => set({ query }),

  search: async () => {
    const query = get().query.trim();
    if (!query || get().searching) return;

    const requestId = ++searchRequestId;
    set({ searching: true, searchError: null });
    try {
      const results = await invoke<YoutubeSearchItem[]>('youtube_search', { query });
      if (requestId !== searchRequestId) return;
      set({ results, searching: false, hasSearched: true, searchError: null });
    } catch (error) {
      if (requestId !== searchRequestId) return;
      set({ searching: false, hasSearched: true, searchError: getMessage(error) });
    }
  },

  play: async (item) => {
    await startPlayback(set, get, item.url, item.title);
  },

  playUrl: async (url) => {
    await startPlayback(set, get, url, null);
  },

  closePlayer: () => {
    resolveRequestId += 1;
    set({ current: null, resolving: false, resolvingTitle: null, resolveError: null, useEmbed: false });
  },

  enableEmbedFallback: () => set({ useEmbed: true }),

  getResumePosition: (videoId) => {
    const entry = get().history.find((item) => item.id === videoId);
    return entry?.positionSeconds ?? 0;
  },

  recordProgress: (videoId, positionSeconds, durationSeconds) => {
    const history = get().history.map((item) => {
      if (item.id !== videoId) return item;
      const nearEnd = durationSeconds > 0 && positionSeconds >= durationSeconds * 0.97;
      return {
        ...item,
        // A finished video restarts from the beginning next time.
        positionSeconds: nearEnd ? 0 : Math.max(positionSeconds, 0),
        durationSeconds: durationSeconds > 0 ? durationSeconds : item.durationSeconds,
        updatedAt: Date.now(),
      };
    });
    set({ history });
    saveHistory(history);
  },

  removeFromHistory: (videoId) => {
    const history = get().history.filter((item) => item.id !== videoId);
    set({ history });
    saveHistory(history);
  },

  clearHistory: () => {
    set({ history: [] });
    saveHistory([]);
  },
}));

async function startPlayback(
  set: (partial: Partial<WatchState>) => void,
  get: () => WatchState,
  url: string,
  title: string | null,
) {
  const requestId = ++resolveRequestId;
  set({ resolving: true, resolvingTitle: title, resolveError: null, current: null, useEmbed: false });
  try {
    const stream = await invoke<YoutubeStream>('youtube_resolve', { url });
    if (requestId !== resolveRequestId) return;
    set({ current: stream, resolving: false, resolvingTitle: null, resolveError: null });

    // Upsert into watch history (front of the list, keep any saved position).
    const existing = get().history.find((item) => item.id === stream.videoId);
    const entry: WatchHistoryItem = {
      id: stream.videoId,
      url: stream.sourceUrl,
      title: stream.title,
      channel: stream.channel,
      thumbnail: stream.thumbnail,
      durationSeconds: stream.durationSeconds,
      positionSeconds: existing?.positionSeconds ?? 0,
      updatedAt: Date.now(),
    };
    const history = [
      entry,
      ...get().history.filter((item) => item.id !== stream.videoId),
    ].slice(0, HISTORY_LIMIT);
    set({ history });
    saveHistory(history);
  } catch (error) {
    if (requestId !== resolveRequestId) return;
    set({ resolving: false, resolvingTitle: null, resolveError: getMessage(error) });
  }
}
