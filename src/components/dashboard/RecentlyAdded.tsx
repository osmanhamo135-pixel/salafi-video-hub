import React, { useEffect, useMemo, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Film, FolderOpen, Play } from 'lucide-react';
import { Playlist, Video } from '@/types';
import { useAppStore } from '@/store/appStore';
import { usePlayerStore } from '@/store/playerStore';
import { formatDuration } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

export const RecentlyAdded: React.FC = () => {
  const { t } = useI18n();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-text-primary mt-8 mb-4">{t('recentlyAdded')}</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="premium-card h-[180px] min-w-[260px] animate-pulse rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (videos.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-text-primary mt-8 mb-4">{t('recentlyAdded')}</h2>
        <div className="premium-card ornate-corner relative flex flex-col items-center justify-center rounded-lg p-8 text-muted-text">
          <div className="icon-medallion mb-3 h-14 w-14">
            <Film size={28} className="text-primary-blue/70" />
          </div>
          <p className="text-sm">{t('noVideosYet')}</p>
          <p className="text-xs mt-1 opacity-70">{t('importFolderHint')}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-text-primary">{t('recentlyAdded')}</h2>
        <p className="text-xs text-muted-text">
          {videos.length} {t('videosLower')} {t('groupedInto')} {groups.length} {t('playlistsLower')}
        </p>
      </div>
      <div ref={scrollRef} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
        {groups.map((group) => (
          <RecentGroupCard
            key={group.key}
            title={group.title}
            count={group.items.length}
            item={group.items[0]}
            onPlay={handlePlay}
            uncategorizedLabel={t('uncategorized')}
            addedLabel={t('added')}
          />
        ))}
      </div>
    </section>
  );
};

const RecentGroupCard: React.FC<{
  title: string;
  count: number;
  item: { video: Video; playlist: Playlist | null };
  onPlay: (video: Video, playlist: Playlist | null) => void;
  uncategorizedLabel: string;
  addedLabel: string;
}> = ({ title, count, item, onPlay, uncategorizedLabel, addedLabel }) => {
  const { video, playlist } = item;
  const canPlay = !!playlist;

  return (
    <button
      type="button"
      onClick={() => canPlay && onPlay(video, playlist)}
      disabled={!canPlay}
      className="premium-card premium-card-hover group overflow-hidden rounded-lg text-left disabled:cursor-default"
    >
      <div className="relative aspect-video overflow-hidden bg-elevated-panel">
        <LocalThumbnail
          path={video.thumbnailPath}
          label={video.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
          iconClassName="h-7 w-7 text-muted-text/60"
          fallbackClassName="thumbnail-fallback"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
        {canPlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue/90 shadow-teal">
              <Play size={20} className="ml-0.5 text-background" fill="currentColor" />
            </div>
          </div>
        )}
        <div className="media-badge absolute bottom-2 right-2">
          {formatDuration(video.durationSeconds)}
        </div>
      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-text">
          <FolderOpen className="h-4 w-4 shrink-0 text-primary-blue" />
          <span className="truncate">{title}</span>
          <span className="ml-auto rounded-full border border-primary-blue/15 bg-primary-blue/10 px-2 py-0.5 text-[11px] text-primary-blue">
            {count}
          </span>
        </div>
        <p className="truncate text-sm font-semibold text-text-primary">{video.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-text">
          {video.speaker || video.category || uncategorizedLabel}
        </p>
        <p className="mt-1 text-xs text-muted-text">
          {addedLabel} {new Date(video.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </p>
      </div>
    </button>
  );
};
