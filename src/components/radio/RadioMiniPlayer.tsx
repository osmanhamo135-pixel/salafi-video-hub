import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, Moon, Pause, Play, RadioTower, RefreshCw, Volume2, X } from 'lucide-react';
import { audioElementHolder, SleepMinutes, useRadioStore } from '@/store/radioStore';
import { formatTime } from '@/utils/formatTime';
import { useI18n } from '@/i18n';

const sleepOptions: SleepMinutes[] = [0, 15, 30, 60, 90];

/**
 * Global radio mini-player. Mounted once at the app root so the stream keeps
 * playing while the user navigates between pages.
 */
export const RadioMiniPlayer: React.FC = () => {
  const { t } = useI18n();
  const current = useRadioStore((state) => state.current);
  const playing = useRadioStore((state) => state.playing);
  const playbackError = useRadioStore((state) => state.playbackError);
  const volume = useRadioStore((state) => state.volume);
  const sleepMinutes = useRadioStore((state) => state.sleepMinutes);
  const togglePlay = useRadioStore((state) => state.togglePlay);
  const stop = useRadioStore((state) => state.stop);
  const retry = useRadioStore((state) => state.retry);
  const markPlaybackError = useRadioStore((state) => state.markPlaybackError);
  const markPlaying = useRadioStore((state) => state.markPlaying);
  const setVolume = useRadioStore((state) => state.setVolume);
  const setSleepMinutes = useRadioStore((state) => state.setSleepMinutes);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [buffering, setBuffering] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const seekable = Number.isFinite(duration) && duration > 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume, current]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;

    if (playing) {
      setBuffering(true);
      audio.play().catch(() => {
        setBuffering(false);
        markPlaybackError();
      });
    } else {
      audio.pause();
      setBuffering(false);
    }
  }, [playing, current, markPlaybackError]);

  if (!current) return null;

  return (
    <div className="fixed bottom-4 end-4 z-40 w-[400px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-panel/95 p-3 shadow-2xl backdrop-blur">
      <audio
        ref={(element) => {
          audioRef.current = element;
          audioElementHolder.current = element;
        }}
        key={`${current.id}-${current.url}`}
        src={current.url}
        preload="none"
        onPlaying={() => {
          setBuffering(false);
          markPlaying();
        }}
        onWaiting={() => setBuffering(true)}
        onError={() => {
          setBuffering(false);
          markPlaybackError();
        }}
        onStalled={() => setBuffering(true)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => setPosition(0)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={playbackError ? retry : togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-blue text-white shadow-lg transition-transform hover:scale-105"
          title={playbackError ? t('retry') : playing ? t('pause') : t('play')}
        >
          {playbackError ? (
            <RefreshCw className="h-4 w-4" />
          ) : buffering && playing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className="h-4 w-4" fill="currentColor" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <RadioTower className="h-3.5 w-3.5 shrink-0 text-primary-blue" />
            <span className="truncate" title={current.name}>{current.name}</span>
          </p>
          {playbackError ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-warning-orange">
              <AlertTriangle className="h-3 w-3" />
              {t('radioStreamProblem')}
            </p>
          ) : (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-text">
              {playing && !buffering && !seekable && (
                <span className="inline-flex items-center gap-1 font-medium text-success-green">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-green" />
                  {t('radioLive')}
                </span>
              )}
              {playing && !buffering && seekable && (
                <span className="font-medium text-primary-blue">{t('playingNow')}</span>
              )}
              {buffering && playing && <span>{t('radioBuffering')}</span>}
              {!playing && <span>{t('pause')}</span>}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-1">
            <Volume2 className="h-3.5 w-3.5 text-muted-text" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-border accent-primary-blue"
              title={t('volume')}
            />
          </div>

          <div className="relative" title={t('radioSleepTimer')}>
            <Moon className={`pointer-events-none absolute start-1.5 top-1/2 h-3 w-3 -translate-y-1/2 ${sleepMinutes ? 'text-accent-gold' : 'text-muted-text'}`} />
            <select
              value={sleepMinutes}
              onChange={(event) => setSleepMinutes(Number(event.target.value) as SleepMinutes)}
              className={`surface-input w-[72px] py-1 ps-6 text-[11px] ${sleepMinutes ? 'text-accent-gold' : ''}`}
            >
              {sleepOptions.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes === 0 ? t('off') : `${minutes}m`}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={stop}
            className="rounded p-1 text-muted-text hover:bg-panel-hover hover:text-text-primary"
            title={t('close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {seekable && (
        <div className="mt-2 flex items-center gap-2">
          <span className="w-10 text-end text-[10px] tabular-nums text-muted-text" dir="ltr">
            {formatTime(position)}
          </span>
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={Math.min(position, duration)}
            onChange={(event) => {
              const audio = audioRef.current;
              if (audio) audio.currentTime = Number(event.target.value);
            }}
            className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-lg bg-border accent-primary-blue"
          />
          <span className="w-10 text-[10px] tabular-nums text-muted-text" dir="ltr">
            {formatTime(duration)}
          </span>
        </div>
      )}
    </div>
  );
};
