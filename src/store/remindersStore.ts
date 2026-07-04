import { create } from 'zustand';
import { Reminder, Playlist, Video } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { getErrorMessage, withTimeout } from '@/utils/async';

interface RemindersState {
  reminders: Reminder[];
  remindersLoading: boolean;
  playlists: Playlist[];
  videos: Video[];
  remindersError: string | null;
  loadReminders: () => Promise<void>;
  loadPlaylists: () => Promise<void>;
  loadVideos: () => Promise<void>;
  loadVideosByIds: (ids: string[]) => Promise<void>;
  createReminder: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt' | 'lastTriggeredAt' | 'lastFiredKey'>) => Promise<void>;
  updateReminder: (id: string, reminder: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
}

let remindersLoadRequestId = 0;

export const useRemindersStore = create<RemindersState>((set, get) => ({
  reminders: [],
  remindersLoading: false,
  playlists: [],
  videos: [],
  remindersError: null,

  loadReminders: async () => {
    const requestId = ++remindersLoadRequestId;
    set({ remindersLoading: true, remindersError: null });
    try {
      const reminders = await withTimeout(
        invoke<Reminder[]>('get_all_reminders'),
        10000,
        'Loading reminders',
      );
      if (requestId === remindersLoadRequestId) {
        set({ reminders, remindersLoading: false, remindersError: null });
      }
    } catch (error) {
      console.error('Failed to load reminders:', error);
      if (requestId === remindersLoadRequestId) {
        set({ remindersLoading: false, remindersError: getErrorMessage(error, 'Failed to load reminders.') });
      }
    }
  },

  loadPlaylists: async () => {
    try {
      const playlists = await withTimeout(
        invoke<Playlist[]>('get_all_playlists'),
        12000,
        'Loading reminder playlists',
      );
      set({ playlists });
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  },

  loadVideos: async () => {
    try {
      const videos = await withTimeout(
        invoke<Video[]>('get_all_videos'),
        12000,
        'Loading reminder videos',
      );
      set({ videos });
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  },

  loadVideosByIds: async (ids) => {
    const requestedIds = Array.from(
      new Set(ids.map((id) => id.trim()).filter(Boolean))
    );
    if (requestedIds.length === 0) return;

    const existingIds = new Set(get().videos.map((video) => video.id));
    const missingIds = requestedIds.filter((id) => !existingIds.has(id));
    if (missingIds.length === 0) return;

    try {
      const videos = await withTimeout(
        invoke<Video[]>('get_videos_by_ids', { ids: missingIds }),
        12000,
        'Loading reminder target videos',
      );
      set((state) => {
        const merged = new Map(state.videos.map((video) => [video.id, video]));
        videos.forEach((video) => merged.set(video.id, video));
        return { videos: Array.from(merged.values()) };
      });
    } catch (error) {
      console.error('Failed to load reminder target videos:', error);
    }
  },

  createReminder: async (reminder) => {
    try {
      await invoke('create_reminder', { reminder });
      await get().loadReminders();
    } catch (error) {
      console.error('Failed to create reminder:', error);
      throw error;
    }
  },

  updateReminder: async (id, reminder) => {
    try {
      const existing = get().reminders.find((item) => item.id === id);
      await invoke('update_reminder', { id, reminder: { ...existing, ...reminder } });
      await get().loadReminders();
    } catch (error) {
      console.error('Failed to update reminder:', error);
      throw error;
    }
  },

  deleteReminder: async (id) => {
    try {
      await invoke('delete_reminder', { id });
      await get().loadReminders();
    } catch (error) {
      console.error('Failed to delete reminder:', error);
      throw error;
    }
  },

  toggleReminder: async (id) => {
    try {
      await invoke('toggle_reminder', { id });
      await get().loadReminders();
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
      throw error;
    }
  },
}));
