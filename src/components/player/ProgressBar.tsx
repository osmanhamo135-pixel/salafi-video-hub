import React, { useCallback, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import { formatTime } from '@/utils/formatTime';

export const ProgressBar: React.FC = () => {
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const seek = usePlayerStore((state) => state.seek);
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = useCallback((clientX: number) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const newTime = percent * duration;
    seek(newTime);
  }, [duration, seek]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    handleSeek(e.clientX);
  }, [handleSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) {
      handleSeek(e.clientX);
    }
  }, [handleSeek]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      className="flex items-center gap-3 px-5 py-2 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <span className="text-xs text-muted-text font-mono tabular-nums w-12 text-right shrink-0">
        {formatTime(currentTime)}
      </span>

      <div
        ref={barRef}
        className="group relative h-3 flex-1 cursor-pointer rounded-full bg-panel-hover"
        onMouseDown={handleMouseDown}
      >
        {/* Background track */}
        <div className="absolute inset-0 rounded-full bg-panel-hover" />

        {/* Buffered area (not tracked, but nice visual) */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary-blue/15" style={{ width: `${progressPercent}%` }} />

        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-blue to-accent-blue transition-[width] duration-75"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Thumb - visible on hover/drag */}
          <div className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 scale-125 rounded-full bg-primary-blue-hover opacity-0 shadow-lg ring-2 ring-background transition-opacity group-hover:opacity-100" />
        </div>

        {/* Hover tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="whitespace-nowrap rounded-md border border-border bg-panel-hover px-2 py-1 text-xs text-text-primary shadow-panel">
            {formatTime(currentTime)}
          </div>
        </div>
      </div>

      <span className="text-xs text-muted-text font-mono tabular-nums w-12 shrink-0">
        {formatTime(duration)}
      </span>
    </div>
  );
};
