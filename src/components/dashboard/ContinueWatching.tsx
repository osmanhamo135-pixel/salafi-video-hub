import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Clock, FolderOpen, Play } from 'lucide-react';
import { ContinueWatchingItem } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { useAppStore } from '@/store/appStore';
import { formatTime } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

export const ContinueWatching: React.FC = () => {
  const { t } = useI18n();
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);
  const progressRefreshVersion = useAppStore((s) => s.progressRefreshVersion);
  const thumbnailRefreshVersion = useAppStore((s) => s.thumbnailRefreshVersion);
  const importRefreshVersion = useAppStore((s) => s.importRefreshVersion);

  useEffect(() => {
    let cancelled = false;
    const fetchItems = async () => {
      try {
        if (!loadedRef.current) setLoading(true);
        const data = await invoke<ContinueWatchingItem[]>('get_continue_watching', { limit: 20 });
        if (!cancelled) setItems(data || []);
      } catch (error) {
        console.error('Failed to load continue watching:', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) {
          loadedRef.current = true;
          setLoading(false);
        }
      }
    };
    fetchItems();
    return () => {
      cancelled = true;
    };
  }, [importRefreshVersion, progressRefreshVersion, thumbnailRefreshVersion]);

  const handlePlay = (item: ContinueWatchingItem) => {
    if (item.playlist) {
      openPlaylist(item.playlist.id, item.video.id);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: ContinueWatchingItem[] }>();

    for (const item of items) {
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
  }, [items]);

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-text-primary mt-8 mb-4">{t('continueWatching')}</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="premium-card h-[180px] min-w-[260px] animate-pulse rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-text-primary mt-8 mb-4">{t('continueWatching')}</h2>
        <div className="premium-card ornate-corner relative flex flex-col items-center justify-center rounded-lg p-8 text-muted-text">
          <div className="icon-medallion mb-3 h-14 w-14">
            <Clock size={28} className="text-primary-blue/70" />
          </div>
          <p className="text-sm">{t('noVideosInProgress')}</p>
          <p className="text-xs mt-1 opacity-70">{t('startWatchingHint')}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-text-primary">{t('continueWatching')}</h2>
        <p className="text-xs text-muted-text">
          {items.length} {t('videosLower')} {t('groupedInto')} {groups.length} {t('playlistsLower')}
        </p>
      </div>
      <div className="space-y-4">
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
              {group.items.map((item) => {
                const progressPercent = item.video.durationSeconds
                  ? (item.video.progressSeconds / item.video.durationSeconds) * 100
                  : 0;

                return (
                  <div
                    key={item.video.id}
                    className={`premium-card premium-card-hover group min-w-[260px] max-w-[260px] overflow-hidden rounded-lg ${item.playlist ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => handlePlay(item)}
                  >
                    <div className="relative aspect-video overflow-hidden bg-elevated-panel">
                      <LocalThumbnail
                        path={item.video.thumbnailPath}
                        label={item.video.title}
                        className="w-full h-full object-cover"
                        iconClassName="w-7 h-7 text-muted-text/60"
                        fallbackClassName="thumbnail-fallback"
                      />
                      {item.playlist && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-blue/90 shadow-teal">
                            <Play size={20} className="text-white ml-0.5" fill="white" />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                        <div
                          className="h-full bg-primary-blue"
                          style={{ width: `${Math.min(progressPercent, 100)}%` }}
                        />
                      </div>
                      <div className="media-badge absolute bottom-2 right-2">
                        {formatTime(item.video.durationSeconds)}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-text-primary">{item.video.title}</p>
                      <p className="mt-1 text-xs text-muted-text">
                        {formatTime(item.video.progressSeconds)} / {formatTime(item.video.durationSeconds)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
