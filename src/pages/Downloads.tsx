import React, { useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Cookie,
  Download,
  FileVideo,
  FolderOpen,
  FolderSearch,
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
import { Select } from '@/components/ui/Select';

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

  // Pre-check the box for a collection URL, but only once per distinct URL, so
  // unchecking it sticks instead of being forced back on by the next render.
  const autoPlaylistUrlRef = useRef<string | null>(null);
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || autoPlaylistUrlRef.current === trimmed) return;
    autoPlaylistUrlRef.current = trimmed;
    if (isLikelyPlaylistUrl(trimmed)) {
      setDownloadPlaylist(true);
    }
  }, [url, setDownloadPlaylist]);

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
        <div className="mb-6">
          <div className="premium-pill mb-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('localOnlyIslamicLibrary')}
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('downloadsTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-text">{t('downloadsSubtitle')}</p>
          {/* The supported platforms are a caption, not four badges: they are
              information about the field below, and never a call to action. */}
          <p className="mt-2 text-xs text-muted-text">
            {/* <bdi>, not dir="ltr": the list renders left-to-right but still
                sits at the start of the line on the Arabic layout. */}
            <bdi>YouTube · TikTok · Instagram Reels · X / Twitter</bdi>
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="reveal">
            <div className="space-y-1">
              <Field label={t('youtubeUrl')} icon={Link}>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={t('youtubeUrlPlaceholder')}
                  className="field-quiet ps-6 text-sm"
                  dir="auto"
                />
              </Field>

              <Field label={t('downloadFolder')} icon={FolderOpen} action={
                <button type="button" onClick={handleChooseFolder} className="icon-btn shrink-0" title={t('chooseFolder')} aria-label={t('chooseFolder')}>
                  <FolderSearch className="h-4 w-4" />
                </button>
              }>
                <input
                  type="text"
                  value={outputDir}
                  onChange={(event) => setOutputDir(event.target.value)}
                  placeholder={t('defaultDownloadsFolder')}
                  className="field-quiet ps-6 text-sm"
                  dir="auto"
                />
              </Field>

              <Field label={t('accountAccess')} icon={Cookie} hint={t('accountAccessHint')}>
                <Select
                  label={t('downloadCookies')}
                  value={cookieMode}
                  onChange={(v: string) => setCookieMode(v as CookieMode)}
                  options={cookieModeOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                />
              </Field>

              {cookieMode === 'file' && (
                <Field label={t('cookiesFile')} icon={Cookie} action={
                  <>
                    <button type="button" onClick={handleChooseCookies} className="icon-btn shrink-0" title={t('chooseCookiesFile')} aria-label={t('chooseCookiesFile')}>
                      <FolderSearch className="h-4 w-4" />
                    </button>
                    {cookiesPath && (
                      <button type="button" onClick={() => setCookiesPath('')} className="icon-btn shrink-0" title={t('clear')} aria-label={t('clear')}>
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </>
                }>
                  <input
                    type="text"
                    value={cookiesPath}
                    onChange={(event) => setCookiesPath(event.target.value)}
                    placeholder={t('noCookiesSet')}
                    className="field-quiet ps-6 text-sm"
                    dir="auto"
                  />
                </Field>
              )}

              <Field label={t('quality')} icon={FileVideo}>
                <Select
                  label={t('quality')}
                  value={quality}
                  onChange={(v: string) => setQuality(v as DownloadQuality)}
                  disabled={audioOnly}
                  options={qualityOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                />
              </Field>
            </div>

            <div className="rule-list mt-5">
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
              <ToggleRow
                icon={Download}
                label={audioOnly ? t('audioOnlyImportNote') : t('importAfterDownload')}
                checked={effectiveImport}
                disabled={audioOnly}
                onChange={setImportAfterDownload}
              />
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={!canDownload}
              className="btn-primary mt-6 w-full justify-center py-3"
            >
              {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isWorking ? t('downloading') : t('startDownload')}
            </button>
          </section>

          <aside className="border-border xl:border-s xl:ps-6">
            <div className="rule-head">
              <span className="text-xs font-semibold text-text-primary">{t('progress')}</span>
              <span className="text-[11px] tabular-nums text-muted-text"><bdi>{percent}%</bdi></span>
            </div>

            <div className="mt-3 flex items-start gap-2.5">
              {stage === 'finished' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-text" />
              ) : stage === 'error' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-orange" />
              ) : (
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-muted-text" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-text-primary" dir="auto">{statusMessage}</p>
                <p className="truncate text-xs text-muted-text" dir="auto" title={outputDir}>
                  {outputDir || t('defaultDownloadsFolder')}
                </p>
              </div>
            </div>

            {/* One warm accent, drawn from the theme token, over a value step of
                the same hue — no second colour and no shadow. */}
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-accent-gold/15">
              <div
                className="h-full rounded-full bg-accent-gold transition-all motion-reduce:transition-none"
                style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
              />
            </div>

            {error && (
              <p className="mt-4 whitespace-pre-wrap text-xs text-danger-red" dir="auto">{error}</p>
            )}

            {result && (
              <div className="mt-5 space-y-4">
                <DownloadBatchCard result={result} />

                <div>
                  <p className="text-xs text-muted-text">{t('downloadedTo')}</p>
                  <p className="mt-1 break-all text-xs text-text-primary" dir="auto">{result.outputDir}</p>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <button
                    type="button"
                    onClick={handleOpenDownloadFolder}
                    className="inline-flex items-center gap-1.5 py-1 text-xs font-medium text-muted-text transition-colors hover:text-text-primary motion-reduce:transition-none"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {t('openDownloadFolder')}
                  </button>
                  <button
                    type="button"
                    onClick={resetCompleted}
                    className="inline-flex items-center gap-1.5 py-1 text-xs font-medium text-muted-text transition-colors hover:text-text-primary motion-reduce:transition-none"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('clearNow')}
                  </button>
                </div>

                {result.importResult && (
                  <p className="text-xs text-muted-text">
                    <bdi>{t('importFolder')}: {result.importResult.imported_count}</bdi>
                    {' · '}
                    <bdi>{t('skipped')}: {result.importResult.skipped_count}</bdi>
                    {' · '}
                    <bdi>{t('failed')}: {result.importResult.failed_count}</bdi>
                  </p>
                )}

                {stage === 'finished' && (
                  <p className="text-[11px] text-muted-text">{t('clearsAutomatically')}</p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

/** A labelled control sitting on a baseline rule — never a boxed input. */
const Field: React.FC<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, icon: Icon, hint, action, children }) => (
  <div className="py-1.5">
    <label className="mb-0.5 block text-xs font-medium text-muted-text">{label}</label>
    <div className="flex items-center gap-1">
      <div className="relative min-w-0 flex-1">
        <Icon className="pointer-events-none absolute start-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-text" />
        {children}
      </div>
      {action}
    </div>
    {hint && <p className="mt-1 text-[11px] text-muted-text">{hint}</p>}
  </div>
);

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
    <div className="reveal glass overflow-hidden rounded-lg">
      <div className="relative aspect-video bg-elevated-panel">
        <LocalThumbnail
          path={result.previewThumbnailPath}
          label={primaryName}
          className="h-full w-full object-cover"
          iconClassName="h-8 w-8 text-muted-text"
          fallbackClassName="thumbnail-fallback"
        />
        {/* A scrim over a thumbnail is theme-independent by nature: it darkens
            whatever image is underneath so the badge stays readable. */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="media-badge absolute bottom-3 start-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          <bdi>{result.downloadedFiles.length} {t('filesSaved')}</bdi>
        </div>
      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-text">
          <FileVideo className="h-4 w-4" />
          <span>{t('savedMediaBatch')}</span>
        </div>
        <p className="truncate text-sm font-medium text-text-primary" title={primaryName} dir="auto">
          {primaryName}
        </p>
        <p className="mt-1 truncate text-xs text-muted-text" title={parentName} dir="auto">
          {t('primaryDownload')} / {parentName}
        </p>
        {remaining > 0 && (
          <p className="mt-2 text-xs text-muted-text">
            <bdi>+{remaining} {t('moreFiles')}</bdi>
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
  <div className={`rule-row justify-between text-sm ${disabled ? 'opacity-55' : ''}`}>
    <span className="flex min-w-0 items-center gap-2.5 text-text-primary" id={`dl-${label}`}>
      <Icon className="h-4 w-4 shrink-0 text-muted-text" />
      <span className="truncate" dir="auto">{label}</span>
    </span>
    {/* The same switch the rest of the app uses. A native checkbox painted its
        unchecked box in the platform's white, which is a hardcoded colour that
        ignores the theme entirely. */}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`dl-${label}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 motion-reduce:transition-none ${
        checked
          ? 'border-accent-gold/40 bg-accent-gold/20'
          : 'border-border-strong/60 bg-border-strong/30'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`pointer-events-none absolute start-[3px] top-[3px] inline-block h-3 w-3 rounded-full transition-transform duration-150 motion-reduce:transition-none ${
          checked ? 'translate-x-4 bg-accent-gold rtl:-translate-x-4' : 'translate-x-0 bg-muted-text'
        }`}
      />
    </button>
  </div>
);

// Mirrors `looks_like_collection_url` in the Rust downloader. A `list=` beside a
// `v=` is a single video copied from a playlist page, not a collection — only a
// bare `list=` counts, so an ordinary watch link never pre-checks the box.
const isLikelyPlaylistUrl = (value: string) => {
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      (host.includes('youtube.com') &&
        (path.includes('/playlist') ||
          (parsed.searchParams.has('list') && !parsed.searchParams.has('v')))) ||
      (host.includes('instagram.com') && !path.includes('/reel/') && !path.includes('/p/')) ||
      (host.includes('tiktok.com') && path.includes('/@') && !path.includes('/video/')) ||
      ((host.includes('twitter.com') || host.includes('x.com')) && !path.includes('/status/'))
    );
  } catch {
    const lower = value.toLowerCase();
    const hasVideoId = lower.includes('?v=') || lower.includes('&v=');
    return lower.includes('youtube.com/playlist') ||
      ((lower.includes('?list=') || lower.includes('&list=')) && !hasVideoId) ||
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
