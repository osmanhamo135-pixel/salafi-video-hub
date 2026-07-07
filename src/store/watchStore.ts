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

  setQuery: (query: string) => void;
  search: () => Promise<void>;
  play: (item: YoutubeSearchItem) => Promise<void>;
  playUrl: (url: string) => Promise<void>;
  closePlayer: () => void;
  enableEmbedFallback: () => void;
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
    await startPlayback(set, item.url, item.title);
  },

  playUrl: async (url) => {
    await startPlayback(set, url, null);
  },

  closePlayer: () => {
    resolveRequestId += 1;
    set({ current: null, resolving: false, resolvingTitle: null, resolveError: null, useEmbed: false });
  },

  enableEmbedFallback: () => set({ useEmbed: true }),
}));

async function startPlayback(
  set: (partial: Partial<WatchState>) => void,
  url: string,
  title: string | null,
) {
  const requestId = ++resolveRequestId;
  set({ resolving: true, resolvingTitle: title, resolveError: null, current: null, useEmbed: false });
  try {
    const stream = await invoke<YoutubeStream>('youtube_resolve', { url });
    if (requestId !== resolveRequestId) return;
    set({ current: stream, resolving: false, resolvingTitle: null, resolveError: null });
  } catch (error) {
    if (requestId !== resolveRequestId) return;
    set({ resolving: false, resolvingTitle: null, resolveError: getMessage(error) });
  }
}
