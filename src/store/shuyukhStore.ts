import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { YoutubeSearchItem } from '@/store/watchStore';

/**
 * The Shuyukh profiles — the owner's ask, verbatim: named profiles for
 * mashayikh he trusts, each carrying that shaykh's whole channel, kept
 * current, with a live signal whenever a new lesson lands.
 *
 * Design decisions that matter:
 *
 * - Profiles persist in localStorage, not the database. They are a personal
 *   reading list — a name and a link — not library data; losing them costs
 *   two clicks, and keeping them out of SQLite means no migration risk for
 *   what is essentially a bookmark file.
 * - "New" is computed against the last video the reader has SEEN, not the
 *   last fetch: `lastSeenVideoId` pins a position in the channel's
 *   newest-first uploads list, and everything before that index is new.
 *   Opening the profile marks it seen. This is how a muhaddith's student
 *   actually uses it: "what has the shaykh put out since I last looked?"
 * - Catalogs cache in memory only. They are one yt-dlp call to refetch and
 *   go stale by nature; persisting them would just serve last week's list
 *   with confidence.
 */

export interface ShaykhProfile {
  id: string;
  name: string;
  channelUrl: string;
  /** Channel display name as YouTube reports it, once fetched. */
  channelName: string | null;
  /** Newest video id at the last moment the reader opened this profile. */
  lastSeenVideoId: string | null;
  /** New uploads since lastSeen, as of the last refresh. */
  newCount: number;
  lastCheckedAt: number | null;
}

export interface ChannelCatalog {
  channel: string;
  channelUrl: string;
  videos: YoutubeSearchItem[];
}

const STORAGE_KEY = 'salafi-hub.shuyukh.v1';
/** Auto-refresh cadence while the app is open. */
export const STALE_MS = 6 * 60 * 60 * 1000;

const readProfiles = (): ShaykhProfile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeProfiles = (profiles: ShaykhProfile[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    /* persistence is best-effort */
  }
};

interface ShuyukhState {
  profiles: ShaykhProfile[];
  /** In-memory catalogs by profile id. */
  catalogs: Record<string, ChannelCatalog>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  addProfile: (name: string, channelUrl: string) => Promise<ShaykhProfile | null>;
  removeProfile: (id: string) => void;
  refreshProfile: (id: string) => Promise<void>;
  /** Refreshes every profile whose last check is older than STALE_MS. */
  refreshStale: () => Promise<void>;
  /** The reader opened the profile: everything current is now "seen". */
  markSeen: (id: string) => void;
  newTotal: () => number;
}

export const useShuyukhStore = create<ShuyukhState>((set, get) => ({
  profiles: readProfiles(),
  catalogs: {},
  loading: {},
  errors: {},

  addProfile: async (name, channelUrl) => {
    const trimmedName = name.trim();
    const trimmedUrl = channelUrl.trim();
    if (!trimmedName || !trimmedUrl) return null;

    const id = `sh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const profile: ShaykhProfile = {
      id,
      name: trimmedName,
      channelUrl: trimmedUrl,
      channelName: null,
      lastSeenVideoId: null,
      newCount: 0,
      lastCheckedAt: null,
    };
    const profiles = [...get().profiles, profile];
    set({ profiles });
    writeProfiles(profiles);
    // Fetch immediately so the card is alive the moment it is created; the
    // first fetch also marks everything seen — a brand-new profile has no
    // "since last time".
    await get().refreshProfile(id);
    const fetched = get().catalogs[id];
    if (fetched && fetched.videos.length > 0) {
      get().markSeen(id);
    }
    return get().profiles.find((p) => p.id === id) ?? null;
  },

  removeProfile: (id) => {
    const profiles = get().profiles.filter((p) => p.id !== id);
    const { [id]: _c, ...catalogs } = get().catalogs;
    const { [id]: _e, ...errors } = get().errors;
    set({ profiles, catalogs, errors });
    writeProfiles(profiles);
  },

  refreshProfile: async (id) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile || get().loading[id]) return;
    set((s) => ({
      loading: { ...s.loading, [id]: true },
      errors: { ...s.errors, [id]: null },
    }));
    try {
      const catalog = await invoke<ChannelCatalog>('youtube_channel_catalog', {
        channelUrl: profile.channelUrl,
      });
      const seenIndex = profile.lastSeenVideoId
        ? catalog.videos.findIndex((v) => v.id === profile.lastSeenVideoId)
        : -1;
      /* The uploads list is newest-first, so everything before the seen
         video's index is new. A first fetch (no seen id) or a seen id that
         has scrolled out of the fetch window counts nothing rather than
         everything — a wall of "90 new" on day one is noise, not signal. */
      const newCount = seenIndex > 0 ? seenIndex : 0;
      const profiles = get().profiles.map((p) =>
        p.id === id
          ? {
              ...p,
              channelName: catalog.channel || p.channelName,
              newCount,
              lastCheckedAt: Date.now(),
            }
          : p,
      );
      set((s) => ({
        profiles,
        catalogs: { ...s.catalogs, [id]: catalog },
        loading: { ...s.loading, [id]: false },
      }));
      writeProfiles(profiles);
    } catch (error) {
      set((s) => ({
        loading: { ...s.loading, [id]: false },
        errors: {
          ...s.errors,
          [id]: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  },

  refreshStale: async () => {
    const now = Date.now();
    const stale = get().profiles.filter(
      (p) => !p.lastCheckedAt || now - p.lastCheckedAt > STALE_MS,
    );
    // Sequential, deliberately: each refresh is a yt-dlp process, and a
    // reader with ten profiles should not fork ten helpers at once.
    for (const profile of stale) {
      await get().refreshProfile(profile.id);
    }
  },

  markSeen: (id) => {
    const catalog = get().catalogs[id];
    const newest = catalog?.videos[0]?.id ?? null;
    if (!newest) return;
    const profiles = get().profiles.map((p) =>
      p.id === id ? { ...p, lastSeenVideoId: newest, newCount: 0 } : p,
    );
    set({ profiles });
    writeProfiles(profiles);
  },

  newTotal: () => get().profiles.reduce((sum, p) => sum + p.newCount, 0),
}));
