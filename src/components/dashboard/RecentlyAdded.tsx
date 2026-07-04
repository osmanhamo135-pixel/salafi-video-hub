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
      <div ref={scrollRef} className="space-y-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text-primary">
              <FolderOpen className="h-4 w-4 text-primary-blue" />
              <span className="truncate">{group.title}</span>
              <span className="rounded-full border border-primary-blue/15 bg-primary-blue/10 px-2 py-0.5 text-xs text-primary-blue">
                {group.items.length}
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              {group.items.map(({ video, playlist }) => (
                <div
                  key={video.id}
                  onClick={() => handlePlay(video, playlist)}
                  className={`premium-card premium-card-hover group min-w-[260px] max-w-[260px] overflow-hidden rounded-lg ${
                    playlist ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="relative aspect-video overflow-hidden bg-elevated-panel">
                    <LocalThumbnail
                      path={video.thumbnailPath}
                      label={video.title}
                      className="w-full h-full object-cover"
                      iconClassName="w-7 h-7 text-muted-text/60"
                      fallbackClassName="thumbnail-fallback"
                    />
                    {playlist && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue/90 shadow-teal">
                          <Play size={20} className="ml-0.5 text-white" fill="white" />
                        </div>
                      </div>
                    )}
                    <div className="media-badge absolute bottom-2 right-2">
                      {formatDuration(video.durationSeconds)}
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-text-primary">{video.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-text">
                      {video.speaker || video.category || t('uncategorized')}
                    </p>
                    <p className="mt-1 text-xs text-muted-text">
                      {t('added')} {new Date(video.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
