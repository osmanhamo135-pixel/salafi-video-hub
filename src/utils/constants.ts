import type { TranslationKey } from '@/i18n';

export const APP_NAME = 'Salafi Hub';
export const APP_STAGE = 'BETA';

/**
 * The app-wide Salafi content taxonomy (see docs/CONTENT_POLICY.md).
 * Fiqh is supported across the four Sunni madhhabs — Hanbali (default),
 * Hanafi, Maliki, and Shafi'i — plus comparative fiqh. The `id` is the stable
 * value stored in the database; labels are translated in the UI. Data-driven
 * so categories can grow without touching feature code.
 */
export interface ContentCategory {
  id: string;
  labelKey: TranslationKey;
}

export const CONTENT_CATEGORIES: ContentCategory[] = [
  { id: 'Quran', labelKey: 'catQuran' },
  { id: 'Tafsir', labelKey: 'catTafsir' },
  { id: 'Hadith', labelKey: 'catHadith' },
  { id: 'Aqeedah', labelKey: 'catAqeedah' },
  { id: 'Tawheed', labelKey: 'catTawheed' },
  { id: 'Manhaj', labelKey: 'catManhaj' },
  { id: 'Seerah', labelKey: 'catSeerah' },
  { id: 'Fiqh', labelKey: 'catFiqh' },
  { id: 'Hanbali Fiqh', labelKey: 'catHanbaliFiqh' },
  { id: 'Hanafi Fiqh', labelKey: 'catHanafiFiqh' },
  { id: 'Maliki Fiqh', labelKey: 'catMalikiFiqh' },
  { id: "Shafi'i Fiqh", labelKey: 'catShafiiFiqh' },
  { id: 'Comparative Fiqh', labelKey: 'catComparativeFiqh' },
  { id: 'Arabic Lessons', labelKey: 'catArabicLessons' },
  { id: 'Refutations', labelKey: 'catRefutations' },
  { id: 'Short Clips', labelKey: 'catShortClips' },
  { id: 'Long Lessons', labelKey: 'catLongLessons' },
];

/** The four recognized Sunni madhhabs; Hanbali is the app default. */
export const MADHHABS = ['Hanbali', 'Hanafi', 'Maliki', "Shafi'i"] as const;
export const DEFAULT_MADHHAB = 'Hanbali';

export const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v'];

export const SUPPORTED_VIDEO_CODECS = ['h264', 'hevc', 'vp9', 'av1', 'mpeg4'];

export const THUMBNAIL_TIMESTAMPS = [0.2, 1.0, 3.0];

export const PROGRESS_SAVE_INTERVAL = 5000; // 5 seconds

export const BACKGROUND_JOB_DELAY = 1000; // 1 second between thumbnail jobs

export const MAX_THUMBNAIL_JOBS = 1;

export const MAX_FFPROBE_JOBS = 1;

export const VIRTUAL_LIST_ITEM_HEIGHT = 64; // Queue row height

export const VIRTUAL_LIST_OVERSCAN = 5;

export const SIDEBAR_WIDTH = 240;

export const QUEUE_PANEL_WIDTH = 400;
