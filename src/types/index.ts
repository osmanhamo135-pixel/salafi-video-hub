export type AppLanguage = 'en' | 'ar';
export type AppTheme = 'noor' | 'emerald' | 'pearl' | 'mushaf';

export interface Video {
  id: string;
  title: string;
  filePath: string;
  folderPath: string;
  fileName: string;
  extension: string;
  durationSeconds: number;
  thumbnailPath: string | null;
  thumbnailStatus: 'missing' | 'queued' | 'generating' | 'ready' | 'failed' | 'fallback';
  category: string | null;
  speaker: string | null;
  description: string | null;
  progressSeconds: number;
  completed: boolean;
  favorite: boolean;
  watchLater: boolean;
  fileSize: number;
  modifiedAt: number;
  createdAt: number;
  updatedAt: number;
  lastPlayedAt: number | null;
  playableStatus: 'unknown' | 'checking' | 'playable' | 'unsupported' | 'missing' | 'error';
  lastPlaybackError: string | null;
  codecInfo: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  folderPath: string;
  videoIds: string[];
  videoCount: number;
  totalDurationSeconds: number;
  progressSeconds: number;
  thumbnailPath: string | null;
  category: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Reminder {
  id: string;
  title: string;
  enabled: boolean;
  targetType: 'video' | 'playlist';
  targetId: string;
  time: string;
  repeat: 'none' | 'daily' | 'weekly' | 'custom';
  customDays?: number[];
  soundPath: string | null;
  volume: number;
  lastTriggeredAt: number | null;
  lastFiredKey: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id: string;
  language: AppLanguage;
  theme: AppTheme;
  importedFolders: string[];
  thumbnailCachePath: string | null;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  ffmpegStatus: 'bundled' | 'system' | 'missing';
  automaticThumbnailsMode: 'automatic' | 'visible-only' | 'idle-only' | 'disabled';
  performanceMode: boolean;
  reminderSoundPath: string | null;
  reminderVolume: number;
  runInTray: boolean;
  lastOpenedPlaylistId: string | null;
  lastPlayedVideoId: string | null;
}

export interface PlaylistStats {
  totalPlaylists: number;
  totalVideos: number;
  totalDuration: number;
  completedVideos: number;
  totalStorageBytes: number;
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  playlist_id: string | null;
  errors: string[];
}

export interface ContinueWatchingItem {
  video: Video;
  playlist: Playlist | null;
}

export type PlayerStatus = 
  | 'idle' 
  | 'resolvingPath' 
  | 'loadingMetadata' 
  | 'ready' 
  | 'playing' 
  | 'paused' 
  | 'error' 
  | 'missing';

export type RepeatMode = 'none' | 'one' | 'playlist';
