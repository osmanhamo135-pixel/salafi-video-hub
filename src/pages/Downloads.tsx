import React, { useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Cookie,
  Download,
  FileVideo,
  FolderOpen,
  Layers,
  Link,
  Loader2,
  Music,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { CookieMode, DownloadQuality, DownloadStage, isDownloadWorking, useDownloadStore } from '@/store/downloadStore';
import { LocalThumbnail } from '@/components/ui/LocalThumbnail';
import { TranslationKey, useI18n } from '@/i18n';

const qualityOptions = [
  { value: 'fast', labelKey: 'qualityFast' },
  { value: 'best', labelKey: 'bestQuality' },
  { value: '1080', labelKey: 'quality1080' },
  { value: '720', labelKey: 'quality720' },
  { value: '480', labelKey: 'quality480' },
] as const;

const cookieModeOptions: Array<{ value: CookieMode; labelKey: TranslationKey }> = [
  { value: 'none', labelKey: 'accountNone' },
  { value: 'auto', labelKey: 'accountAuto' },
  { value: 'chrome', labelKey: 'accountChrome' },
  { value: 'edge', labelKey: 'accountEdge' },
  { value: 'firefox', labelKey: 'accountFirefox' },
  { value: 'brave', labelKey: 'accountBrave' },
  { value: 'opera', labelKey: 'accountOpera' },
  { value: 'file', labelKey: 'accountCookiesFile' },
];

export const Downloads: React.FC = () => {
  const { t } = useI18n();
  const url = useDownloadStore((state) => state.url);
  const setUrl = useDownloadStore((state) => state.setUrl);
  const outputDir = useDownloadStore((state) => state.outputDir);
  const setOutputDir = useDownloadStore((state) => state.setOutputDir);
  const cookiesPath = useDownloadStore((state) => state.cookiesPath);
  const setCookiesPath = useDownloadStore((state) => state.setCookiesPath);
  const cookieMode = useDownloadStore((state) => state.cookieMode);
  const setCookieMode = useDownloadStore((state) => state.setCookieMode);
  const quality = useDownloadStore((state) => state.quality);
  const setQuality = useDownloadStore((state) => state.setQuality);
  const audioOnly = useDownloadStore((state) => state.audioOnly);
  const setAudioOnly = useDownloadStore((state) => state.setAudioOnly);
  const downloadPlaylist = useDownloadStore((state) => state.downloadPlaylist);
  const setDownloadPlaylist = useDownloadStore((state) => state.setDownloadPlaylist);
  const importAfterDownload = useDownloadStore((state) => state.importAfterDownload);
  const setImportAfterDownload = useDownloadStore((state) => state.setImportAfterDownload);
  const stage = useDownloadStore((state) => state.stage);
  const message = useDownloadStore((state) => state.message);
  const percent = useDownloadStore((state) => state.percent);
  const result = useDownloadStore((state) => state.result);
  const error = useDownloadStore((state) => state.error);
  const startDownload = useDownloadStore((state) => state.startDownload);
  const resetCompleted = useDownloadStore((state) => state.resetCompleted);

  const isWorking = isDownloadWorking(stage);
  const effectiveImport = importAfterDownload && !audioOnly;
  const statusMessage = stage === 'idle'
    ? t('readyForNextDownload')
    : message
      ? localizeProgressMessage(stage, message, t)
      : t('noDownloadYet');

  useEffect(() => {
    if (isLikelyPlaylistUrl(url)) {
      setDownloadPlaylist(true);
    }
  }, [url]);

  const canDownload = useMemo(() => {
    const trimmed = url.trim();
    return !isWorking && (trimmed.startsWith('https://') || trimmed.startsWith('http://'));
  }, [isWorking, url]);

  const handleChooseFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('downloadFolder'),
    });
    if (selected && !Array.isArray(selected)) {
      setOutputDir(selected);
    }
  };

  const handleChooseCookies = async () => {
    const selected = await open({
      multiple: false,
      title: t('cookiesFile'),
      filters: [{ name: 'Cookies', extensions: ['txt'] }],
    });
    if (selected && !Array.isArray(selected)) {
      setCookiesPath(selected);
    }
  };

  const handleStart = async () => {
    if (!canDownload) return;

    await startDownload();
  };

  const handleOpenDownloadFolder = async () => {
    const target = result?.downloadedFiles[0] ?? result?.outputDir;
    if (!target) return;

    try {
      await invoke('open_file_location', { filePath: target });
    } catch {
      await invoke('open_file_externally', { filePath: result?.outputDir ?? target });
    }
  };

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-pill mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('localOnlyIslamicLibrary')}
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('downloadsTitle')}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-text">{t('downloadsSubtitle')}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {['YouTube', 'TikTok', 'Instagram Reels', 'X / Twitter'].map((platform) => (
                <span key={platform} className="rounded-md border border-primary-blue/20 bg-primary-blue/10 px-2.5 py-1 text-primary-blue">
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="premium-surface ornate-corner relative overflow-hidden rounded-lg p-5">
            <div className="gold-thread absolute inset-x-5 top-0" />
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-text">{t('youtubeUrl')}</label>
                <div className="relative">
                  <Link className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder={t('youtubeUrlPlaceholder')}
                    className="surface-input w-full py-2.5 ps-10"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-text">{t('downloadFolder')}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={outputDir}
                    onChange={(event) => setOutputDir(event.target.value)}
                    placeholder={t('defaultDownloadsFolder')}
                    className="surface-input min-w-0 flex-1"
                  />
                  <button type="button" onClick={handleChooseFolder} className="btn-secondary px-3 py-2">
                    <FolderOpen className="h-4 w-4" />
                    {t('chooseFolder')}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-text">{t('accountAccess')}</label>
                <div className="relative">
                  <Cookie className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
                  <select
                    value={cookieMode}
                    onChange={(event) => setCookieMode(event.target.value as CookieMode)}
                    className="surface-input w-full py-2.5 ps-10"
                  >
                    {cookieModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-text">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-accent-gold" />
                  {t('accountAccessHint')}
                </p>

                {cookieMode === 'file' && (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                      <Cookie className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
                      <input
                        type="text"
                        value={cookiesPath}
                        onChange={(event) => setCookiesPath(event.target.value)}
                        placeholder={t('noCookiesSet')}
                        className="surface-input w-full py-2.5 ps-10"
                        dir="ltr"
                      />
                    </div>
                    <button type="button" onClick={handleChooseCookies} className="btn-secondary px-3 py-2">
                      <Cookie className="h-4 w-4" />
                      {t('chooseCookiesFile')}
                    </button>
                    {cookiesPath && (
                      <button type="button" onClick={() => setCookiesPath('')} className="btn-ghost px-3 py-2">
                        {t('clear')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-text">{t('quality')}</label>
                  <select
                    value={quality}
                    onChange={(event) => setQuality(event.target.value as DownloadQuality)}
                    disabled={audioOnly}
                    className="surface-input w-full"
                  >
                    {qualityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <ToggleRow
                    icon={Music}
                    label={t('audioOnly')}
                    checked={audioOnly}
                    onChange={(checked) => {
                      setAudioOnly(checked);
                      if (checked) setImportAfterDownload(false);
                    }}
                  />
                  <ToggleRow
                    icon={Smartphone}
                    label={t('downloadPlaylist')}
                    checked={downloadPlaylist}
                    onChange={setDownloadPlaylist}
                  />
                </div>
              </div>

              <ToggleRow
                icon={Download}
                label={audioOnly ? t('audioOnlyImportNote') : t('importAfterDownload')}
                checked={effectiveImport}
                disabled={audioOnly}
                onChange={setImportAfterDownload}
              />

              <button
                type="button"
                onClick={handleStart}
                disabled={!canDownload}
                className="btn-primary w-full justify-center py-3"
              >
                {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isWorking ? t('downloading') : t('startDownload')}
              </button>
            </div>
          </section>

          <aside className="premium-surface rounded-lg p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="icon-medallion h-10 w-10">
                {stage === 'finished' ? (
                  <CheckCircle2 className="h-5 w-5 text-success-green" />
                ) : stage === 'error' ? (
                  <AlertTriangle className="h-5 w-5 text-warning-orange" />
                ) : (
                  <Download className="h-5 w-5 text-primary-blue" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary">{statusMessage}</p>
                <p className="text-xs text-muted-text">{outputDir || t('defaultDownloadsFolder')}</p>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary-blue transition-all"
                style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
              />
            </div>
            <p className="mt-2 text-end text-xs tabular-nums text-muted-text">{percent}%</p>

            {error && (
              <div className="mt-4 whitespace-pre-wrap rounded-md border border-danger-red/25 bg-danger-red/10 p-3 text-xs text-danger-red">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-5 space-y-3">
                <DownloadBatchCard result={result} />

                <div>
                  <p className="text-xs font-medium text-muted-text">{t('downloadedTo')}</p>
                  <p className="mt-1 break-all text-xs text-text-primary" dir="ltr">{result.outputDir}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <button
                    type="button"
                    onClick={handleOpenDownloadFolder}
                    className="btn-secondary w-full justify-center px-3 py-2 text-xs"
                  >
                    <FolderOpen className="h-4 w-4" />
                    {t('openDownloadFolder')}
                  </button>
                  <button
                    type="button"
                    onClick={resetCompleted}
                    className="btn-ghost w-full justify-center border border-border px-3 py-2 text-xs"
                  >
                    <X className="h-4 w-4" />
                    {t('clearNow')}
                  </button>
                </div>

                {result.importResult && (
                  <div className="rounded-md border border-success-green/25 bg-success-green/10 p-3 text-xs text-success-green">
                    {t('importFolder')}: {result.importResult.imported_count} / {t('skipped')}: {result.importResult.skipped_count} / {t('failed')}: {result.importResult.failed_count}
                  </div>
                )}

                {stage === 'finished' && (
                  <p className="text-center text-[11px] text-muted-text">{t('clearsAutomatically')}</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

const DownloadBatchCard: React.FC<{
  result: {
    outputDir: string;
    downloadedFiles: string[];
    previewThumbnailPath: string | null;
  };
}> = ({ result }) => {
  const { t } = useI18n();
  const primaryFile = result.downloadedFiles[0] ?? result.outputDir;
  const primaryName = getFileName(primaryFile);
  const parentName = getParentName(primaryFile) || getParentName(result.outputDir);
  const remaining = Math.max(result.downloadedFiles.length - 1, 0);

  return (
    <div className="download-batch-card overflow-hidden rounded-lg border border-accent-gold/25 bg-background/55">
      <div className="relative aspect-video bg-elevated-panel">
        <LocalThumbnail
          path={result.previewThumbnailPath}
          label={primaryName}
          className="h-full w-full object-cover"
          iconClassName="h-8 w-8 text-accent-gold/80"
          fallbackClassName="thumbnail-fallback"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="media-badge absolute bottom-3 left-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          {result.downloadedFiles.length} {t('filesSaved')}
        </div>
      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-text">
          <FileVideo className="h-4 w-4 text-primary-blue" />
          <span>{t('savedMediaBatch')}</span>
        </div>
        <p className="truncate text-sm font-semibold text-text-primary" title={primaryName}>
          {primaryName}
        </p>
        <p className="mt-1 truncate text-xs text-muted-text" title={parentName}>
          {t('primaryDownload')} / {parentName}
        </p>
        {remaining > 0 && (
          <p className="mt-2 text-xs text-accent-gold">
            +{remaining} {t('moreFiles')}
          </p>
        )}
      </div>
    </div>
  );
};

const getFileName = (path: string) => {
  const clean = path.replace(/[\\/]+$/, '');
  return clean.split(/[\\/]/).filter(Boolean).pop() ?? clean;
};

const getParentName = (path: string) => {
  const clean = path.replace(/[\\/]+$/, '');
  const parts = clean.split(/[\\/]/).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : parts[0] ?? '';
};

const ToggleRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}> = ({ icon: Icon, label, checked, disabled, onChange }) => (
  <label className={`flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-sm ${disabled ? 'opacity-55' : ''}`}>
    <span className="flex min-w-0 items-center gap-2 text-text-primary">
      <Icon className="h-4 w-4 shrink-0 text-primary-blue" />
      <span className="truncate">{label}</span>
    </span>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-primary-blue"
    />
  </label>
);

const isLikelyPlaylistUrl = (value: string) => {
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      (host.includes('youtube.com') && (path.includes('/playlist') || parsed.searchParams.has('list'))) ||
      (host.includes('instagram.com') && !path.includes('/reel/') && !path.includes('/p/')) ||
      (host.includes('tiktok.com') && path.includes('/@') && !path.includes('/video/')) ||
      ((host.includes('twitter.com') || host.includes('x.com')) && !path.includes('/status/'))
    );
  } catch {
    const lower = value.toLowerCase();
    return lower.includes('youtube.com/playlist') ||
      lower.includes('?list=') ||
      lower.includes('&list=') ||
      (lower.includes('instagram.com/') && !lower.includes('/reel/') && !lower.includes('/p/')) ||
      (lower.includes('tiktok.com/@') && !lower.includes('/video/')) ||
      ((lower.includes('twitter.com/') || lower.includes('x.com/')) && !lower.includes('/status/'));
  }
};

const localizeProgressMessage = (
  stage: DownloadStage,
  message: string,
  t: ReturnType<typeof useI18n>['t'],
) => {
  if (stage === 'preparing') return t('preparingDownloader');
  if (stage === 'installing') return t('installingDownloader');
  if (stage === 'finished') return t('downloadFinished');
  if (stage === 'error') return t('downloadFailed');
  return message;
};
