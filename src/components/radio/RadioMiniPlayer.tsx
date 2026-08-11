import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  Moon,
  Pause,
  Play,
  RadioTower,
  RefreshCw,
  Repeat,
  Volume2,
  X,
} from 'lucide-react';
import { audioElementHolder, SleepMinutes, useRadioStore } from '@/store/radioStore';
import { formatTime } from '@/utils/formatTime';
import { Select } from '@/components/ui/Select';
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
  const looping = useRadioStore((state) => state.looping);
  const sleepMinutes = useRadioStore((state) => state.sleepMinutes);
  const togglePlay = useRadioStore((state) => state.togglePlay);
  const stop = useRadioStore((state) => state.stop);
  const retry = useRadioStore((state) => state.retry);
  const markPlaybackError = useRadioStore((state) => state.markPlaybackError);
  const markPlaying = useRadioStore((state) => state.markPlaying);
  const markEnded = useRadioStore((state) => state.markEnded);
  const setVolume = useRadioStore((state) => state.setVolume);
  const toggleLooping = useRadioStore((state) => state.toggleLooping);
  const setSleepMinutes = useRadioStore((state) => state.setSleepMinutes);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [buffering, setBuffering] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  /* Guarded because this dock mounts app-wide: an engine with storage
     disabled or wedged throws on access, and an unguarded read here took the
     whole window down rather than losing one collapse preference. */
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem('salafi-hub.player-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const seekable = Number.isFinite(duration) && duration > 0;
  /* Recitation plays through this same dock, but it is not a radio station
     and must not be dressed as one: a mushaf next to a "Live" pip and a
     RadioTower icon reads as the app not knowing what it is playing. The
     station id is the discriminator the Qur'an page already keys on. */
  const isQuran = Boolean(current?.id.startsWith('quran-'));
  const isQuranSync = Boolean(current?.id.startsWith('quran-sync-'));

  const setCollapsedPersisted = (value: boolean) => {
    setCollapsed(value);
    try {
      localStorage.setItem('salafi-hub.player-collapsed', value ? '1' : '0');
    } catch {
      /* quota or private mode — the dock still collapses, it just forgets */
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume / 100;
  }, [volume, current]);

  // The element is keyed on the station, so changing station unmounts it and
  // rejects any pending play() with AbortError. Reporting that as a playback
  // error would set playbackError globally and pause the station the user just
  // picked — a healthy stream showing "stream problem". Only report a rejection
  // that belongs to the element still mounted, and never an abort.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;

    if (playing) {
      setBuffering(true);
      // An element that already failed keeps its MediaError until something
      // reloads it, and play() on it fails again without touching the network.
      // `retry` re-sets the same station, which does not remount the element
      // (the key `${id}-${url}` is unchanged), so without this load() "press to
      // retry" could never recover a station once it errored — the user was
      // stuck on the error state even after the stream came back.
      if (audio.error) audio.load();
      audio.play().catch((error: unknown) => {
        if (audioRef.current !== audio) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setBuffering(false);
        markPlaybackError();
      });
    } else {
      audio.pause();
      setBuffering(false);
    }
  }, [playing, current, markPlaybackError]);

  // Clock state belongs to the element that produced it. Without this reset a
  // recorded surah's duration survives into a live stream, which then renders a
  // seek bar and an enabled loop button for something that cannot seek.
  useEffect(() => {
    setPosition(0);
    setDuration(0);
  }, [current?.id, current?.url]);

  /* Publish dock presence to the document so page layout can reserve space
     for it. A fixed dock that covers the last row of a list is the classic
     "why can't I reach the bottom item" bug. */
  useEffect(() => {
    const root = document.documentElement;
    if (current) root.dataset.dock = collapsed ? 'pill' : 'bar';
    else delete root.dataset.dock;
    return () => {
      delete root.dataset.dock;
    };
  }, [current, collapsed]);

  if (!current) return null;

  const audioElement = (
    <audio
        ref={(element) => {
          audioRef.current = element;
          audioElementHolder.current = element;
        }}
        key={`${current.id}-${current.url}`}
        src={current.url}
        loop={looping}
        preload="none"
        onPlaying={() => {
          setBuffering(false);
          markPlaying();
        }}
        onWaiting={() => setBuffering(true)}
        // `error` is not proof that the current stream is broken. With
        // preload="none" the element loads nothing until play(), so an error
        // raised while nothing is meant to be playing — a blank/unresolvable
        // src, or the webview tearing down an idle or paused stream — is not a
        // failure of the station the user is looking at. Reporting those turned
        // a healthy (or never-started) station into "stream problem — press to
        // retry". Only the element still mounted, and only while the user
        // actually asked for playback, may report a failure.
        onError={(event) => {
          if (audioRef.current !== event.currentTarget) return;
          setBuffering(false);
          if (!playing) return;
          markPlaybackError();
        }}
        onStalled={() => setBuffering(true)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => {
          setPosition(0);
          markEnded();
        }}
      />
  );

  // Collapsed: a tiny floating pill so nothing blocks the page while listening.
  if (collapsed) {
    return (
      <>
        {audioElement}
        <div className="fixed bottom-5 end-5 z-40 flex items-center gap-1 rounded-full border border-border/70 bg-panel/80 p-1 backdrop-blur-xl [box-shadow:0_1px_0_0_rgb(var(--text-main-rgb)/0.06)_inset,0_8px_28px_-8px_rgb(0_0_0/0.6),0_2px_8px_-2px_rgb(0_0_0/0.4)]">
          <button
            type="button"
            onClick={playbackError ? retry : togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-blue text-background shadow transition-transform hover:scale-105"
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
          <button
            type="button"
            onClick={() => setCollapsedPersisted(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-text hover:bg-panel-hover hover:text-text-primary"
            title={t('playerExpand')}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {audioElement}
      {/*
        The control cluster below is shrink-0 and ~250px wide, so at the old
        400px it ate everything the flex row had: the station name column was
        left with ~60px and truncated to "Radi...". Widening the panel and
        trimming the two fixed-width controls gives the name a readable share
        without the controls ever shrinking.
      */}
      {/* A dock, not a floating card. It spans the content column and sits on
          the window's bottom edge, which is where a desktop app puts transport
          — a 460px pill parked in the corner reads as a notification.
          It deliberately keeps owning the single global <audio> element:
          the Qur'an word-sync engine reads that element's clock every frame
          through audioElementHolder, so a second element, or moving ownership,
          would desynchronise the tracker from the recitation. */}
      <div className="player-dock">
        <div className="player-dock-inner flex items-center gap-3">
        <button
          type="button"
          onClick={playbackError ? retry : togglePlay}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-blue text-background shadow-lg transition-transform hover:scale-105"
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
            {isQuran ? (
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-accent-gold" />
            ) : (
              <RadioTower className="h-3.5 w-3.5 shrink-0 text-primary-blue" />
            )}
            <span className="truncate" title={current.name}>{current.name}</span>
          </p>
          {playbackError ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-warning-orange">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {/* Bare text is an anonymous flex item, which will not shrink
                  below its longest word and so spills out over the controls in
                  a narrow panel. Let this message wrap inside the name column
                  instead. */}
              <span className="min-w-0 break-words">{t('radioStreamProblem')}</span>
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
              className="range-quiet w-14"
              aria-label={t('volume')}
              style={{ '--fill': volume } as React.CSSProperties}
              title={t('volume')}
            />
          </div>

          <div className="relative" title={t('radioSleepTimer')}>
            <Moon className={`pointer-events-none absolute start-1.5 top-1/2 h-3 w-3 -translate-y-1/2 ${sleepMinutes ? 'text-accent-gold' : 'text-muted-text'}`} />
            <Select
              label={t('sleepTimer')}
              value={String(sleepMinutes)}
              onChange={(v) => setSleepMinutes(Number(v) as SleepMinutes)}
              className={sleepMinutes ? 'text-accent-gold' : ''}
              options={sleepOptions.map((minutes) => ({
                value: String(minutes),
                label: minutes === 0 ? t('off') : `${minutes}m`,
              }))}
            />
          </div>

          {!isQuranSync && (
          <button
            type="button"
            onClick={toggleLooping}
            disabled={!seekable}
            className={`rounded p-1 transition-colors ${
              looping
                ? 'bg-success-green/15 text-success-green'
                : 'text-muted-text hover:bg-panel-hover hover:text-text-primary'
            } disabled:cursor-not-allowed disabled:opacity-35`}
            title={looping ? t('quranRepeatSurahOn') : t('quranRepeatSurah')}
            aria-pressed={looping}
          >
            <Repeat className="h-4 w-4" />
          </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsedPersisted(true)}
            className="rounded p-1 text-muted-text hover:bg-panel-hover hover:text-text-primary"
            title={t('playerCollapse')}
          >
            <ChevronDown className="h-4 w-4" />
          </button>

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
            className="range-quiet min-w-0 flex-1"
            aria-label={t('playingNow')}
            title={t('playingNow')}
            style={{ '--fill': duration ? (Math.min(position, duration) / duration) * 100 : 0 } as React.CSSProperties}
          />
          <span className="w-10 text-[10px] tabular-nums text-muted-text" dir="ltr">
            {formatTime(duration)}
          </span>
          </div>
        )}
      </div>
    </>
  );
};
