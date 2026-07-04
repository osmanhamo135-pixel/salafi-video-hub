import { create } from 'zustand';
import { Video, Playlist, PlayerStatus, RepeatMode } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/store/settingsStore';

interface PlayerState {
  // Playlist context
  currentPlaylistId: string | null;
  currentVideoId: string | null;
  currentIndex: number;
  queueVideoIds: string[];
  videos: Map<string, Video>;
  playlist: Playlist | null;

  // Playback state
  status: PlayerStatus;
  duration: number;
  currentTime: number;
  progressPercent: number;

  // UI state
  isFullscreen: boolean;
  isMuted: boolean;
  volume: number;
  playbackRate: number;
  repeatMode: RepeatMode;
  autoplay: boolean;
  errorMessage: string | null;
  shouldAutoplayOnLoad: boolean;

  // Derived
  isPlayerOpen: boolean;
  playerOpenRequestId: number;

  // Actions
  openPlaylist: (playlistId: string, startVideoId?: string) => Promise<void>;
  playVideo: (videoId: string, options?: { autoplay?: boolean }) => Promise<void>;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleAutoplay: () => void;
  toggleFavorite: () => Promise<void>;
  toggleWatchLater: () => Promise<void>;
  markCompleted: () => Promise<void>;
  onTimeUpdate: (time: number) => void;
  onLoadedMetadata: (duration: number) => void;
  onCanPlay: () => void;
  onPlaying: () => void;
  onPause: () => void;
  onEnded: () => void;
  onError: (error: string) => void;
  refreshVideo: (videoId: string) => Promise<void>;
  refreshCurrentPlaylistData: () => Promise<void>;
  leavePlayerView: () => void;
  closePlayer: () => void;
}

let progressSaveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedTime = 0;
let lastStoreTimeUpdateAt = 0;
let thumbnailResumeTimer: ReturnType<typeof setTimeout> | null = null;

const videoMapFrom = (videos: Video[]) => {
  const videoMap = new Map<string, Video>();
  videos.forEach((video) => videoMap.set(video.id, video));
  return videoMap;
};

const setThumbnailGenerationPaused = (paused: boolean) => {
  if (thumbnailResumeTimer) {
    clearTimeout(thumbnailResumeTimer);
    thumbnailResumeTimer = null;
  }

  if (paused) {
    const performanceMode = useSettingsStore.getState().settings?.performanceMode ?? true;
    if (!performanceMode) return;
    invoke('set_thumbnail_generation_paused', { paused: true }).catch(console.error);
    return;
  }

  thumbnailResumeTimer = setTimeout(() => {
    invoke('set_thumbnail_generation_paused', { paused: false }).catch(console.error);
  }, 1500);
};

const rememberPlaybackTarget = (playlistId: string | null, videoId: string | null) => {
  const { settings, updateSettings } = useSettingsStore.getState();
  if (!settings) return;

  updateSettings({
    lastOpenedPlaylistId: playlistId ?? settings.lastOpenedPlaylistId,
    lastPlayedVideoId: videoId ?? settings.lastPlayedVideoId,
  }).catch(console.error);
};

const hydrateFullQueue = async (playlistId: string, requestId: number) => {
  try {
    const [playlist, videos] = await Promise.all([
      invoke<Playlist | null>('get_playlist', { id: playlistId }),
      invoke<Video[]>('get_videos_by_playlist', { playlistId }),
    ]);

    if (!playlist) return;

    const state = usePlayerStore.getState();
    if (state.playerOpenRequestId !== requestId || state.currentPlaylistId !== playlistId) return;

    const queueIds = videos.map((video) => video.id);
    const currentVideoId = state.currentVideoId;
    const currentIndex = currentVideoId ? queueIds.indexOf(currentVideoId) : -1;

    setTimeout(() => {
      const latestState = usePlayerStore.getState();
      if (latestState.playerOpenRequestId !== requestId || latestState.currentPlaylistId !== playlistId) return;

      usePlayerStore.setState({
        playlist,
        videos: videoMapFrom(videos),
        queueVideoIds: queueIds,
        currentIndex,
      });
    }, 0);
  } catch (error) {
    console.error('Failed to hydrate full player queue:', error);
  }
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentPlaylistId: null,
  currentVideoId: null,
  currentIndex: -1,
  queueVideoIds: [],
  videos: new Map(),
  playlist: null,
  status: 'idle',
  duration: 0,
  currentTime: 0,
  progressPercent: 0,
  isFullscreen: false,
  isMuted: false,
  volume: 1,
  playbackRate: 1,
  repeatMode: 'none',
  autoplay: true,
  errorMessage: null,
  shouldAutoplayOnLoad: false,
  isPlayerOpen: false,
  playerOpenRequestId: 0,

  openPlaylist: async (playlistId: string, startVideoId?: string) => {
    const nextOpenRequestId = get().playerOpenRequestId + 1;

    try {
      setThumbnailGenerationPaused(true);
      set({
        currentPlaylistId: playlistId,
        currentVideoId: null,
        currentIndex: -1,
        queueVideoIds: [],
        videos: new Map(),
        playlist: null,
        status: 'resolvingPath',
        isPlayerOpen: true,
        playerOpenRequestId: nextOpenRequestId,
        errorMessage: null,
        shouldAutoplayOnLoad: false,
      });

      const playlistPromise = invoke<Playlist | null>('get_playlist', { id: playlistId });
      const selectedVideoPromise = startVideoId
        ? invoke<Video | null>('get_video', { id: startVideoId })
        : Promise.resolve<Video | null>(null);

      const [playlist, selectedVideo] = await Promise.all([playlistPromise, selectedVideoPromise]);
      if (!playlist) throw new Error('Playlist not found');

      const queueIds = playlist.videoIds.length > 0 ? playlist.videoIds : [];
      const targetVideoId = startVideoId || queueIds[0];
      if (!targetVideoId) throw new Error('Playlist has no playable videos');

      const startVid = selectedVideo ?? (await invoke<Video | null>('get_video', { id: targetVideoId }));
      if (!startVid) throw new Error('Video not found');
      if (get().playerOpenRequestId !== nextOpenRequestId) return;

      const initialQueueIds = queueIds.includes(startVid.id) ? queueIds : [startVid.id, ...queueIds];
      const actualStartIndex = Math.max(initialQueueIds.indexOf(startVid.id), 0);
      lastSavedTime = startVid.progressSeconds || 0;

      set({
        currentPlaylistId: playlistId,
        currentVideoId: startVid.id,
        currentIndex: actualStartIndex,
        queueVideoIds: initialQueueIds,
        videos: new Map([[startVid.id, startVid]]),
        playlist,
        status: 'playing',
        isPlayerOpen: true,
        duration: startVid.durationSeconds || 0,
        currentTime: startVid.progressSeconds || 0,
        progressPercent: startVid.durationSeconds 
          ? (startVid.progressSeconds / startVid.durationSeconds) * 100 
          : 0,
        errorMessage: null,
        shouldAutoplayOnLoad: true,
      });
      rememberPlaybackTarget(playlistId, startVid.id);
      void hydrateFullQueue(playlistId, nextOpenRequestId);
    } catch (error) {
      console.error('Failed to open playlist:', error);
      set({ status: 'error', errorMessage: String(error) });
    }
  },

  playVideo: async (videoId: string, options = {}) => {
    setThumbnailGenerationPaused(true);
    const { videos, queueVideoIds, currentPlaylistId } = get();
    let video = videos.get(videoId);
    if (!video) {
      try {
        video = await invoke<Video | null>('get_video', { id: videoId }) ?? undefined;
      } catch (error) {
        console.error('Failed to load video before playback:', error);
      }
      if (!video) return;
    }

    const index = queueVideoIds.indexOf(videoId);
    const shouldAutoplayOnLoad = options.autoplay ?? true;
    const nextOpenRequestId = get().playerOpenRequestId + 1;
    lastSavedTime = video.progressSeconds || 0;
    const updatedVideos = new Map(videos);
    updatedVideos.set(video.id, video);
    
    set({
      currentVideoId: videoId,
      currentIndex: index >= 0 ? index : 0,
      queueVideoIds: index >= 0 ? queueVideoIds : [videoId, ...queueVideoIds],
      videos: updatedVideos,
      status: shouldAutoplayOnLoad ? 'playing' : 'loadingMetadata',
      isPlayerOpen: true,
      playerOpenRequestId: nextOpenRequestId,
      duration: video.durationSeconds || 0,
      currentTime: video.progressSeconds || 0,
      progressPercent: video.durationSeconds 
        ? (video.progressSeconds / video.durationSeconds) * 100 
        : 0,
      errorMessage: null,
      shouldAutoplayOnLoad,
    });

    // Update last played
    if (currentPlaylistId) {
      rememberPlaybackTarget(currentPlaylistId, videoId);
      invoke('save_progress', {
        videoId,
        progressSeconds: video.progressSeconds || 0,
        completed: video.completed,
      }).catch((e) => {
        console.error('Failed to update last played:', e);
      });
    }
  },

  next: () => {
    const { currentIndex, queueVideoIds, repeatMode, autoplay } = get();
    if (queueVideoIds.length === 0) return;
    
    if (repeatMode === 'one') {
      const currentId = get().currentVideoId;
      if (currentId) {
      get().playVideo(currentId, { autoplay: true });
      }
      return;
    }
    
    const nextIndex = currentIndex + 1;
    if (nextIndex < queueVideoIds.length) {
      get().playVideo(queueVideoIds[nextIndex], { autoplay: true });
    } else if (repeatMode === 'playlist' && queueVideoIds.length > 0) {
      get().playVideo(queueVideoIds[0], { autoplay: true });
    } else if (autoplay && nextIndex >= queueVideoIds.length) {
      // End of playlist
      set({ status: 'idle' });
    }
  },

  previous: () => {
    const { currentIndex, queueVideoIds } = get();
    if (queueVideoIds.length === 0) return;
    
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      get().playVideo(queueVideoIds[prevIndex], { autoplay: true });
    } else if (get().repeatMode === 'playlist') {
      get().playVideo(queueVideoIds[queueVideoIds.length - 1], { autoplay: true });
    }
  },

  togglePlay: () => {
    const { status } = get();
    if (status === 'playing') {
      set({ status: 'paused' });
    } else if (status === 'paused' || status === 'ready') {
      set({ status: 'playing' });
    }
  },

  seek: (seconds: number) => {
    set({ currentTime: seconds, progressPercent: get().duration ? (seconds / get().duration) * 100 : 0 });
  },

  skipForward: () => {
    const { currentTime, duration } = get();
    const newTime = Math.min(currentTime + 10, duration);
    get().seek(newTime);
  },

  skipBackward: () => {
    const { currentTime } = get();
    const newTime = Math.max(currentTime - 10, 0);
    get().seek(newTime);
  },

  toggleFullscreen: () => {
    set(state => ({ isFullscreen: !state.isFullscreen }));
  },

  toggleMute: () => {
    set(state => ({ isMuted: !state.isMuted }));
  },

  setVolume: (vol: number) => {
    set({ volume: Math.max(0, Math.min(1, vol)) });
  },

  setPlaybackRate: (rate: number) => {
    const allowedRates = [0.75, 1, 1.25, 1.5, 1.75, 2];
    const closestRate = allowedRates.reduce((closest, candidate) => (
      Math.abs(candidate - rate) < Math.abs(closest - rate) ? candidate : closest
    ), 1);
    set({ playbackRate: closestRate });
  },

  setRepeatMode: (mode: RepeatMode) => {
    set({ repeatMode: mode });
  },

  toggleAutoplay: () => {
    set(state => ({ autoplay: !state.autoplay }));
  },

  toggleFavorite: async () => {
    const { currentVideoId, videos } = get();
    if (!currentVideoId) return;
    
    const video = videos.get(currentVideoId);
    if (!video) return;
    
    const newFavorite = !video.favorite;
    try {
      await invoke('update_video_favorite', { id: currentVideoId, favorite: newFavorite });
      const updatedVideos = new Map(videos);
      updatedVideos.set(currentVideoId, { ...video, favorite: newFavorite });
      set({ videos: updatedVideos });
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  },

  toggleWatchLater: async () => {
    const { currentVideoId, videos } = get();
    if (!currentVideoId) return;
    
    const video = videos.get(currentVideoId);
    if (!video) return;
    
    const newWatchLater = !video.watchLater;
    try {
      await invoke('update_video_watch_later', { id: currentVideoId, watchLater: newWatchLater });
      const updatedVideos = new Map(videos);
      updatedVideos.set(currentVideoId, { ...video, watchLater: newWatchLater });
      set({ videos: updatedVideos });
    } catch (e) {
      console.error('Failed to toggle watch later:', e);
    }
  },

  markCompleted: async () => {
    const { currentVideoId, videos, duration } = get();
    if (!currentVideoId) return;
    
    try {
      await invoke('save_progress', { videoId: currentVideoId, progressSeconds: duration, completed: true });
      const updatedVideos = new Map(videos);
      const video = videos.get(currentVideoId);
      if (video) {
        updatedVideos.set(currentVideoId, { ...video, completed: true, progressSeconds: duration });
        set({ videos: updatedVideos });
      }
    } catch (e) {
      console.error('Failed to mark completed:', e);
    }
  },

  onTimeUpdate: (time: number) => {
    const { duration, currentVideoId } = get();
    const progressPercent = duration ? (time / duration) * 100 : 0;
    const now = performance.now();
    const previousTime = get().currentTime;
    if (now - lastStoreTimeUpdateAt >= 250 || Math.abs(time - previousTime) >= 1 || time === 0) {
      lastStoreTimeUpdateAt = now;
      set({ currentTime: time, progressPercent });
    }
    
    // Throttle progress saves
    if (currentVideoId && time - lastSavedTime > 5) {
      lastSavedTime = time;
      if (progressSaveTimer) clearTimeout(progressSaveTimer);
      progressSaveTimer = setTimeout(async () => {
        try {
          await invoke('save_progress', { 
            videoId: currentVideoId, 
            progressSeconds: Math.floor(time), 
            completed: false 
          });
        } catch (e) {
          console.error('Failed to save progress:', e);
        }
      }, 5000);
    }
  },

  onLoadedMetadata: (duration: number) => {
    set({ duration, status: get().shouldAutoplayOnLoad ? 'playing' : 'ready' });
  },

  onCanPlay: () => {
    const { status, shouldAutoplayOnLoad } = get();
    if (shouldAutoplayOnLoad) {
      set({ status: 'playing' });
      return;
    }
    if (status === 'loadingMetadata') {
      set({ status: 'ready' });
    }
  },

  onPlaying: () => {
    setThumbnailGenerationPaused(true);
    set({ status: 'playing', shouldAutoplayOnLoad: false });
  },

  onPause: () => {
    const { currentVideoId, currentTime, status, shouldAutoplayOnLoad } = get();
    setThumbnailGenerationPaused(false);
    if (status !== 'loadingMetadata' && status !== 'resolvingPath' && !shouldAutoplayOnLoad) {
      set({ status: 'paused' });
    }
    
    // Save progress on pause
    if (currentVideoId) {
      invoke('save_progress', { 
        videoId: currentVideoId, 
        progressSeconds: Math.floor(currentTime), 
        completed: false 
      }).catch(console.error);
    }
  },

  onEnded: () => {
    const { currentVideoId, currentTime, autoplay, repeatMode } = get();
    setThumbnailGenerationPaused(false);
    
    // Save final progress
    if (currentVideoId) {
      invoke('save_progress', { 
        videoId: currentVideoId, 
        progressSeconds: Math.floor(currentTime), 
        completed: true 
      }).catch(console.error);
    }
    
    if (repeatMode === 'one') {
      get().playVideo(currentVideoId!, { autoplay: true });
    } else if (autoplay) {
      get().next();
    } else {
      set({ status: 'idle' });
    }
  },

  onError: (error: string) => {
    set({ status: 'error', errorMessage: error, shouldAutoplayOnLoad: false });
  },

  refreshVideo: async (videoId: string) => {
    const { videos } = get();
    if (!videos.has(videoId)) return;

    try {
      const video = await invoke<Video | null>('get_video', { id: videoId });
      if (!video) return;

      const updatedVideos = new Map(get().videos);
      updatedVideos.set(video.id, video);
      set({ videos: updatedVideos });
    } catch (error) {
      console.error('Failed to refresh player video:', error);
    }
  },

  refreshCurrentPlaylistData: async () => {
    const { currentPlaylistId, currentVideoId } = get();
    if (!currentPlaylistId) return;

    try {
      const [playlist, videos] = await Promise.all([
        invoke<Playlist>('get_playlist', { id: currentPlaylistId }),
        invoke<Video[]>('get_videos_by_playlist', { playlistId: currentPlaylistId }),
      ]);
      const videoMap = new Map<string, Video>();
      videos.forEach((video) => videoMap.set(video.id, video));
      const queueIds = videos.map((video) => video.id);
      const currentIndex = currentVideoId ? queueIds.indexOf(currentVideoId) : -1;

      set({
        playlist,
        videos: videoMap,
        queueVideoIds: queueIds,
        currentIndex,
      });
    } catch (error) {
      console.error('Failed to refresh player playlist:', error);
    }
  },

  leavePlayerView: () => {
    const { currentVideoId, currentTime, status } = get();
    setThumbnailGenerationPaused(false);

    if (currentVideoId) {
      invoke('save_progress', {
        videoId: currentVideoId,
        progressSeconds: Math.floor(currentTime),
        completed: false,
      }).catch(console.error);
    }

    const shouldPauseDetachedMedia =
      status === 'playing' || status === 'loadingMetadata' || status === 'resolvingPath';

    set({
      status: currentVideoId && shouldPauseDetachedMedia ? 'paused' : status,
      shouldAutoplayOnLoad: false,
    });
  },

  closePlayer: () => {
    const { currentVideoId, currentTime } = get();
    setThumbnailGenerationPaused(false);
    
    // Save progress before closing
    if (currentVideoId) {
      invoke('save_progress', { 
        videoId: currentVideoId, 
        progressSeconds: Math.floor(currentTime), 
        completed: false 
      }).catch(console.error);
    }
    
    set({
      isPlayerOpen: false,
      status: 'idle',
      currentPlaylistId: null,
      currentVideoId: null,
      currentIndex: -1,
      queueVideoIds: [],
      videos: new Map(),
      playlist: null,
      duration: 0,
      currentTime: 0,
      progressPercent: 0,
      errorMessage: null,
      isFullscreen: false,
      shouldAutoplayOnLoad: false,
    });
  },
}));
