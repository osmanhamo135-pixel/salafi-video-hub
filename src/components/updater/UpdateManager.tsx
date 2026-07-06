import React, { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCw, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useUpdateStore } from '@/store/updateStore';

const INITIAL_CHECK_DELAY = 6000;
const PERIODIC_CHECK_INTERVAL = 3 * 60 * 60 * 1000; // re-check every 3 hours

export const UpdateManager: React.FC = () => {
  const { t } = useI18n();
  const phase = useUpdateStore((state) => state.phase);
  const update = useUpdateStore((state) => state.update);
  const error = useUpdateStore((state) => state.error);
  const progress = useUpdateStore((state) => state.progress);
  const downloadedBytes = useUpdateStore((state) => state.downloadedBytes);
  const totalBytes = useUpdateStore((state) => state.totalBytes);
  const dismissed = useUpdateStore((state) => state.dismissed);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const installUpdate = useUpdateStore((state) => state.installUpdate);
  const restart = useUpdateStore((state) => state.restart);
  const dismiss = useUpdateStore((state) => state.dismiss);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => checkForUpdates(), INITIAL_CHECK_DELAY);
    const interval = window.setInterval(() => checkForUpdates(), PERIODIC_CHECK_INTERVAL);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [checkForUpdates]);

  const isBusy = phase === 'downloading' || phase === 'installing';
  const showCard =
    (phase === 'installed') ||
    (!dismissed &&
      (phase === 'available' ||
        phase === 'downloading' ||
        phase === 'installing' ||
        (phase === 'error' && Boolean(update))));

  if (!showCard) return null;

  const title = phase === 'installed'
    ? t('updateReady')
    : phase === 'error'
      ? t('updateCheckFailed')
      : t('updateAvailable');

  const body = phase === 'installed'
    ? t('updateReadyBody')
    : phase === 'error'
      ? error ?? t('updateServerNotReady')
      : t('updateAvailableBody');

  const releaseNotes = phase === 'available' ? cleanReleaseNotes(update?.body) : null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] rounded-lg border border-border bg-panel/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="icon-medallion h-10 w-10 shrink-0">
          {phase === 'installed' ? (
            <CheckCircle2 className="h-5 w-5 text-success-green" />
          ) : phase === 'error' ? (
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
            {!isBusy && phase !== 'installed' && (
              <button
                type="button"
                onClick={dismiss}
                className="rounded p-1 text-muted-text hover:bg-panel-hover hover:text-text-primary"
                title={t('updateLater')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {update && phase !== 'error' && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-border bg-background/70 p-2 text-xs">
              <span className="text-muted-text">{t('currentVersion')}</span>
              <span className="truncate text-end text-text-primary">{update.currentVersion}</span>
              <span className="text-muted-text">{t('latestVersion')}</span>
              <span className="truncate text-end text-primary-blue">{update.version}</span>
            </div>
          )}

          {releaseNotes && (
            <div className="mt-3 rounded-md border border-border bg-background/70 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-text">{t('updateWhatsNew')}</p>
              <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-xs text-text-primary">{releaseNotes}</p>
            </div>
          )}

          {isBusy && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary-blue transition-all" style={{ width: `${Math.round(progress)}%` }} />
              </div>
              <p className="mt-1 text-end text-xs tabular-nums text-muted-text">
                {totalBytes ? `${Math.round(progress)}%` : formatBytes(downloadedBytes)}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {phase === 'error' && (
              <button type="button" onClick={() => checkForUpdates({ manual: true })} className="btn-secondary px-3 py-2 text-xs">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('retry')}
              </button>
            )}

            {phase === 'available' && (
              <button type="button" onClick={installUpdate} className="btn-primary px-3 py-2 text-xs">
                <Download className="h-3.5 w-3.5" />
                {t('downloadUpdate')}
              </button>
            )}

            {phase === 'downloading' && (
              <button type="button" disabled className="btn-primary px-3 py-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('downloadingUpdate')}
              </button>
            )}

            {phase === 'installing' && (
              <button type="button" disabled className="btn-primary px-3 py-2 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('installingUpdate')}
              </button>
            )}

            {phase === 'installed' && (
              <button type="button" onClick={restart} className="btn-primary px-3 py-2 text-xs">
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

const cleanReleaseNotes = (body: string | undefined) => {
  if (!body) return null;
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.length > 600) {
    return `${trimmed.slice(0, 600).trimEnd()}...`;
  }
  return trimmed;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};
