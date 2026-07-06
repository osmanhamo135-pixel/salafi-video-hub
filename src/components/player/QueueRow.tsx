import React, { useMemo } from 'react';
import { Check } from 'lucide-react';
import { Video } from '@/types';
import { formatTime } from '@/utils/formatTime';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { useI18n } from '@/i18n';

interface QueueRowProps {
  video: Video;
  index: number;
  isCurrent: boolean;
  onPlay: () => void;
}

export const QueueRow: React.FC<QueueRowProps> = React.memo(({ video, index, isCurrent, onPlay }) => {
  const { t } = useI18n();
  const progressPercent = useMemo(() => {
    if (!video.durationSeconds) return 0;
    return Math.min((video.progressSeconds / video.durationSeconds) * 100, 100);
  }, [video.durationSeconds, video.progressSeconds]);

  return (
    <button
      onClick={onPlay}
      className={`
        group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors
        hover:bg-panel-hover
        ${isCurrent ? 'border-primary-blue/25 bg-primary-blue/10 shadow-[inset_3px_0_0_rgba(15,185,177,0.8)] hover:bg-primary-blue/15' : 'border-transparent'}
      `}
    >
      {/* Index / Play icon */}
      <div className="flex items-center justify-center w-6 shrink-0">
        {isCurrent ? (
          <div className="flex items-center gap-0.5">
            <div className="w-1 h-3 bg-primary-blue rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
            <div className="w-1 h-3 bg-primary-blue rounded-full animate-[pulse_1s_ease-in-out_infinite_0.2s]" />
            <div className="w-1 h-3 bg-primary-blue rounded-full animate-[pulse_1s_ease-in-out_infinite_0.4s]" />
          </div>
        ) : video.completed ? (
          <Check className="w-4 h-4 text-success-green" />
        ) : (
          <span className="text-xs text-muted-text group-hover:text-text-primary">
            {index + 1}
          </span>
        )}
      </div>

      {/* Thumbnail */}
      <div className="relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-md bg-background">
        <LocalThumbnail
          path={video.thumbnailPath}
          label={video.title}
          className="w-full h-full object-cover"
          iconClassName="w-4 h-4 text-muted-text"
          fallbackClassName="thumbnail-fallback"
        />
        {progressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/50">
            <div className="h-full bg-primary-blue" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isCurrent ? 'text-primary-blue font-medium' : 'text-text-primary'}`}>
          {video.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-text">
            {formatTime(video.durationSeconds)}
          </span>
          {isCurrent && (
            <span className="rounded-full bg-primary-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-primary-blue">
              {t('playingNow')}
            </span>
          )}
          {video.completed && !isCurrent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success-green/20 text-success-green font-medium">
              {t('done')}
            </span>
          )}
        </div>
      </div>

    </button>
  );
});

QueueRow.displayName = 'QueueRow';
