import { create } from 'zustand';
import { Settings } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { getErrorMessage, withTimeout } from '@/utils/async';

interface SettingsState {
  settings: Settings | null;
  settingsLoading: boolean;
  settingsError: string | null;
  ffmpegStatus: { status: string; path: string | null; ffprobePath: string | null; version: string | null } | null;

  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<Settings>) => Promise<void>;
  addImportedFolder: (path: string) => Promise<void>;
  removeImportedFolder: (path: string) => Promise<void>;
  setFfmpegPath: (path: string) => Promise<void>;
  detectFfmpeg: () => Promise<void>;
  exportBackup: () => Promise<string>;
  importBackup: (path: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  settingsLoading: false,
  settingsError: null,
  ffmpegStatus: null,

  loadSettings: async () => {
    const requestId = ++settingsLoadRequestId;
    set({ settingsLoading: true, settingsError: null });
    try {
      const settings = normalizeSettings(await withTimeout(
        invoke<Settings>('get_settings'),
        10000,
        'Loading settings',
      ));
      if (requestId === settingsLoadRequestId) {
        set({ settings, settingsLoading: false, settingsError: null });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      if (requestId === settingsLoadRequestId) {
        set({ settingsLoading: false, settingsError: getErrorMessage(error, 'Failed to load settings.') });
      }
    }
  },

  updateSettings: async (partial: Partial<Settings>) => {
    const current = get().settings;
    if (!current) return;
    
    const updated = normalizeSettings({ ...current, ...partial });
    try {
      const saved = normalizeSettings(await withTimeout(
        invoke<Settings>('update_settings', { settings: updated }),
        12000,
        'Saving settings',
      ));
      set({ settings: saved, settingsError: null });
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },

  addImportedFolder: async (path: string) => {
    try {
      const settings = normalizeSettings(await withTimeout(
        invoke<Settings>('add_imported_folder', { path }),
        12000,
        'Adding imported folder',
      ));
      set({ settings, settingsError: null });
    } catch (error) {
      console.error('Failed to add imported folder:', error);
      throw error;
    }
  },

  removeImportedFolder: async (path: string) => {
    try {
      const settings = normalizeSettings(await withTimeout(
        invoke<Settings>('remove_imported_folder', { path }),
        12000,
        'Removing imported folder',
      ));
      set({ settings, settingsError: null });
    } catch (error) {
      console.error('Failed to remove imported folder:', error);
      throw error;
    }
  },

  setFfmpegPath: async (path: string) => {
    try {
      const settings = normalizeSettings(await withTimeout(
        invoke<Settings>('set_ffmpeg_path', { path }),
        12000,
        'Saving FFmpeg path',
      ));
      set({ settings, settingsError: null });
    } catch (error) {
      console.error('Failed to set FFmpeg path:', error);
      throw error;
    }
  },

  detectFfmpeg: async () => {
    try {
      const status = await withTimeout(
        invoke<{ status: string; ffmpegPath: string | null; ffprobePath: string | null; version: string | null }>('get_ffmpeg_status'),
        10000,
        'Detecting FFmpeg',
      );
      set({ 
        ffmpegStatus: { 
          status: status.status, 
          path: status.ffmpegPath, 
          ffprobePath: status.ffprobePath,
          version: status.version 
        } 
      });
    } catch (error) {
      console.error('Failed to detect FFmpeg:', error);
    }
  },

  exportBackup: async () => {
    try {
      const path = await invoke<string>('export_backup');
      return path;
    } catch (error) {
      console.error('Failed to export backup:', error);
      throw error;
    }
  },

  importBackup: async (path: string) => {
    try {
      await invoke('import_backup', { path });
    } catch (error) {
      console.error('Failed to import backup:', error);
      throw error;
    }
  },
}));

const normalizeSettings = (settings: Settings): Settings => ({
  ...settings,
  language: settings.language === 'ar' ? 'ar' : 'en',
  theme: ['noor', 'emerald', 'pearl', 'mushaf', 'blue', 'red', 'onyx'].includes(settings.theme)
    ? settings.theme
    : 'noor',
  automaticThumbnailsMode: settings.automaticThumbnailsMode || 'automatic',
  reminderVolume: settings.reminderVolume ?? 80,
  importedFolders: settings.importedFolders ?? [],
});

let settingsLoadRequestId = 0;
