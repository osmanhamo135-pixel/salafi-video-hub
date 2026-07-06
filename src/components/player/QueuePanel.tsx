import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, ListMusic, Search, X } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import { QueueRow } from './QueueRow';
import { useI18n } from '@/i18n';

const ROW_HEIGHT = 76;
const OVERSCAN_ROWS = 6;

export const QueuePanel: React.FC = () => {
  const { t } = useI18n();
  const queueVideoIds = usePlayerStore((state) => state.queueVideoIds);
  const videos = usePlayerStore((state) => state.videos);
  const currentVideoId = usePlayerStore((state) => state.currentVideoId);
  const playVideo = usePlayerStore((state) => state.playVideo);
  const [query, setQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const indexById = useMemo(() => {
    return new Map(queueVideoIds.map((id, index) => [id, index]));
  }, [queueVideoIds]);

  const totalDuration = useMemo(() => {
    let total = 0;
    for (const id of queueVideoIds) {
      const video = videos.get(id);
      if (video) total += video.durationSeconds;
    }
    return total;
  }, [queueVideoIds, videos]);

  const visibleQueueIds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return queueVideoIds;

    return queueVideoIds.filter((id) => {
      const video = videos.get(id);
      if (!video) return false;
      return video.title.toLowerCase().includes(normalizedQuery) ||
        video.fileName.toLowerCase().includes(normalizedQuery);
    });
  }, [query, queueVideoIds, videos]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;

    const updateHeight = () => setViewportHeight(node.clientHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!currentVideoId || query) return;
    const currentVisibleIndex = visibleQueueIds.indexOf(currentVideoId);
    if (currentVisibleIndex < 0) return;

    const node = listRef.current;
    if (!node) return;
    node.scrollTop = Math.max(0, currentVisibleIndex * ROW_HEIGHT - ROW_HEIGHT * 2);
  }, [currentVideoId, query, visibleQueueIds]);

  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
  );
  const endIndex = Math.min(
    visibleQueueIds.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN_ROWS,
  );
  const mountedQueueIds = visibleQueueIds.slice(startIndex, endIndex);

  const formatTotalDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="flex h-full w-[400px] min-w-[400px] flex-col border-l border-border bg-[linear-gradient(180deg,var(--bg-panel),var(--bg-main))]">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ListMusic className="h-4 w-4 text-primary-blue" />
          <span className="text-sm font-semibold text-text-primary">
            {t('queue')}
          </span>
          <span className="rounded-full border border-primary-blue/15 bg-primary-blue/10 px-2 py-0.5 text-xs text-primary-blue">
            {queueVideoIds.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-text">
          <Clock className="w-3 h-3" />
          <span>{formatTotalDuration(totalDuration)}</span>
        </div>
      </div>

      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-text" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setScrollTop(0);
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
            placeholder={t('searchQueue')}
            className="surface-input w-full py-1.5 ps-8 pe-8 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setScrollTop(0);
                if (listRef.current) listRef.current.scrollTop = 0;
              }}
              title={t('clearQueueSearch')}
              className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-text hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-2 py-2"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {queueVideoIds.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-muted-text">
            <ListMusic className="mb-2 h-8 w-8 text-primary-blue/45" />
            <p className="text-sm">{t('noVideosInQueue')}</p>
          </div>
        ) : visibleQueueIds.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center text-muted-text">
            <Search className="mb-2 h-8 w-8 text-primary-blue/45" />
            <p className="text-sm">{t('noQueueMatches')}</p>
          </div>
        ) : (
          <div
            className="relative"
            style={{ height: visibleQueueIds.length * ROW_HEIGHT }}
          >
            {mountedQueueIds.map((id, offset) => {
              const video = videos.get(id);
              if (!video) return null;
              const visibleIndex = startIndex + offset;
              const index = indexById.get(id) ?? visibleIndex;

              return (
                <div
                  key={id}
                  className="absolute inset-x-0"
                  data-current={id === currentVideoId}
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${visibleIndex * ROW_HEIGHT}px)`,
                  }}
                >
                  <QueueRow
                    video={video}
                    index={index}
                    isCurrent={id === currentVideoId}
                    onPlay={() => playVideo(id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
