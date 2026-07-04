import { create } from 'zustand';
import { ImportResult, Playlist, Video, PlaylistStats } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { getErrorMessage, withTimeout } from '@/utils/async';

interface AppState {
  playlists: Playlist[];
  playlistsLoading: boolean;
  playlistsError: string | null;
  selectedPlaylistId: string | null;
  searchQuery: string;
  searchResults: { videos: Video[]; playlists: Playlist[] } | null;
  thumbnailJobsRunning: boolean;
  thumbnailQueueLength: number;
  thumbnailProcessedCount: number;
  thumbnailGeneratedCount: number;
  thumbnailFailedCount: number;
  thumbnailSkippedCount: number;
  thumbnailRefreshVersion: number;
  progressRefreshVersion: number;
  importRefreshVersion: number;
  stats: PlaylistStats | null;

  setPage: (page: string) => void;
  loadPlaylists: () => Promise<void>;
  importFolder: (path: string, includeSubfolders?: boolean) => Promise<ImportResult>;
  importSingleVideo: (path: string) => Promise<ImportResult>;
  removePlaylist: (id: string) => Promise<void>;
  search: (query: string) => Promise<void>;
  loadStats: () => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  markImportFinished: () => void;
  markProgressUpdated: () => void;
  markThumbnailUpdated: (status?: string) => void;
  startThumbnailBatch: (total: number) => void;
  finishThumbnailBatch: (result?: Partial<ThumbnailBatchSummary>) => void;
}

interface ThumbnailBatchSummary {
  generated_count: number;
  skipped_count: number;
  failed_count: number;
}

let playlistsLoadRequestId = 0;

export const useAppStore = create<AppState>((set, get) => ({
  playlists: [],
  playlistsLoading: false,
  playlistsError: null,
  selectedPlaylistId: null,
  searchQuery: '',
  searchResults: null,
  thumbnailJobsRunning: false,
  thumbnailQueueLength: 0,
  thumbnailProcessedCount: 0,
  thumbnailGeneratedCount: 0,
  thumbnailFailedCount: 0,
  thumbnailSkippedCount: 0,
  thumbnailRefreshVersion: 0,
  progressRefreshVersion: 0,
  importRefreshVersion: 0,
  stats: null,

  setPage: () => {},

  loadPlaylists: async () => {
    const requestId = ++playlistsLoadRequestId;
    set({ playlistsLoading: true, playlistsError: null });
    try {
      const playlists = await withTimeout(
        invoke<Playlist[]>('get_all_playlists'),
        12000,
        'Loading library',
      );
      if (requestId === playlistsLoadRequestId) {
        set({ playlists, playlistsLoading: false, playlistsError: null });
      }
    } catch (error) {
      console.error('Failed to load playlists:', error);
      if (requestId === playlistsLoadRequestId) {
        set({ playlistsLoading: false, playlistsError: getErrorMessage(error, 'Failed to load library.') });
      }
    }
  },

  importFolder: async (path: string, includeSubfolders = true) => {
    try {
      const result = await invoke<ImportResult>('import_folder', { path, includeSubfolders });
      await get().loadPlaylists();
      await get().loadStats();
      return result;
    } catch (error) {
      console.error('Failed to import folder:', error);
      throw error;
    }
  },

  importSingleVideo: async (path: string) => {
    try {
      const result = await invoke<ImportResult>('import_single_video', { path });
      await get().loadPlaylists();
      await get().loadStats();
      return result;
    } catch (error) {
      console.error('Failed to import video:', error);
      throw error;
    }
  },

  removePlaylist: async (id: string) => {
    try {
      await invoke('remove_playlist_from_library', { id });
      await get().loadPlaylists();
      await get().loadStats();
    } catch (error) {
      console.error('Failed to remove playlist:', error);
      throw error;
    }
  },

  search: async (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      set({ searchQuery: '', searchResults: null });
      return;
    }

    try {
      const [videos, playlists] = await Promise.all([
        withTimeout(invoke<Video[]>('search_videos', { query: trimmedQuery }), 12000, 'Searching videos'),
        withTimeout(invoke<Playlist[]>('get_all_playlists'), 12000, 'Loading playlists for search'),
      ]);
      const normalizedQuery = trimmedQuery.toLowerCase();
      const filteredPlaylists = playlists.filter(p =>
        p.name.toLowerCase().includes(normalizedQuery) ||
        p.folderPath.toLowerCase().includes(normalizedQuery)
      );
      set({
        searchQuery: trimmedQuery,
        searchResults: { videos, playlists: filteredPlaylists }
      });
    } catch (error) {
      console.error('Search failed:', error);
    }
  },

  loadStats: async () => {
    try {
      const stats = await withTimeout(
        invoke<PlaylistStats>('get_playlist_stats'),
        12000,
        'Loading library stats',
      );
      set({ stats });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },

  refreshPlaylists: async () => {
    await get().loadPlaylists();
    await get().loadStats();
  },

  markImportFinished: () => {
    set((state) => ({ importRefreshVersion: state.importRefreshVersion + 1 }));
  },

  markProgressUpdated: () => {
    set((state) => ({ progressRefreshVersion: state.progressRefreshVersion + 1 }));
  },

  markThumbnailUpdated: (status) => {
    set((state) => ({
      thumbnailProcessedCount: state.thumbnailProcessedCount + 1,
      thumbnailGeneratedCount: status === 'ready' ? state.thumbnailGeneratedCount + 1 : state.thumbnailGeneratedCount,
      thumbnailFailedCount: status === 'failed' ? state.thumbnailFailedCount + 1 : state.thumbnailFailedCount,
      thumbnailSkippedCount: status && status !== 'ready' && status !== 'failed'
        ? state.thumbnailSkippedCount + 1
        : state.thumbnailSkippedCount,
      thumbnailRefreshVersion: state.thumbnailRefreshVersion + 1,
    }));
  },

  startThumbnailBatch: (total: number) => {
    set({
      thumbnailJobsRunning: total > 0,
      thumbnailQueueLength: total,
      thumbnailProcessedCount: 0,
      thumbnailGeneratedCount: 0,
      thumbnailFailedCount: 0,
      thumbnailSkippedCount: 0,
    });
  },

  finishThumbnailBatch: (result) => {
    set((state) => ({
      thumbnailJobsRunning: false,
      thumbnailQueueLength: 0,
      thumbnailProcessedCount: Math.max(state.thumbnailProcessedCount, state.thumbnailQueueLength),
      thumbnailGeneratedCount: result?.generated_count ?? state.thumbnailGeneratedCount,
      thumbnailFailedCount: result?.failed_count ?? state.thumbnailFailedCount,
      thumbnailSkippedCount: result?.skipped_count ?? state.thumbnailSkippedCount,
      thumbnailRefreshVersion: state.thumbnailRefreshVersion + 1,
    }));
  },
}));
