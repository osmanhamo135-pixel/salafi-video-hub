import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { ImportResult } from '@/types';
import { useAppStore } from '@/store/appStore';

export type DownloadStage = 'idle' | 'preparing' | 'installing' | 'downloading' | 'processing' | 'importing' | 'finished' | 'error';
export type DownloadQuality = 'fast' | 'best' | '1080' | '720' | '480';
export type CookieMode = 'auto' | 'chrome' | 'edge' | 'firefox' | 'brave' | 'opera' | 'none' | 'file';

export interface DownloadProgressPayload {
  jobId: string;
  stage: DownloadStage;
  message: string;
  percent: number | null;
  /** "3.2MiB/s", parsed by the backend from yt-dlp's own line. */
  speed?: string | null;
  /** "04:23" remaining, same source. */
  eta?: string | null;
  /** "3/25" batch position, when yt-dlp reports one. */
  detail?: string | null;
}

export interface MediaDownloadResult {
  outputDir: string;
  downloadedFiles: string[];
  previewThumbnailPath: string | null;
  importResult: ImportResult | null;
}

interface DownloadState {
  url: string;
  outputDir: string;
  cookiesPath: string;
  cookieMode: CookieMode;
  quality: DownloadQuality;
  audioOnly: boolean;
  downloadPlaylist: boolean;
  importAfterDownload: boolean;
  activeJobId: string | null;
  stage: DownloadStage;
  message: string;
  /** null = indeterminate: the stage is real work with no measurable percent. */
  percent: number | null;
  speed: string | null;
  eta: string | null;
  detail: string | null;
  result: MediaDownloadResult | null;
  error: string | null;
  startedAt: number | null;

  setUrl: (url: string) => void;
  setOutputDir: (outputDir: string) => void;
  setCookiesPath: (cookiesPath: string) => void;
  setCookieMode: (cookieMode: CookieMode) => void;
  setQuality: (quality: DownloadQuality) => void;
  setAudioOnly: (audioOnly: boolean) => void;
  setDownloadPlaylist: (downloadPlaylist: boolean) => void;
  setImportAfterDownload: (importAfterDownload: boolean) => void;
  resetCompleted: () => void;
  applyProgress: (payload: DownloadProgressPayload) => void;
  startDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
}

export const isDownloadWorking = (stage: DownloadStage) =>
  stage === 'preparing' ||
  stage === 'installing' ||
  stage === 'downloading' ||
  stage === 'processing' ||
  stage === 'importing';

let autoClearTimer: ReturnType<typeof setTimeout> | null = null;
let pendingProgress: DownloadProgressPayload | null = null;
let progressFlushTimer: ReturnType<typeof setTimeout> | null = null;

const flushProgress = (
  set: (partial: Partial<DownloadState>) => void,
  get: () => DownloadState,
) => {
  if (progressFlushTimer) {
    clearTimeout(progressFlushTimer);
    progressFlushTimer = null;
  }
  const payload = pendingProgress;
  pendingProgress = null;
  if (!payload) return;
  const { activeJobId } = get();
  if (activeJobId && payload.jobId !== activeJobId) return;
  set({
    activeJobId: activeJobId ?? payload.jobId,
    stage: payload.stage,
    message: payload.message,
    percent: typeof payload.percent === 'number' ? Math.round(payload.percent) : null,
    speed: payload.speed ?? null,
    eta: payload.eta ?? null,
    detail: payload.detail ?? null,
  });
};

const clearAutoClearTimer = () => {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
};

export const useDownloadStore = create<DownloadState>((set, get) => ({
  url: '',
  outputDir: '',
  cookiesPath: '',
  cookieMode: 'none',
  quality: 'fast',
  audioOnly: false,
  downloadPlaylist: false,
  importAfterDownload: true,
  activeJobId: null,
  stage: 'idle',
  message: '',
  percent: null,
  speed: null,
  eta: null,
  detail: null,
  result: null,
  error: null,
  startedAt: null,

  setUrl: (url) => set({ url }),
  setOutputDir: (outputDir) => set({ outputDir }),
  setCookiesPath: (cookiesPath) => set({ cookiesPath }),
  setCookieMode: (cookieMode) => set({ cookieMode }),
  setQuality: (quality) => set({ quality }),
  setAudioOnly: (audioOnly) => set((state) => ({
    audioOnly,
    importAfterDownload: audioOnly ? false : state.importAfterDownload,
  })),
  setDownloadPlaylist: (downloadPlaylist) => set({ downloadPlaylist }),
  setImportAfterDownload: (importAfterDownload) => set({ importAfterDownload }),
  resetCompleted: () => {
    clearAutoClearTimer();
    set({
      url: '',
      activeJobId: null,
      stage: 'idle',
      message: '',
      percent: null,
      speed: null,
      eta: null,
      detail: null,
      result: null,
      error: null,
      startedAt: null,
    });
  },

  applyProgress: (payload) => {
    const { activeJobId, stage } = get();
    if (activeJobId && payload.jobId !== activeJobId) return;
    /* Idle panels do not adopt terminal echoes: after a clear, a straggling
       "finished"/"importing" from the backend used to repopulate the panel
       and re-light the sidebar dot out of nowhere. */
    if (!activeJobId && (payload.stage === 'finished' || payload.stage === 'importing')) return;

    pendingProgress = payload;
    /* Coalesced to ~8 fps. The backend can emit several times a second
       (percent steps + file lines + the 550ms floor), and each set() used to
       re-render the whole Downloads page — the jank the owner felt. Stage
       CHANGES flush immediately so state transitions never lag. */
    const stageChanged = payload.stage !== stage;
    if (stageChanged) {
      flushProgress(set, get);
      return;
    }
    if (progressFlushTimer === null) {
      progressFlushTimer = setTimeout(() => flushProgress(set, get), 120);
    }
  },

  cancelDownload: async () => {
    const { activeJobId } = get();
    if (!activeJobId) return;
    try {
      await invoke('cancel_download', { jobId: activeJobId });
      // The running invoke unwinds with the marker; its catch block turns
      // that into a quiet reset. Nothing else to do here.
    } catch {
      /* Cancel is best-effort; the job may have just finished. */
    }
  },

  startDownload: async () => {
    const state = get();
    const trimmedUrl = state.url.trim();
    if (isDownloadWorking(state.stage) || !(trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://'))) {
      return;
    }

    const jobId = createJobId();
    clearAutoClearTimer();
    set({
      activeJobId: jobId,
      stage: 'preparing',
      message: 'Preparing downloader...',
      percent: null,
      speed: null,
      eta: null,
      detail: null,
      error: null,
      result: null,
      startedAt: Date.now(),
    });

    try {
      const usingCookiesFile = state.cookieMode === 'file';
      const downloadResult = await invoke<MediaDownloadResult>('download_youtube_video', {
        request: {
          jobId,
          url: trimmedUrl,
          outputDir: state.outputDir.trim() || null,
          cookiesPath: usingCookiesFile ? state.cookiesPath.trim() || null : null,
          cookiesFromBrowser: usingCookiesFile ? null : state.cookieMode,
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
        speed: null,
        eta: null,
        error: null,
      });
      /* No auto-clear. The 18s timer silently destroyed the batch card, the
         folder path and the open button while the user looked away. The
         result now stays until the next download or an explicit Clear. */
      await useAppStore.getState().refreshPlaylists();
    } catch (downloadError) {
      clearAutoClearTimer();
      const text =
        downloadError instanceof Error ? downloadError.message : String(downloadError);
      if (text.includes('__download_cancelled__')) {
        /* The user asked for this; it is not an error. Quiet return to idle. */
        set({
          activeJobId: null,
          stage: 'idle',
          message: '',
          percent: null,
          speed: null,
          eta: null,
          detail: null,
          error: null,
          startedAt: null,
        });
        return;
      }
      set({
        stage: 'error',
        error: text,
        message: 'Download failed.',
        /* The bar no longer sits parked at 63% under a failure headline, and
           the sidebar dot stops pulsing: the job is over. */
        percent: null,
        speed: null,
        eta: null,
        activeJobId: null,
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
