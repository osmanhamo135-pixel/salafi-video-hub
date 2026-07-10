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

interface RadioState {
  stations: RadioStation[];
  loading: boolean;
  loadError: string | null;
  loadedLanguage: string | null;

  current: RadioStation | null;
  playing: boolean;
  playbackError: boolean;
  volume: number;
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
  setVolume: (volume: number) => void;
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
  const value = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : 80;
};

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
  favorites: loadFavorites(),
  sleepMinutes: 0,
  sleepUntil: null,

  loadStations: async (language) => {
    const { loading, loadedLanguage, stations } = get();
    if (loading || (loadedLanguage === language && stations.length > 0)) return;

    set({ loading: true, loadError: null });
    try {
      const catalog = await invoke<RadioCatalog>('get_radio_stations', { language });
      set({ stations: catalog.stations, loading: false, loadedLanguage: language, loadError: null });
    } catch (error) {
      set({
        loading: false,
        loadError: error instanceof Error ? error.message : String(error),
      });
    }
  },

  play: (station) => {
    set({ current: station, playing: true, playbackError: false });
  },

  togglePlay: () => {
    const { current, playing } = get();
    if (!current) return;
    set({ playing: !playing, playbackError: false });
  },

  stop: () => {
    clearSleepTimer();
    set({ current: null, playing: false, playbackError: false, sleepMinutes: 0, sleepUntil: null });
  },

  retry: () => {
    const { current } = get();
    if (!current) return;
    // Re-set the same station; the player element reloads the stream.
    set({ playing: true, playbackError: false, current: { ...current } });
  },

  markPlaybackError: () => set({ playing: false, playbackError: true }),
  markPlaying: () => set({ playbackError: false }),

  setVolume: (volume) => {
    const clamped = Math.min(Math.max(Math.round(volume), 0), 100);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // Non-fatal.
    }
    set({ volume: clamped });
  },

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
