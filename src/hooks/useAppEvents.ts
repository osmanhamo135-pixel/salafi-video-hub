import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';

interface ThumbnailPayload {
  videoId: string;
  thumbnailPath: string | null;
  thumbnailStatus: string;
  error: string | null;
}

interface ThumbnailBatchStarted {
  total: number;
}

interface ThumbnailBatchFinished {
  generated_count: number;
  skipped_count: number;
  failed_count: number;
}

export function useAppEvents() {
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let statsTimer: ReturnType<typeof setTimeout> | null = null;

    const isPlayerBusy = () => {
      const status = usePlayerStore.getState().status;
      return status === 'playing' || status === 'loadingMetadata' || status === 'resolvingPath';
    };

    const scheduleLibraryRefresh = () => {
      if (refreshTimer) return;
      const delay = isPlayerBusy() ? 15000 : 900;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (isPlayerBusy()) {
          scheduleLibraryRefresh();
          return;
        }
        useAppStore.getState().refreshPlaylists().catch(console.error);
      }, delay);
    };

    const scheduleStatsRefresh = () => {
      if (statsTimer) return;
      const delay = isPlayerBusy() ? 15000 : 1000;
      statsTimer = setTimeout(() => {
        statsTimer = null;
        if (isPlayerBusy()) {
          scheduleStatsRefresh();
          return;
        }
        useAppStore.getState().loadStats().catch(console.error);
      }, delay);
    };

    const unlisteners = [
      listen('import_finished', () => {
        useAppStore.getState().markImportFinished();
        scheduleLibraryRefresh();
      }),
      listen<ThumbnailBatchStarted>('thumbnail_batch_started', (event) => {
        useAppStore.getState().startThumbnailBatch(event.payload.total);
      }),
      listen<ThumbnailPayload>('thumbnail_generated', (event) => {
        useAppStore.getState().markThumbnailUpdated(event.payload.thumbnailStatus);
        if (isPlayerBusy()) return;
        usePlayerStore.getState().refreshVideo(event.payload.videoId).catch(console.error);
        scheduleLibraryRefresh();
      }),
      listen<ThumbnailBatchFinished>('thumbnail_batch_finished', (event) => {
        useAppStore.getState().finishThumbnailBatch(event.payload);
        scheduleLibraryRefresh();
      }),
      listen<{ videoId: string }>('progress_updated', (event) => {
        useAppStore.getState().markProgressUpdated();
        if (isPlayerBusy()) return;
        usePlayerStore.getState().refreshVideo(event.payload.videoId).catch(console.error);
        scheduleLibraryRefresh();
        scheduleStatsRefresh();
      }),
    ];

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (statsTimer) clearTimeout(statsTimer);
      void Promise.all(unlisteners).then((items) => {
        items.forEach((unlisten) => unlisten());
      });
    };
  }, []);
}
