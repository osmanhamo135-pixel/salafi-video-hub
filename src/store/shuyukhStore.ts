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
 * - The channel's identity (avatar, handle, subscriber count) DOES persist
 *   on the profile: the card must look whole on app start, before the
 *   six-hour stale window has any reason to refetch.
 * - A routine refresh fetches only the newest QUICK_LIMIT uploads — cheap
 *   enough to run on a timer. The whole channel (ten thousand lessons on
 *   the larger channels) is fetched only on an explicit click, and once it
 *   is in memory a later quick refresh MERGES into it rather than
 *   truncating it back down.
 */

export interface ShaykhProfile {
  id: string;
  name: string;
  channelUrl: string;
  /** Channel display name as YouTube reports it, once fetched. */
  channelName: string | null;
  /** The channel's profile picture (yt3.* URL), once fetched. */
  channelAvatar: string | null;
  /** The channel's @handle, once fetched. */
  channelHandle: string | null;
  subscriberCount: number | null;
  /** Newest video id at the last moment the reader opened this profile. */
  lastSeenVideoId: string | null;
  /** New uploads since lastSeen, as of the last refresh. */
  newCount: number;
  lastCheckedAt: number | null;
}

export interface ChannelCatalog {
  channel: string;
  channelUrl: string;
  channelAvatar: string | null;
  channelHandle: string | null;
  subscriberCount: number | null;
  videos: YoutubeSearchItem[];
}

const STORAGE_KEY = 'salafi-hub.shuyukh.v1';
/** Auto-refresh cadence while the app is open. */
export const STALE_MS = 6 * 60 * 60 * 1000;
/** Videos per routine refresh. 0 sent to the backend means "everything". */
export const QUICK_LIMIT = 90;

const readProfiles = (): ShaykhProfile[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Profiles saved before the channel-identity fields existed lack them.
    return parsed.map((p) => ({
      channelAvatar: null,
      channelHandle: null,
      subscriberCount: null,
      ...p,
    }));
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
  /** Ids whose in-memory catalog holds the channel's entire uploads list. */
  fullyLoaded: Record<string, boolean>;
  loading: Record<string, boolean>;
  /** The heavy whole-channel fetch, distinct so the UI can say so. */
  loadingFull: Record<string, boolean>;
  errors: Record<string, string | null>;
  addProfile: (name: string, channelUrl: string) => Promise<ShaykhProfile | null>;
  removeProfile: (id: string) => void;
  refreshProfile: (id: string) => Promise<void>;
  /** Fetches every upload on the channel, not just the newest QUICK_LIMIT. */
  loadFullCatalog: (id: string) => Promise<void>;
  /** Refreshes every profile whose last check is older than STALE_MS. */
  refreshStale: () => Promise<void>;
  /** The reader opened the profile: everything current is now "seen". */
  markSeen: (id: string) => void;
  newTotal: () => number;
}

export const useShuyukhStore = create<ShuyukhState>((set, get) => {
  /** Stores a fetched catalog and rolls the profile's channel identity and
      new-count forward. Shared by the quick refresh and the full load. */
  const applyCatalog = (id: string, catalog: ChannelCatalog, fullyLoaded: boolean) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return;
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
            channelAvatar: catalog.channelAvatar ?? p.channelAvatar,
            channelHandle: catalog.channelHandle ?? p.channelHandle,
            subscriberCount: catalog.subscriberCount ?? p.subscriberCount,
            newCount,
            lastCheckedAt: Date.now(),
          }
        : p,
    );
    set((s) => ({
      profiles,
      catalogs: { ...s.catalogs, [id]: catalog },
      fullyLoaded: { ...s.fullyLoaded, [id]: fullyLoaded },
    }));
    writeProfiles(profiles);
  };

  return {
    profiles: readProfiles(),
    catalogs: {},
    fullyLoaded: {},
    loading: {},
    loadingFull: {},
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
        channelAvatar: null,
        channelHandle: null,
        subscriberCount: null,
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
      const { [id]: _f, ...fullyLoaded } = get().fullyLoaded;
      const { [id]: _e, ...errors } = get().errors;
      set({ profiles, catalogs, fullyLoaded, errors });
      writeProfiles(profiles);
    },

    refreshProfile: async (id) => {
      const profile = get().profiles.find((p) => p.id === id);
      if (!profile || get().loading[id] || get().loadingFull[id]) return;
      set((s) => ({
        loading: { ...s.loading, [id]: true },
        errors: { ...s.errors, [id]: null },
      }));
      try {
        const catalog = await invoke<ChannelCatalog>('youtube_channel_catalog', {
          channelUrl: profile.channelUrl,
          limit: QUICK_LIMIT,
        });
        const existing = get().catalogs[id];
        const freshIds = new Set(catalog.videos.map((v) => v.id));
        /* Merging the quick slice into a fully-loaded catalog is only sound
           if the slice reaches back to the old list's head — otherwise more
           than QUICK_LIMIT videos landed since the full load and the union
           would hide a gap behind a confident "fully loaded" count. In that
           case keep the fresh slice and drop the fully-loaded claim, so the
           banner comes back and the reader can reload the whole channel. */
        const wasFull =
          Boolean(get().fullyLoaded[id]) &&
          existing !== undefined &&
          existing.videos.length > 0 &&
          freshIds.has(existing.videos[0].id);
        if (wasFull) {
          /* The quick fetch is the newest slice of the same newest-first
             list the full catalog already holds, so the union — fresh slice
             first, then everything older — preserves both the order and the
             reader's fully-loaded tail. */
          catalog.videos = [
            ...catalog.videos,
            ...existing.videos.filter((v) => !freshIds.has(v.id)),
          ];
        }
        applyCatalog(id, catalog, wasFull);
      } catch (error) {
        set((s) => ({
          errors: {
            ...s.errors,
            [id]: error instanceof Error ? error.message : String(error),
          },
        }));
      } finally {
        set((s) => ({ loading: { ...s.loading, [id]: false } }));
      }
    },

    loadFullCatalog: async (id) => {
      const profile = get().profiles.find((p) => p.id === id);
      if (!profile || get().loading[id] || get().loadingFull[id]) return;
      set((s) => ({
        loadingFull: { ...s.loadingFull, [id]: true },
        errors: { ...s.errors, [id]: null },
      }));
      try {
        const catalog = await invoke<ChannelCatalog>('youtube_channel_catalog', {
          channelUrl: profile.channelUrl,
          limit: 0,
        });
        applyCatalog(id, catalog, true);
      } catch (error) {
        set((s) => ({
          errors: {
            ...s.errors,
            [id]: error instanceof Error ? error.message : String(error),
          },
        }));
      } finally {
        set((s) => ({ loadingFull: { ...s.loadingFull, [id]: false } }));
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
  };
});
