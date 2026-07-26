import React, { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play } from 'lucide-react';
import { ContinueWatchingItem } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { useAppStore } from '@/store/appStore';
import { formatTime } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

/* .thumbnail-fallback bakes in an .icon-medallion (primary-blue border + fill)
   and a teal underline, which puts a second accent in every un-thumbnailed row.
   Neutralise both from the call site; the primitive itself is not ours to edit. */
const QUIET_FALLBACK =
  'thumbnail-fallback after:hidden [&_.icon-medallion]:border-border [&_.icon-medallion]:bg-transparent [&_.icon-medallion]:shadow-none [&_.icon-medallion]:after:hidden';

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

  return (
    <section className="mt-8">
      <div className="rule-head mb-1">
        <h2 className="text-sm font-semibold text-text-primary">{t('continueWatching')}</h2>
        <span className="text-xs tabular-nums text-muted-text">
          <bdi>{items.length}</bdi>
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
      ) : items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-text">{t('noVideosInProgress')}</p>
          <p className="mt-1 text-xs text-text-faint">{t('startWatchingHint')}</p>
        </div>
      ) : (
        <div className="rule-list">
          {groups.map((group) => (
            <ContinueRow
              key={group.key}
              title={group.title}
              count={group.items.length}
              item={group.items[0]}
              onPlay={handlePlay}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const ContinueRow: React.FC<{
  title: string;
  count: number;
  item: ContinueWatchingItem;
  onPlay: (item: ContinueWatchingItem) => void;
}> = ({ title, count, item, onPlay }) => {
  const progressPercent = item.video.durationSeconds
    ? Math.min((item.video.progressSeconds / item.video.durationSeconds) * 100, 100)
    : 0;
  const canPlay = !!item.playlist;

  return (
    <button
      type="button"
      onClick={() => canPlay && onPlay(item)}
      disabled={!canPlay}
      className="rule-row group w-full text-start disabled:cursor-default"
    >
      <div className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded bg-background">
        <LocalThumbnail
          path={item.video.thumbnailPath}
          label={item.video.title}
          className="h-full w-full object-cover"
          iconClassName="h-4 w-4 text-muted-text"
          fallbackClassName={QUIET_FALLBACK}
        />
        {canPlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Play className="h-5 w-5 fill-current text-text-primary" />
          </div>
        )}
        {progressPercent > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-background/70">
            <div className="h-full bg-muted-text" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm text-text-primary" title={item.video.title}>
          <bdi>{item.video.title}</bdi>
        </p>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-text">
          <span className="truncate" title={title}><bdi>{title}</bdi></span>
          {count > 1 && <span className="shrink-0 tabular-nums">+<bdi>{count - 1}</bdi></span>}
        </div>
      </div>

      <span className="shrink-0 text-xs tabular-nums text-muted-text">
        <bdi>{formatTime(item.video.progressSeconds)}</bdi> / <bdi>{formatTime(item.video.durationSeconds)}</bdi>
      </span>
    </button>
  );
};
