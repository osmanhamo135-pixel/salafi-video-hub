import React, { useCallback, useEffect, useRef, useState } from 'react';
import { check, DownloadEvent, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, X } from 'lucide-react';
import { useI18n } from '@/i18n';

type UpdateState = 'idle' | 'available' | 'downloading' | 'installing' | 'installed' | 'error';

export const UpdateManager: React.FC = () => {
  const { t } = useI18n();
  const [state, setState] = useState<UpdateState>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const totalBytesRef = useRef<number | null>(null);

  const checkForUpdates = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setState('idle');
        setError(null);
      }

      const availableUpdate = await check({ timeout: 12000 });
      if (!availableUpdate) return;

      setUpdate(availableUpdate);
      setState('available');
      setError(null);
      setProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(null);
      totalBytesRef.current = null;
    } catch (checkError) {
      const message = getUpdateErrorMessage(checkError, t('updateServerNotReady'));
      if (manual) {
        setState('error');
        setError(message);
      } else {
        console.info('[Salafi Video Hub] updater check skipped:', message);
      }
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      checkForUpdates(false);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [checkForUpdates]);

  const installUpdate = async () => {
    if (!update || state === 'downloading' || state === 'installing') return;

    try {
      setState('downloading');
      setError(null);
      setProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(null);
      totalBytesRef.current = null;

      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === 'Started') {
          const contentLength = event.data.contentLength ?? null;
          totalBytesRef.current = contentLength;
          setTotalBytes(contentLength);
          setDownloadedBytes(0);
          setProgress(0);
          return;
        }

        if (event.event === 'Progress') {
          setDownloadedBytes((previous) => {
            const next = previous + event.data.chunkLength;
            const total = totalBytesRef.current;
            if (total && total > 0) {
              setProgress(Math.min((next / total) * 100, 100));
            }
            return next;
          });
          return;
        }

        setState('installing');
        setProgress(100);
      }, { timeout: 600000 });

      setState('installed');
      setProgress(100);
    } catch (installError) {
      setState('error');
      setError(getUpdateErrorMessage(installError, t('updateCheckFailed')));
    }
  };

  if (state === 'idle') return null;

  const isBusy = state === 'downloading' || state === 'installing';
  const title = state === 'installed'
    ? t('updateReady')
    : state === 'error'
      ? t('updateCheckFailed')
      : t('updateAvailable');

  const body = state === 'installed'
    ? t('updateReadyBody')
    : state === 'error'
      ? error ?? t('updateServerNotReady')
      : t('updateAvailableBody');

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-panel/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="icon-medallion h-10 w-10 shrink-0">
          {state === 'installed' ? (
            <CheckCircle2 className="h-5 w-5 text-success-green" />
          ) : state === 'error' ? (
            <AlertTriangle className="h-5 w-5 text-warning-orange" />
          ) : isBusy ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary-blue" />
          ) : (
            <Download className="h-5 w-5 text-primary-blue" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{title}</p>
              <p className="mt-1 text-xs text-muted-text">{body}</p>
            </div>
            {!isBusy && (
              <button
                type="button"
                onClick={() => setState('idle')}
                className="rounded p-1 text-muted-text hover:bg-panel-hover hover:text-text-primary"
                title={t('updateLater')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {update && state !== 'error' && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-border bg-background/70 p-2 text-xs">
              <span className="text-muted-text">{t('currentVersion')}</span>
              <span className="truncate text-right text-text-primary">{update.currentVersion}</span>
              <span className="text-muted-text">{t('latestVersion')}</span>
              <span className="truncate text-right text-primary-blue">{update.version}</span>
            </div>
          )}

          {isBusy && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary-blue transition-all" style={{ width: `${Math.round(progress)}%` }} />
              </div>
              <p className="mt-1 text-right text-xs tabular-nums text-muted-text">
                {totalBytes ? `${Math.round(progress)}%` : formatBytes(downloadedBytes)}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {state === 'error' && (
              <button type="button" onClick={() => checkForUpdates(true)} className="btn-secondary px-3 py-2 text-xs">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('retry')}
              </button>
            )}

            {state === 'available' && (
              <button type="button" onClick={installUpdate} className="btn-primary px-3 py-2 text-xs">
                <Download className="h-3.5 w-3.5" />
                {t('downloadUpdate')}
              </button>
            )}

            {state === 'downloading' && (
              <button type="button" disabled className="btn-primary px-3 py-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('downloadingUpdate')}
              </button>
            )}

            {state === 'installing' && (
              <button type="button" disabled className="btn-primary px-3 py-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('installingUpdate')}
              </button>
            )}

            {state === 'installed' && (
              <button type="button" onClick={() => relaunch()} className="btn-primary px-3 py-2 text-xs">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('restartNow')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const getUpdateErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};
