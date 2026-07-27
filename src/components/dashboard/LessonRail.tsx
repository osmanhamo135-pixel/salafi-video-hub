import React from 'react';
import { Video } from '@/types';
import { Rail } from '@/components/ui/Rail';
import { LiftCard } from '@/components/ui/Spring';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { formatTime } from '@/utils/formatTime';
import { useI18n } from '@/i18n';

/* The un-thumbnailed plate rather than a black rectangle. These appear in
   bulk in a rail, and a row of black boxes reads as broken images. */
const PLATE = 'thumbnail-fallback thumbnail-fallback-quiet thumbnail-plate';

interface LessonRailProps {
  title: string;
  videos: Video[];
  onOpen: (video: Video) => void;
  /** Rendered at the end of the header row — a count, usually. */
  meta?: React.ReactNode;
}

/**
 * A row of lessons at a locked aspect ratio.
 *
 * Density is what separates a library from a settings page. The card carries
 * the microdata a student actually scans — category, duration, and how far in
 * they are — and nothing else. Notably it does NOT carry the file path: that
 * was shipped on card faces as truncated `C:\Users\...`, which is a debug
 * affordance, and it belongs in the overflow menu.
 */
export const LessonRail: React.FC<LessonRailProps> = ({ title, videos, onOpen, meta }) => {
  const { language } = useI18n();
  if (!videos.length) return null;

  const eyebrow =
    language === 'ar'
      ? 'text-[11px] font-medium text-muted-text'
      : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-text';

  return (
    <section className="mt-9">
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2 className={eyebrow}>{title}</h2>
        {meta ?? (
          <span className="text-[11px] tabular-nums text-text-faint">
            <bdi>{videos.length}</bdi>
          </span>
        )}
      </div>

      <Rail label={title}>
        {videos.map((video) => {
          const pct = video.durationSeconds
            ? Math.min(100, (video.progressSeconds / video.durationSeconds) * 100)
            : 0;
          return (
            <LiftCard key={video.id} className="poster">
              <button
                type="button"
                onClick={() => onOpen(video)}
                className="glass glass-hover glow-edge block w-full overflow-hidden rounded-lg text-start"
              >
                <div className="poster-art">
                  <LocalThumbnail
                    path={video.thumbnailPath}
                    label={video.title}
                    className="h-full w-full object-cover"
                    fallbackClassName={PLATE}
                  />
                  {pct > 0 && (
                    <div className="poster-progress" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <p className="line-clamp-2 text-[13px] font-medium leading-snug text-text-primary">
                    {video.title}
                  </p>
                  {video.speaker && (
                    <p className="mt-1 truncate text-[11px] text-muted-text">{video.speaker}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] tabular-nums text-text-faint">
                    <bdi>{formatTime(video.durationSeconds)}</bdi>
                    {video.category && (
                      <>
                        <span aria-hidden="true">·</span>
                        <bdi className="truncate">{video.category}</bdi>
                      </>
                    )}
                  </p>
                </div>
              </button>
            </LiftCard>
          );
        })}
      </Rail>
    </section>
  );
};
