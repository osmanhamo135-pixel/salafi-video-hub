/**
 * Seed data for the browser harness.
 *
 * Real data where the app has real data to give: the surah list and the ayah
 * text come out of `src-tauri/resources/quran.json`, the same file the Rust
 * command reads. Screenshots taken against lorem ipsum lie about line lengths,
 * about how Arabic sits on the baseline, and about how a card behaves when the
 * title is genuinely long — which is most of what a visual audit is looking at.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const quran = JSON.parse(readFileSync(join(repo, 'src-tauri/resources/quran.json'), 'utf8'));

const surahMeta = quran.map((s) => ({
  id: s.id,
  name: s.name,
  transliteration: s.transliteration,
  translation: s.translation,
  revelationType: s.type,
  totalVerses: s.total_verses,
}));

const DAY = 86_400_000;
const now = 1_753_500_000_000; // fixed clock — screenshots must be reproducible

/** Titles drawn from the app's own stated subject matter, with realistic length spread. */
const SOURCES = [
  ['Sharh Kitab at-Tawheed — Lesson 12', 'Shaykh Muhammad ibn Salih al-Uthaymeen', 'Tawheed', 4_412],
  ['Al-Aqeedah al-Wasitiyyah — Introduction', 'Shaykh Salih al-Fawzan', 'Aqeedah', 3_180],
  ['Tafsir Surah al-Kahf, ayat 1–10', 'Shaykh Abdul Razzaq al-Badr', 'Tafsir', 2_945],
  ['Explanation of the Forty Hadith — Hadith 1', 'Shaykh Salih al-Fawzan', 'Hadith', 2_260],
  ['Usool ath-Thalatha — The Three Fundamental Principles', 'Shaykh Ubayd al-Jabiri', 'Manhaj', 5_030],
  ['Ar-Rahbiyyah in the Science of Inheritance', 'Shaykh Muhammad ibn Salih al-Uthaymeen', 'Fiqh', 3_615],
  ['Seerah of the Prophet ﷺ — The Makkan Period', 'Shaykh Abdur-Razzaq al-Badr', 'Seerah', 4_820],
  ['Al-Ajurrumiyyah — Arabic Grammar, Session 3', 'Ustadh Abu Hakeem', 'Arabic Lessons', 2_710],
  ['Refutation of the Doubts Around at-Tawassul', 'Shaykh Rabee al-Madkhali', 'Refutations', 1_890],
  ['The Conditions of La ilaha illa Allah', 'Shaykh Salih Aal ash-Shaykh', 'Tawheed', 2_140],
  ['Kitab as-Salah — The Prerequisites of Prayer', 'Shaykh Muhammad ibn Salih al-Uthaymeen', 'Fiqh', 3_960],
  ['A Short Reminder on Sincerity', 'Shaykh Abdul Razzaq al-Badr', 'Short Clips', 412],
];

/** Deterministic pseudo-random so every run produces the identical screenshot. */
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

const videos = Array.from({ length: 163 }, (_, i) => {
  const [title, speaker, category, base] = SOURCES[i % SOURCES.length];
  const duration = Math.round(base * (0.7 + rand() * 0.6));
  const progress = i % 5 === 0 ? Math.round(duration * (0.15 + rand() * 0.6)) : 0;
  const part = i >= SOURCES.length ? ` (Part ${Math.floor(i / SOURCES.length) + 1})` : '';
  return {
    id: `vid-${i + 1}`,
    title: `${title}${part}`,
    filePath: `C:\\Users\\osman\\Desktop\\Salafi\\Youtube\\Youtube\\${category}\\${i + 1} - ${title}.mp4`,
    folderPath: `C:\\Users\\osman\\Desktop\\Salafi\\Youtube\\Youtube\\${category}`,
    fileName: `${i + 1} - ${title}.mp4`,
    extension: 'mp4',
    durationSeconds: duration,
    thumbnailPath: null,
    thumbnailStatus: 'fallback',
    category,
    speaker,
    description: null,
    progressSeconds: progress,
    completed: i % 11 === 0,
    favorite: i % 7 === 0,
    watchLater: i % 9 === 0,
    fileSize: Math.round(duration * 1_180_000),
    modifiedAt: now - i * DAY,
    createdAt: now - i * DAY,
    updatedAt: now - i * DAY,
    lastPlayedAt: progress ? now - i * 3_600_000 : null,
    playableStatus: 'playable',
    lastPlaybackError: null,
    codecInfo: 'h264 / aac',
  };
});

const PLAYLIST_NAMES = [
  ['Kitab at-Tawheed — Full Series', 'Tawheed'],
  ['Al-Aqeedah al-Wasitiyyah', 'Aqeedah'],
  ['Tafsir Juz Amma', 'Tafsir'],
  ['The Forty Hadith of an-Nawawi', 'Hadith'],
  ['Usool ath-Thalatha', 'Manhaj'],
  ['Fiqh of Purification', 'Fiqh'],
  ['Seerah — The Makkan Period', 'Seerah'],
  ['Arabic Grammar: al-Ajurrumiyyah', 'Arabic Lessons'],
  ['Ramadan Reminders 1446', 'Short Clips'],
  ['Refutations of Contemporary Doubts', 'Refutations'],
];

const playlists = PLAYLIST_NAMES.map(([name, category], i) => {
  const ids = videos.slice(i * 9, i * 9 + 9 + (i % 4)).map((v) => v.id);
  const total = ids.reduce((a, id) => a + videos.find((v) => v.id === id).durationSeconds, 0);
  return {
    id: `pl-${i + 1}`,
    name,
    folderPath: `C:\\Users\\osman\\Desktop\\Salafi\\Youtube\\Youtube\\${category}`,
    videoIds: ids,
    videoCount: ids.length,
    totalDurationSeconds: total,
    progressSeconds: Math.round(total * (i % 3 === 0 ? 0.42 : 0.08)),
    thumbnailPath: null,
    category,
    createdAt: now - i * 3 * DAY,
    updatedAt: now - i * DAY,
  };
});

const reminders = [
  ['Kitab at-Tawheed — daily lesson', '06:30', 'daily', 'pl-1'],
  ['Tafsir before Fajr', '04:45', 'daily', 'pl-3'],
  ['Forty Hadith — Mon & Thu', '20:00', 'weekly', 'pl-4'],
  ['Arabic grammar drill', '17:15', 'daily', 'pl-8'],
  ['Weekend seerah session', '10:00', 'weekly', 'pl-7'],
  ['Short reminder before sleep', '22:30', 'daily', 'vid-12'],
].map(([title, time, repeat, targetId], i) => ({
  id: `rem-${i + 1}`,
  title,
  enabled: i !== 4,
  targetType: targetId.startsWith('pl-') ? 'playlist' : 'video',
  targetId,
  time,
  repeat,
  customDays: repeat === 'weekly' ? [1, 4] : undefined,
  soundPath: null,
  volume: 0.8,
  lastTriggeredAt: i < 3 ? now - DAY : null,
  lastFiredKey: null,
  createdAt: now - (i + 1) * DAY,
  updatedAt: now - (i + 1) * DAY,
}));

const STATION_NAMES = [
  'Idhaa3at al-Quran al-Kareem — Cairo', 'Quran Radio — Makkah', 'Quran Radio — Madinah',
  'Sahab Salafi Radio', 'Radio Sunnah', 'Mishary Rashid al-Afasy', 'Abdul Basit Abdus-Samad',
  'Mahmoud Khalil al-Husary', 'Muhammad Siddiq al-Minshawi', 'Saad al-Ghamdi',
  'Maher al-Muaiqly', 'Abdur-Rahman as-Sudais', 'Saud ash-Shuraim', 'Yasser ad-Dossari',
  'Ahmad al-Ajmi', 'Nasser al-Qatami', 'Idris Abkar', 'Bandar Baleela',
];
const stations = Array.from({ length: 175 }, (_, i) => ({
  id: `st-${i + 1}`,
  name: i < STATION_NAMES.length ? STATION_NAMES[i] : `${STATION_NAMES[i % STATION_NAMES.length]} ${Math.floor(i / STATION_NAMES.length) + 1}`,
  url: `https://stream.example.invalid/${i + 1}`,
}));

const settings = {
  id: 'settings',
  language: 'en',
  theme: 'noor',
  importedFolders: [
    'C:\\Users\\osman\\Desktop\\Salafi\\Youtube\\Youtube',
    'D:\\Duroos\\Aqeedah',
  ],
  thumbnailCachePath: 'C:\\Users\\osman\\AppData\\Roaming\\salafi-video-hub\\thumbnails',
  ffmpegPath: null,
  ffprobePath: null,
  ffmpegStatus: 'bundled',
  automaticThumbnailsMode: 'automatic',
  performanceMode: false,
  reminderSoundPath: null,
  reminderVolume: 0.8,
  runInTray: true,
  lastOpenedPlaylistId: 'pl-1',
  lastPlayedVideoId: 'vid-1',
};

const stats = {
  totalPlaylists: playlists.length,
  totalVideos: videos.length,
  totalDuration: videos.reduce((a, v) => a + v.durationSeconds, 0),
  completedVideos: videos.filter((v) => v.completed).length,
  totalStorageBytes: videos.reduce((a, v) => a + v.fileSize, 0),
};

const reciters = [
  { id: 'husary', name: 'Mahmoud Khalil al-Husary', moshafName: "Hafs A'n Assem - Murattal", server: 'https://example.invalid/husary/', availableSurahs: surahMeta.map((s) => s.id) },
  { id: 'minshawi', name: 'Muhammad Siddiq al-Minshawi', moshafName: "Hafs A'n Assem - Murattal", server: 'https://example.invalid/minshawi/', availableSurahs: surahMeta.map((s) => s.id) },
  { id: 'afasy', name: 'Mishary Rashid al-Afasy', moshafName: "Hafs A'n Assem - Murattal", server: 'https://example.invalid/afasy/', availableSurahs: surahMeta.map((s) => s.id) },
];

/** Full surah payloads are large; ship only the ones a screenshot can reach. */
const surahPayloads = Object.fromEntries(
  [1, 2, 18, 36, 55, 67, 112].map((id) => {
    const s = quran.find((x) => x.id === id);
    return [id, { ...s, verses: s.verses.slice(0, 40) }];
  }),
);

export const fixtures = {
  videos,
  playlists,
  reminders,
  settings,
  stats,
  stations,
  surahMeta,
  surahPayloads,
  reciters,
  now,
};
