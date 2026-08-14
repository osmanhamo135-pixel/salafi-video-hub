import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface RadioStation {
  id: string;
  name: string;
  url: string;
}

interface RadioCatalog {
  stations: RadioStation[];
  fromCache: boolean;
  fetchedAt: number;
}

export type SleepMinutes = 0 | 15 | 30 | 60 | 90;

/**
 * Direct handle to the single global <audio> element (set by the mini-player).
 * The Quran sync engine reads the audio clock from here every animation frame
 * without touching React state — per the performance rules.
 */
export const audioElementHolder: { current: HTMLAudioElement | null } = { current: null };

interface RadioState {
  stations: RadioStation[];
  loading: boolean;
  loadError: string | null;
  loadedLanguage: string | null;

  current: RadioStation | null;
  playing: boolean;
  playbackError: boolean;
  volume: number;
  looping: boolean;
  favorites: string[];
  sleepMinutes: SleepMinutes;
  sleepUntil: number | null;

  loadStations: (language: string) => Promise<void>;
  play: (station: RadioStation) => void;
  togglePlay: () => void;
  stop: () => void;
  retry: () => void;
  markPlaybackError: () => void;
  markPlaying: () => void;
  markEnded: () => void;
  setVolume: (volume: number) => void;
  setLooping: (looping: boolean) => void;
  toggleLooping: () => void;
  toggleFavorite: (id: string) => void;
  setSleepMinutes: (minutes: SleepMinutes) => void;
}

const FAVORITES_KEY = 'salafi-hub.radio-favorites.v1';
const VOLUME_KEY = 'salafi-hub.radio-volume.v1';

const loadFavorites = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadVolume = (): number => {
  /* Runs while the store is being created, i.e. before React mounts: an
     unguarded throw here is a blank window, not a forgotten volume. */
  try {
    const value = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 80;
  } catch {
    return 80;
  }
};

/**
 * Catalog fetches are superseded rather than dropped. The old `loading` guard
 * meant that switching language while the first fetch was in flight returned
 * immediately, and nothing ever re-triggered — the user was left looking at the
 * other language's catalog with no error and no retry.
 */
let stationsRequestId = 0;
let stationsInFlightLanguage: string | null = null;

let sleepTimerId: ReturnType<typeof setTimeout> | null = null;

const clearSleepTimer = () => {
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
};

export const useRadioStore = create<RadioState>((set, get) => ({
  stations: [],
  loading: false,
  loadError: null,
  loadedLanguage: null,

  current: null,
  playing: false,
  playbackError: false,
  volume: loadVolume(),
  looping: false,
  favorites: loadFavorites(),
  sleepMinutes: 0,
  sleepUntil: null,

  loadStations: async (language) => {
    const { loadedLanguage, stations } = get();
    if (loadedLanguage === language && stations.length > 0) return;
    if (stationsInFlightLanguage === language) return;

    const requestId = ++stationsRequestId;
    stationsInFlightLanguage = language;
    set({ loading: true, loadError: null });
    try {
      const catalog = await invoke<RadioCatalog>('get_radio_stations', { language });
      if (requestId !== stationsRequestId) return;
      set({ stations: catalog.stations, loading: false, loadedLanguage: language, loadError: null });
    } catch (error) {
      if (requestId !== stationsRequestId) return;
      set({
        loading: false,
        loadError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (requestId === stationsRequestId) stationsInFlightLanguage = null;
    }
  },

  play: (station) => {
    set({ current: station, playing: true, playbackError: false, looping: false });
  },

  togglePlay: () => {
    const { current, playing } = get();
    if (!current) return;
    set({ playing: !playing, playbackError: false });
  },

  stop: () => {
    clearSleepTimer();
    set({
      current: null,
      playing: false,
      playbackError: false,
      looping: false,
      sleepMinutes: 0,
      sleepUntil: null,
    });
  },

  retry: () => {
    const { current } = get();
    if (!current) return;
    // Re-set the same station under a new object identity. This does NOT
    // remount the <audio> (its key `${id}-${url}` is unchanged), it only
    // re-runs the player's play effect — which is where the failed element is
    // reloaded. Without that reload the element keeps its MediaError and retry
    // can never recover.
    set({ playing: true, playbackError: false, current: { ...current } });
  },

  markPlaybackError: () => set({ playing: false, playbackError: true }),
  markPlaying: () => set({ playbackError: false }),
  // A finished recording must clear `playing`, or the mini-player keeps showing
  // Pause, the Quran page keeps believing sync is live, and the user's next
  // press only toggles the stale flag instead of restarting.
  markEnded: () => set({ playing: false }),

  setVolume: (volume) => {
    const clamped = Math.min(Math.max(Math.round(volume), 0), 100);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // Non-fatal.
    }
    set({ volume: clamped });
  },

  setLooping: (looping) => set({ looping }),
  toggleLooping: () => set({ looping: !get().looping }),

  toggleFavorite: (id) => {
    const favorites = get().favorites.includes(id)
      ? get().favorites.filter((existing) => existing !== id)
      : [...get().favorites, id];
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // Non-fatal.
    }
    set({ favorites });
  },

  setSleepMinutes: (minutes) => {
    clearSleepTimer();
    if (minutes === 0) {
      set({ sleepMinutes: 0, sleepUntil: null });
      return;
    }
    const sleepUntil = Date.now() + minutes * 60_000;
    sleepTimerId = setTimeout(() => {
      sleepTimerId = null;
      set({ playing: false, sleepMinutes: 0, sleepUntil: null });
    }, minutes * 60_000);
    set({ sleepMinutes: minutes, sleepUntil });
  },
}));
