import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, FolderOpen, Info, Loader2 } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { usePlayerStore } from '@/store/playerStore';
import { formatTime } from '@/utils/formatTime';
import { useI18n } from '@/i18n';

interface VideoMetadata {
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  duration?: number;
}

type PlaybackIssue = 'file-missing' | 'path-permission' | 'codec' | 'container' | 'unknown';
type Translate = ReturnType<typeof useI18n>['t'];

interface PlaybackDiagnostics {
  originalFilePath: string | null;
  convertedVideoSrc: string | null;
  currentVideoSrc: string | null;
  assetProtocolAllowed: boolean | null;
  assetProtocolError: string | null;
  fileExists: boolean | null;
  metadata: VideoMetadata | null;
  metadataError: string | null;
  errorCode: number | null;
  errorMessage: string | null;
  issue: PlaybackIssue | null;
  networkState: number | null;
  readyState: number | null;
  sourceProblem: string | null;
}

const emptyDiagnostics: PlaybackDiagnostics = {
  originalFilePath: null,
  convertedVideoSrc: null,
  currentVideoSrc: null,
  assetProtocolAllowed: null,
  assetProtocolError: null,
  fileExists: null,
  metadata: null,
  metadataError: null,
  errorCode: null,
  errorMessage: null,
  issue: null,
  networkState: null,
  readyState: null,
  sourceProblem: null,
};

export const VideoPlayer: React.FC = () => {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentVideoId = usePlayerStore((state) => state.currentVideoId);
  const videos = usePlayerStore((state) => state.videos);
  const status = usePlayerStore((state) => state.status);
  const onLoadedMetadata = usePlayerStore((state) => state.onLoadedMetadata);
  const onCanPlay = usePlayerStore((state) => state.onCanPlay);
  const onPlaying = usePlayerStore((state) => state.onPlaying);
  const onPause = usePlayerStore((state) => state.onPause);
  const onTimeUpdate = usePlayerStore((state) => state.onTimeUpdate);
  const onEnded = usePlayerStore((state) => state.onEnded);
  const onError = usePlayerStore((state) => state.onError);
  const isMuted = usePlayerStore((state) => state.isMuted);
  const volume = usePlayerStore((state) => state.volume);
  const playbackRate = usePlayerStore((state) => state.playbackRate);
  const duration = usePlayerStore((state) => state.duration);
  const errorMessage = usePlayerStore((state) => state.errorMessage);
  const shouldAutoplayOnLoad = usePlayerStore((state) => state.shouldAutoplayOnLoad);
  const togglePlay = usePlayerStore((state) => state.togglePlay);

  const [diagnostics, setDiagnostics] = useState<PlaybackDiagnostics>(emptyDiagnostics);
  const currentVideo = currentVideoId ? videos.get(currentVideoId) : undefined;

  const videoSrc = useMemo(() => {
    if (!currentVideo?.filePath) return null;
    return toTauriAssetSrc(currentVideo.filePath);
  }, [currentVideo?.filePath]);

  useEffect(() => {
    const sourceProblem = getVideoSourceProblem(videoSrc);
    setDiagnostics({
      ...emptyDiagnostics,
      originalFilePath: currentVideo?.filePath ?? null,
      convertedVideoSrc: videoSrc,
      sourceProblem,
    });

    if (!currentVideo?.filePath) return;

    if (!videoSrc || sourceProblem) {
      onError(sourceProblem || t('pathPermissionMessage'));
      setDiagnostics((previous) => ({
        ...previous,
        issue: 'path-permission',
      }));
      return;
    }

    let cancelled = false;
    const loadDiagnostics = async () => {
      let fileExists: boolean | null = null;
      let metadata: VideoMetadata | null = parseCodecInfo(currentVideo.codecInfo);
      let metadataError: string | null = null;
      let assetProtocolAllowed: boolean | null = null;
      let assetProtocolError: string | null = null;

      try {
        await invoke('allow_video_asset_path', { filePath: currentVideo.filePath });
        assetProtocolAllowed = true;
      } catch (error) {
        assetProtocolAllowed = false;
        assetProtocolError = String(error);
      }

      try {
        fileExists = await invoke<boolean>('check_file_exists', { filePath: currentVideo.filePath });
      } catch (error) {
        metadataError = `File check failed: ${String(error)}`;
      }

      if (fileExists === false) {
        if (!cancelled) {
          setDiagnostics((previous) => ({
            ...previous,
            fileExists,
            metadata,
            metadataError,
            assetProtocolAllowed,
            assetProtocolError,
            issue: 'file-missing',
          }));
          onError(t('fileMissingMessage'));
        }
        return;
      }

      if (!cancelled) {
        const video = videoRef.current;
        const shouldFailForAssetAccess =
          assetProtocolAllowed === false && (!video || video.readyState === 0);

        setDiagnostics((previous) => ({
          ...previous,
          fileExists,
          metadata,
          metadataError,
          assetProtocolAllowed,
          assetProtocolError,
          issue: shouldFailForAssetAccess ? 'path-permission' : previous.issue,
        }));

        if (shouldFailForAssetAccess) {
          onError(t('pathPermissionMessage'));
        }
      }
    };

    loadDiagnostics();

    return () => {
      cancelled = true;
    };
  }, [currentVideo?.codecInfo, currentVideo?.filePath, onError, t, videoSrc]);

  const requestVideoPlay = useCallback((video: HTMLVideoElement, reason: string) => {
    video.play().catch((error) => {
      console.error('[Salafi Video Hub] video.play() failed', { reason, error });
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (status === 'playing' && video.paused) {
      requestVideoPlay(video, 'status-playing');
    } else if ((status === 'paused' || status === 'idle') && !video.paused) {
      video.pause();
    }
  }, [requestVideoPlay, status, videoSrc]);

  useEffect(() => {
    if (!currentVideo?.filePath || (status !== 'loadingMetadata' && status !== 'playing')) return;

    const timeout = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.readyState >= 1) return;

      setDiagnostics((previous) => ({
        ...previous,
        currentVideoSrc: video.currentSrc || video.src || null,
        networkState: video.networkState,
        readyState: video.readyState,
        issue: 'unknown',
        errorMessage: t('videoLoadTimedOut'),
      }));
      onError(t('videoLoadTimedOut'));
    }, 15000);

    return () => window.clearTimeout(timeout);
  }, [currentVideo?.filePath, onError, status, t]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, [volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    return usePlayerStore.subscribe((state, previousState) => {
      if (state.currentTime === previousState.currentTime) return;
      const video = videoRef.current;
      if (!video) return;
      if (Math.abs(video.currentTime - state.currentTime) > 1) {
        video.currentTime = state.currentTime;
      }
    });
  }, []);

  const captureMediaState = useCallback((video: HTMLVideoElement, _eventName: string) => {
    const mediaState = {
      currentSrc: video.currentSrc || video.src || null,
      networkState: video.networkState,
      readyState: video.readyState,
    };

    setDiagnostics((previous) => ({
      ...previous,
      currentVideoSrc: mediaState.currentSrc,
      networkState: mediaState.networkState,
      readyState: mediaState.readyState,
    }));
  }, [currentVideo?.filePath, videoSrc]);

  const handleVideoError = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    const mediaError = video.error;
    const errorCode = mediaError?.code ?? null;
    const mediaMessage = mediaError?.message || mediaErrorCodeToMessage(errorCode, t);
    const issue = classifyPlaybackIssue(errorCode, diagnostics);
    const userMessage = playbackIssueMessage(issue, diagnostics.metadata, mediaMessage, t);
    const currentSrc = video.currentSrc || video.src || null;
    const networkState = video.networkState;
    const readyState = video.readyState;

    console.error('[Salafi Video Hub] Video playback error', {
      originalFilePath: currentVideo?.filePath,
      finalVideoSrc: videoSrc,
      currentVideoSrc: currentSrc,
      videoErrorCode: errorCode,
      videoErrorMessage: mediaMessage,
      mediaNetworkState: networkState,
      mediaReadyState: readyState,
      fileExists: diagnostics.fileExists,
      assetProtocolAllowed: diagnostics.assetProtocolAllowed,
      assetProtocolError: diagnostics.assetProtocolError,
      metadata: diagnostics.metadata,
      metadataError: diagnostics.metadataError,
      sourceProblem: diagnostics.sourceProblem,
    });

    setDiagnostics((previous) => ({
      ...previous,
      currentVideoSrc: currentSrc,
      errorCode,
      errorMessage: mediaMessage,
      issue,
      networkState,
      readyState,
    }));
    onError(userMessage);
  }, [currentVideo?.filePath, diagnostics, onError, t, videoSrc]);

  const isLoading = status === 'loadingMetadata' || status === 'resolvingPath';
  const videoEl = videoRef.current;
  const isReadyEnough = videoEl && videoEl.readyState >= 1 && duration > 0;
  const shouldShowOverlay = (isLoading || (status === 'playing' && shouldAutoplayOnLoad)) && !isReadyEnough;
  const isError = status === 'error' || status === 'missing' || diagnostics.issue === 'file-missing';

  if (!currentVideoId || !currentVideo) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-black">
        <div className="flex flex-col items-center text-muted-text">
          <PlayIcon className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">{t('selectVideoToPlay')}</p>
        </div>
      </div>
    );
  }

  if (isError) {
    const issue = diagnostics.issue ?? 'unknown';
    const metadata = diagnostics.metadata;

    return (
      <div className="flex flex-1 items-center justify-center rounded-lg bg-black p-8">
        <div className="premium-surface max-w-2xl rounded-lg p-6 text-left">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-danger-red/20 bg-danger-red/10">
              <AlertTriangle className="h-6 w-6 text-danger-red" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-text-primary">
                {playbackIssueTitle(issue, t)}
              </h3>
              <p className="mt-1 text-sm text-muted-text break-words">{currentVideo.fileName}</p>
              <p className="mt-3 text-sm text-text-primary">
                {errorMessage || playbackIssueMessage(issue, metadata, diagnostics.errorMessage, t)}
              </p>

              {(issue === 'codec' || issue === 'container') && (
                <p className="mt-2 text-sm text-warning-orange">
                  {t('convertToMp4Hint')}
                </p>
              )}

              <MetadataPanel diagnostics={diagnostics} fallbackDuration={currentVideo.durationSeconds} />

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => invoke('open_file_externally', { filePath: currentVideo.filePath }).catch(console.error)}
                  className="btn-primary"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('openExternally')}
                </button>
                <button
                  onClick={() => invoke('open_file_location', { filePath: currentVideo.filePath }).catch(console.error)}
                  className="btn-secondary"
                >
                  <FolderOpen className="w-4 h-4" />
                  {t('openFileLocation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-black shadow-panel">
      {videoSrc && !diagnostics.sourceProblem && (
        <video
          key={`${currentVideoId}-${videoSrc}`}
          src={videoSrc}
          ref={videoRef}
          className="w-full h-full object-contain"
          preload="auto"
          autoPlay={shouldAutoplayOnLoad || status === 'playing'}
          playsInline
          onLoadStart={(event) => captureMediaState(event.currentTarget, 'loadstart')}
          onLoadedMetadata={(event) => {
            captureMediaState(event.currentTarget, 'loadedmetadata');
            const resumeTime = usePlayerStore.getState().currentTime;
            if (resumeTime > 0 && Number.isFinite(event.currentTarget.duration)) {
              event.currentTarget.currentTime = Math.min(
                resumeTime,
                Math.max(event.currentTarget.duration - 0.5, 0),
              );
            }
            onLoadedMetadata(event.currentTarget.duration);
            if (usePlayerStore.getState().status === 'playing') {
              requestVideoPlay(event.currentTarget, 'loadedmetadata');
            }
          }}
          onCanPlay={(event) => {
            captureMediaState(event.currentTarget, 'canplay');
            onCanPlay();
            if (usePlayerStore.getState().status === 'playing') {
              requestVideoPlay(event.currentTarget, 'canplay');
            }
          }}
          onPlaying={(event) => {
            captureMediaState(event.currentTarget, 'playing');
            onPlaying();
          }}
          onPause={(event) => {
            captureMediaState(event.currentTarget, 'pause');
            onPause();
          }}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          onEnded={onEnded}
          onError={handleVideoError}
          onClick={togglePlay}
        />
      )}

      {shouldShowOverlay && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70">
          <Loader2 className="w-8 h-8 text-primary-blue animate-spin mb-3" />
          <p className="text-sm text-text-primary">{t('loadingVideo')}</p>
          <p className="text-xs text-muted-text mt-1">{currentVideo.title}</p>
        </div>
      )}

      {status === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/55">
            <PlayIcon className="w-8 h-8 text-white/80 ml-1" />
          </div>
        </div>
      )}
    </div>
  );
};

const MetadataPanel: React.FC<{
  diagnostics: PlaybackDiagnostics;
  fallbackDuration: number;
}> = ({ diagnostics, fallbackDuration }) => {
  const { t } = useI18n();
  const metadata = diagnostics.metadata;
  const rows = [
    [t('container'), metadata?.container || t('unknown')],
    [t('videoCodec'), metadata?.videoCodec || t('unknown')],
    [t('audioCodec'), metadata?.audioCodec || t('unknown')],
    [
      t('resolution'),
      metadata?.width && metadata?.height ? `${metadata.width} x ${metadata.height}` : t('unknown'),
    ],
    [t('duration'), formatTime(metadata?.duration || fallbackDuration || 0)],
  ];

  const debugRows = [
    [t('originalPath'), diagnostics.originalFilePath || t('unknown')],
    [t('finalVideoSrc'), diagnostics.convertedVideoSrc || t('unknown')],
    [t('videoCurrentSrc'), diagnostics.currentVideoSrc || t('notLoaded')],
    [
      t('assetAccess'),
      diagnostics.assetProtocolAllowed === null
        ? t('pending')
        : diagnostics.assetProtocolAllowed
          ? t('allowed')
          : t('blocked'),
    ],
    [t('networkState'), mediaNetworkStateLabel(diagnostics.networkState, t)],
    [t('readyState'), mediaReadyStateLabel(diagnostics.readyState, t)],
    [t('sourceCheck'), diagnostics.sourceProblem || t('ok')],
  ];

  return (
    <div className="mt-4 rounded-md border border-border bg-background/80 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-text">
        <Info className="h-3.5 w-3.5" />
        {t('playbackDiagnostics')}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <span className="text-muted-text">{label}</span>
            <span className="min-w-0 truncate text-text-primary" title={value}>{value}</span>
          </React.Fragment>
        ))}
        <span className="text-muted-text">{t('fileCheck')}</span>
        <span className="text-text-primary">
          {diagnostics.fileExists === null ? t('checking') : diagnostics.fileExists ? t('exists') : t('missing')}
        </span>
        {diagnostics.errorCode !== null && (
          <>
            <span className="text-muted-text">{t('videoErrorCode')}</span>
            <span className="text-text-primary">{diagnostics.errorCode}</span>
          </>
        )}
      </div>
      <div className="mt-3 border-t border-border pt-3 text-xs">
        <div className="grid gap-2">
          {debugRows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <span className="text-muted-text">{label}</span>
              <span className="min-w-0 break-all text-text-primary">{value}</span>
            </div>
          ))}
        </div>
      </div>
      {diagnostics.metadataError && (
        <p className="mt-2 text-xs text-warning-orange">{diagnostics.metadataError}</p>
      )}
      {diagnostics.assetProtocolError && (
        <p className="mt-2 text-xs text-warning-orange">{diagnostics.assetProtocolError}</p>
      )}
    </div>
  );
};

const toTauriAssetSrc = (filePath: string) => {
  const trimmedPath = filePath.trim();
  if (/^(asset:|https?:\/\/asset\.localhost\/)/i.test(trimmedPath)) {
    return trimmedPath;
  }

  try {
    return convertFileSrc(trimmedPath, 'asset');
  } catch (error) {
    console.error('[Salafi Video Hub] convertFileSrc failed', {
      originalFilePath: filePath,
      error,
    });
    return null;
  }
};

const getVideoSourceProblem = (videoSrc: string | null) => {
  if (!videoSrc) return 'Converted video src is empty.';
  if (/^[a-zA-Z]:[\\/]/.test(videoSrc) || videoSrc.startsWith('\\\\')) {
    return 'Converted video src is still a raw Windows path.';
  }
  if (!/^(asset:|https?:\/\/asset\.localhost\/)/i.test(videoSrc)) {
    return 'Converted video src is not using the Tauri asset protocol.';
  }
  if (/%25(3a|5c|2f)/i.test(videoSrc)) {
    return 'Converted video src looks double-encoded.';
  }
  return null;
};

const parseCodecInfo = (codecInfo: string | null): VideoMetadata | null => {
  if (!codecInfo) return null;
  try {
    return JSON.parse(codecInfo) as VideoMetadata;
  } catch {
    return null;
  }
};

const classifyPlaybackIssue = (
  errorCode: number | null,
  diagnostics: PlaybackDiagnostics,
): PlaybackIssue => {
  const { fileExists, metadata } = diagnostics;
  if (fileExists === false) return 'file-missing';
  if (diagnostics.sourceProblem || diagnostics.assetProtocolError || diagnostics.assetProtocolAllowed === false) {
    return 'path-permission';
  }
  if (errorCode === 2) return 'path-permission';
  if (hasNonWebViewCodec(metadata)) return 'codec';
  if (errorCode === 4 && hasUnsupportedContainer(metadata)) return 'container';
  if (errorCode === 4 && fileExists === true) return 'path-permission';
  return 'unknown';
};

const hasNonWebViewCodec = (metadata: VideoMetadata | null) => {
  if (!metadata) return false;
  const videoCodec = (metadata.videoCodec || '').toLowerCase();
  const audioCodec = (metadata.audioCodec || '').toLowerCase();
  const isH264 = videoCodec === 'h264' || videoCodec === 'avc1';
  const isAac = audioCodec === 'aac';
  return (!!videoCodec && !isH264) || (!!audioCodec && !isAac);
};

const hasUnsupportedContainer = (metadata: VideoMetadata | null) => {
  const container = (metadata?.container || '').toLowerCase();
  if (!container) return false;
  const supportedContainers = ['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2', 'matroska,webm', 'webm'];
  return !supportedContainers.some((item) => container.includes(item));
};

const playbackIssueTitle = (issue: PlaybackIssue, t: Translate) => {
  if (issue === 'file-missing') return t('fileMissing');
  if (issue === 'path-permission') return t('pathPermissionProblem');
  if (issue === 'codec') return t('codecUnsupported');
  if (issue === 'container') return t('containerUnsupported');
  return t('unknownPlaybackError');
};

const playbackIssueMessage = (
  issue: PlaybackIssue,
  metadata: VideoMetadata | null,
  mediaMessage: string | null,
  t: Translate,
) => {
  if (issue === 'file-missing') {
    return t('fileMissingMessage');
  }
  if (issue === 'path-permission') {
    return t('pathPermissionMessage');
  }
  if (issue === 'codec') {
    const videoCodec = metadata?.videoCodec || t('unknown');
    const audioCodec = metadata?.audioCodec || t('unknown');
    return `${t('thisFileUses')} ${videoCodec} ${t('videoCodec')} / ${audioCodec} ${t('audioCodec')}. ${t('webviewReliabilityHint')}`;
  }
  if (issue === 'container') {
    const container = metadata?.container || t('unknown');
    return `${t('thisFileUses')} ${container} ${t('container')}. ${t('webviewReliabilityHint')}`;
  }
  return mediaMessage || t('webviewCouldNotPlay');
};

const mediaErrorCodeToMessage = (code: number | null, t: Translate) => {
  if (code === 1) return t('playbackAborted');
  if (code === 2) return t('mediaPathError');
  if (code === 3) return t('mediaDecodeFailed');
  if (code === 4) return t('mediaSourceUnsupported');
  return t('unknownMediaError');
};

const mediaNetworkStateLabel = (state: number | null, t: Translate) => {
  if (state === 0) return '0 - empty';
  if (state === 1) return '1 - idle';
  if (state === 2) return '2 - loading';
  if (state === 3) return '3 - no source';
  return t('unknown');
};

const mediaReadyStateLabel = (state: number | null, t: Translate) => {
  if (state === 0) return '0 - no data';
  if (state === 1) return '1 - metadata';
  if (state === 2) return '2 - current data';
  if (state === 3) return '3 - future data';
  if (state === 4) return '4 - enough data';
  return t('unknown');
};

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="5,3 19,12 5,21" />
  </svg>
);
