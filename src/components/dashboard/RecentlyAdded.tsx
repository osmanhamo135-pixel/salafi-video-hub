import React, { useEffect, useMemo, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play } from 'lucide-react';
import { Playlist, Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';
import { formatDuration } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

/* .thumbnail-fallback bakes in an .icon-medallion (primary-blue border + fill)
   and a teal underline, which puts a second accent in every un-thumbnailed row.
   Neutralise both from the call site; the primitive itself is not ours to edit. */
const QUIET_FALLBACK = 'thumbnail-fallback thumbnail-fallback-quiet';

export const RecentlyAdded: React.FC = () => {
  const { t } = useI18n();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const playlists = useAppStore((s) => s.playlists);
  const loadPlaylists = useAppStore((s) => s.loadPlaylists);
  const thumbnailRefreshVersion = useAppStore((s) => s.thumbnailRefreshVersion);
  const importRefreshVersion = useAppStore((s) => s.importRefreshVersion);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);

  useEffect(() => {
    if (playlists.length === 0) {
      loadPlaylists();
    }
  }, [loadPlaylists, playlists.length]);

  useEffect(() => {
    let cancelled = false;
    const fetchVideos = async () => {
      try {
        if (!loadedRef.current) setLoading(true);
        const data = await invoke<Video[]>('get_recently_added', { limit: 20 });
        if (!cancelled) setVideos(data || []);
      } catch (error) {
        console.error('Failed to load recently added:', error);
        if (!cancelled) setVideos([]);
      } finally {
        if (!cancelled) {
          loadedRef.current = true;
          setLoading(false);
        }
      }
    };
    fetchVideos();
    return () => {
      cancelled = true;
    };
  }, [importRefreshVersion, thumbnailRefreshVersion]);

  const videoItems = useMemo(() => {
    return videos.map((video) => ({
      video,
      playlist: playlists.find((item) => item.videoIds.includes(video.id)) ?? null,
    }));
  }, [playlists, videos]);

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: { video: Video; playlist: Playlist | null }[] }>();

    for (const item of videoItems) {
      const key = item.playlist?.id ?? item.video.folderPath ?? 'standalone';
      const title = item.playlist?.name ?? item.video.folderPath.split(/[\\/]/).filter(Boolean).pop() ?? t('standaloneVideos');
      const group = map.get(key);

      if (group) {
        group.items.push(item);
      } else {
        map.set(key, { title, items: [item] });
      }
    }

    return Array.from(map.entries()).map(([key, group]) => ({ key, ...group }));
  }, [videoItems]);

  const handlePlay = (video: Video, playlist: Playlist | null) => {
    if (playlist) {
      openPlaylist(playlist.id, video.id);
    }
  };

  return (
    <section className="mt-8">
      <div className="rule-head mb-1">
        <h2 className="text-sm font-semibold text-text-primary">{t('recentlyAdded')}</h2>
        <span className="text-xs tabular-nums text-muted-text">
          <bdi>{videos.length}</bdi>
        </span>
      </div>

      {loading ? (
        <div className="rule-list">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rule-row">
              <div className="h-[54px] w-24 shrink-0 rounded bg-panel-hover motion-safe:animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-2/5 rounded bg-panel-hover motion-safe:animate-pulse" />
                <div className="h-3 w-1/4 rounded bg-panel-hover motion-safe:animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-text">{t('noVideosYet')}</p>
          <p className="mt-1 text-xs text-text-faint">{t('importFolderHint')}</p>
        </div>
      ) : (
        <div className="rule-list">
          {groups.map((group) => (
            <RecentRow
              key={group.key}
              title={group.title}
              count={group.items.length}
              item={group.items[0]}
              onPlay={handlePlay}
              uncategorizedLabel={t('uncategorized')}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const RecentRow: React.FC<{
  title: string;
  count: number;
  item: { video: Video; playlist: Playlist | null };
  onPlay: (video: Video, playlist: Playlist | null) => void;
  uncategorizedLabel: string;
}> = ({ title, count, item, onPlay, uncategorizedLabel }) => {
  const { language } = useI18n();
  const { video, playlist } = item;
  const canPlay = !!playlist;

  return (
    <button
      type="button"
      onClick={() => canPlay && onPlay(video, playlist)}
      disabled={!canPlay}
      className="rule-row group w-full text-start disabled:cursor-default"
    >
      <div className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded bg-background">
        <LocalThumbnail
          path={video.thumbnailPath}
          label={video.title}
          className="h-full w-full object-cover"
          iconClassName="h-4 w-4 text-muted-text"
          fallbackClassName={QUIET_FALLBACK}
        />
        {canPlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 fill-current text-text-primary" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm text-text-primary" title={video.title}>
          <bdi>{video.title}</bdi>
        </p>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-text">
          <span className="truncate" title={title}><bdi>{title}</bdi></span>
          <span className="truncate">
            <bdi>{video.speaker || video.category || uncategorizedLabel}</bdi>
          </span>
          {count > 1 && <bdi className="shrink-0 tabular-nums">+{count - 1}</bdi>}
        </div>
      </div>

      <span className="shrink-0 text-xs tabular-nums text-muted-text">
        <bdi>{formatDuration(video.durationSeconds, language)}</bdi>
      </span>
    </button>
  );
};
