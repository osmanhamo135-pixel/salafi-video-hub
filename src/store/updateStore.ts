import { create } from 'zustand';
import { check, DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { getTranslation } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'installed'
  | 'upToDate'
  | 'error';

interface UpdateStoreState {
  phase: UpdatePhase;
  update: Update | null;
  error: string | null;
  progress: number;
  downloadedBytes: number;
  totalBytes: number | null;
  lastCheckedAt: number | null;
  dismissed: boolean;
  notifiedVersion: string | null;

  checkForUpdates: (options?: { manual?: boolean }) => Promise<void>;
  installUpdate: () => Promise<void>;
  restart: () => Promise<void>;
  dismiss: () => void;
}

const currentLanguage = () => useSettingsStore.getState().settings?.language ?? 'en';

const getMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
};

/** Fires an OS-level notification so the user is prompted even when the app is in the background. */
const notifyUpdateAvailable = async (version: string) => {
  try {
    const language = currentLanguage();
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === 'granted';
    }
    if (!granted) return;
    sendNotification({
      title: getTranslation(language, 'updateNotificationTitle'),
      body: `${getTranslation(language, 'updateAvailableBody')} (${version})`,
    });
  } catch (error) {
    console.info('[Salafi Video Hub] update notification skipped:', error);
  }
};

export const useUpdateStore = create<UpdateStoreState>((set, get) => ({
  phase: 'idle',
  update: null,
  error: null,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: null,
  lastCheckedAt: null,
  dismissed: false,
  notifiedVersion: null,

  checkForUpdates: async (options) => {
    const manual = options?.manual ?? false;
    const { phase } = get();
    if (phase === 'downloading' || phase === 'installing') return;

    set({ phase: 'checking', error: manual ? null : get().error });
    try {
      const available = await check({ timeout: 15000 });
      if (!available) {
        set({ phase: 'upToDate', update: null, lastCheckedAt: Date.now() });
        return;
      }

      set({
        phase: 'available',
        update: available,
        error: null,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: null,
        dismissed: false,
        lastCheckedAt: Date.now(),
      });

      if (get().notifiedVersion !== available.version) {
        set({ notifiedVersion: available.version });
        void notifyUpdateAvailable(available.version);
      }
    } catch (error) {
      const message = getMessage(error, getTranslation(currentLanguage(), 'updateServerNotReady'));
      if (manual) {
        set({ phase: 'error', error: message, lastCheckedAt: Date.now() });
      } else {
        set({ phase: get().phase === 'checking' ? 'idle' : get().phase, lastCheckedAt: Date.now() });
        console.info('[Salafi Video Hub] updater check skipped:', message);
      }
    }
  },

  installUpdate: async () => {
    const { update, phase } = get();
    if (!update || phase === 'downloading' || phase === 'installing') return;

    let total: number | null = null;
    set({ phase: 'downloading', error: null, progress: 0, downloadedBytes: 0, totalBytes: null });

    try {
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? null;
          set({ totalBytes: total, downloadedBytes: 0, progress: 0 });
          return;
        }
        if (event.event === 'Progress') {
          const downloadedBytes = get().downloadedBytes + event.data.chunkLength;
          const progress = total && total > 0
            ? Math.min((downloadedBytes / total) * 100, 100)
            : get().progress;
          set({ downloadedBytes, progress });
          return;
        }
        // Finished
        set({ phase: 'installing', progress: 100 });
      }, { timeout: 600000 });

      set({ phase: 'installed', progress: 100 });
    } catch (error) {
      set({
        phase: 'error',
        error: getMessage(error, getTranslation(currentLanguage(), 'updateCheckFailed')),
      });
    }
  },

  restart: async () => {
    await relaunch();
  },

  dismiss: () => set({ dismissed: true }),
}));
