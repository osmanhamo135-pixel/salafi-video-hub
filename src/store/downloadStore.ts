import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ImportResult } from '@/types';
import { useAppStore } from '@/store/appStore';

export type DownloadStage = 'idle' | 'preparing' | 'installing' | 'downloading' | 'importing' | 'finished' | 'error';
export type DownloadQuality = 'fast' | 'best' | '1080' | '720' | '480';

export interface DownloadProgressPayload {
  jobId: string;
  stage: DownloadStage;
  message: string;
  percent: number | null;
}

export interface MediaDownloadResult {
  outputDir: string;
  downloadedFiles: string[];
  importResult: ImportResult | null;
}

interface DownloadState {
  url: string;
  outputDir: string;
  cookiesPath: string;
  quality: DownloadQuality;
  audioOnly: boolean;
  downloadPlaylist: boolean;
  importAfterDownload: boolean;
  activeJobId: string | null;
  stage: DownloadStage;
  message: string;
  percent: number;
  result: MediaDownloadResult | null;
  error: string | null;
  startedAt: number | null;

  setUrl: (url: string) => void;
  setOutputDir: (outputDir: string) => void;
  setCookiesPath: (cookiesPath: string) => void;
  setQuality: (quality: DownloadQuality) => void;
  setAudioOnly: (audioOnly: boolean) => void;
  setDownloadPlaylist: (downloadPlaylist: boolean) => void;
  setImportAfterDownload: (importAfterDownload: boolean) => void;
  resetCompleted: () => void;
  applyProgress: (payload: DownloadProgressPayload) => void;
  startDownload: () => Promise<void>;
}

export const isDownloadWorking = (stage: DownloadStage) =>
  stage === 'preparing' || stage === 'installing' || stage === 'downloading' || stage === 'importing';

export const useDownloadStore = create<DownloadState>((set, get) => ({
  url: '',
  outputDir: '',
  cookiesPath: '',
  quality: 'fast',
  audioOnly: false,
  downloadPlaylist: false,
  importAfterDownload: true,
  activeJobId: null,
  stage: 'idle',
  message: '',
  percent: 0,
  result: null,
  error: null,
  startedAt: null,

  setUrl: (url) => set({ url }),
  setOutputDir: (outputDir) => set({ outputDir }),
  setCookiesPath: (cookiesPath) => set({ cookiesPath }),
  setQuality: (quality) => set({ quality }),
  setAudioOnly: (audioOnly) => set((state) => ({
    audioOnly,
    importAfterDownload: audioOnly ? false : state.importAfterDownload,
  })),
  setDownloadPlaylist: (downloadPlaylist) => set({ downloadPlaylist }),
  setImportAfterDownload: (importAfterDownload) => set({ importAfterDownload }),
  resetCompleted: () => set({
    activeJobId: null,
    stage: 'idle',
    message: '',
    percent: 0,
    result: null,
    error: null,
    startedAt: null,
  }),

  applyProgress: (payload) => {
    const { activeJobId } = get();
    if (activeJobId && payload.jobId !== activeJobId) return;

    set({
      activeJobId: activeJobId ?? payload.jobId,
      stage: payload.stage,
      message: payload.message,
      percent: typeof payload.percent === 'number'
        ? Math.round(payload.percent)
        : get().percent,
    });
  },

  startDownload: async () => {
    const state = get();
    const trimmedUrl = state.url.trim();
    if (isDownloadWorking(state.stage) || !(trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://'))) {
      return;
    }

    const jobId = createJobId();
    set({
      activeJobId: jobId,
      stage: 'preparing',
      message: 'Preparing downloader...',
      percent: 0,
      error: null,
      result: null,
      startedAt: Date.now(),
    });

    try {
      const downloadResult = await invoke<MediaDownloadResult>('download_youtube_video', {
        request: {
          jobId,
          url: trimmedUrl,
          outputDir: state.outputDir.trim() || null,
          cookiesPath: state.cookiesPath.trim() || null,
          quality: state.quality,
          audioOnly: state.audioOnly,
          downloadPlaylist: state.downloadPlaylist,
          importAfterDownload: state.importAfterDownload && !state.audioOnly,
        },
      });

      set({
        result: downloadResult,
        stage: 'finished',
        message: 'Download finished.',
        percent: 100,
        error: null,
      });
      await useAppStore.getState().refreshPlaylists();
    } catch (downloadError) {
      set({
        stage: 'error',
        error: downloadError instanceof Error ? downloadError.message : String(downloadError),
        message: 'Download failed.',
      });
    }
  },
}));

const createJobId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
