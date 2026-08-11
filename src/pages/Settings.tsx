import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  Scissors,
  Trash2,
  Upload,
  Volume2,
  XCircle,
  Image,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUpdateStore } from '@/store/updateStore';
import { formatBytes } from '@/utils/formatBytes';
import { playReminderSound, stopReminderSound } from '@/utils/reminderAudio';
import { AppLanguage, AppTheme } from '@/types';
import { languageOptions, themeOptions, useI18n } from '@/i18n';
import { MOTION_KEY } from '@/components/layout/AmbientLayer';
import { ThemePreview } from '@/components/ui/ThemePreview';
import { Select } from '@/components/ui/Select';
import { checkFace, checkHarakat, mushafFamily } from '@/utils/mushafFont';
import type { FaceState, HarakatState } from '@/utils/mushafFont';

interface ThumbnailBatchResult {
  generated_count: number;
  skipped_count: number;
  failed_count: number;
  errors: string[];
}

interface DiagnosticsReport {
  appVersion: string;
  appDataPath: string;
  dbSizeBytes: number;
  videoCount: number;
  playlistCount: number;
  ffmpegStatus: string;
  ffmpegVersion: string | null;
  ffmpegPath: string | null;
  ytdlpVersion: string | null;
  internetOk: boolean;
  updateEndpointOk: boolean;
}

const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 motion-reduce:transition-none ${
      checked
        ? 'border-accent-gold/40 bg-accent-gold/20'
        : 'border-border-strong/60 bg-border-strong/30'
    } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
  >
    {/* Logical inset + an RTL-flipped travel: with `left`/`translate-x` alone
        the knob slid the wrong way on the Arabic layout.
        bg-background, not bg-white: on the light themes a white knob on a
        light track is invisible. */}
    <span
      className={`pointer-events-none absolute start-[3px] top-[3px] inline-block h-3 w-3 rounded-full transition-transform duration-150 motion-reduce:transition-none ${
        checked ? 'translate-x-4 bg-accent-gold rtl:-translate-x-4' : 'translate-x-0 bg-muted-text'
      }`}
    />
  </button>
);

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'The action failed.';
};

export const Settings: React.FC = () => {
  const settings = useSettingsStore((state) => state.settings);
  const settingsLoading = useSettingsStore((state) => state.settingsLoading);
  const settingsError = useSettingsStore((state) => state.settingsError);
  const ffmpegStatus = useSettingsStore((state) => state.ffmpegStatus);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const removeImportedFolder = useSettingsStore((state) => state.removeImportedFolder);
  const detectFfmpeg = useSettingsStore((state) => state.detectFfmpeg);
  const exportBackup = useSettingsStore((state) => state.exportBackup);
  const importBackup = useSettingsStore((state) => state.importBackup);
  const refreshPlaylists = useAppStore((state) => state.refreshPlaylists);
  const thumbnailJobsRunning = useAppStore((state) => state.thumbnailJobsRunning);
  const thumbnailQueueLength = useAppStore((state) => state.thumbnailQueueLength);
  const thumbnailProcessedCount = useAppStore((state) => state.thumbnailProcessedCount);
  const thumbnailGeneratedCount = useAppStore((state) => state.thumbnailGeneratedCount);
  const thumbnailFailedCount = useAppStore((state) => state.thumbnailFailedCount);
  const thumbnailSkippedCount = useAppStore((state) => state.thumbnailSkippedCount);
  const updatePhase = useUpdateStore((state) => state.phase);
  const updateError = useUpdateStore((state) => state.error);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const { t } = useI18n();

  /* Presentation-only, so it lives in localStorage rather than the settings
     row — no schema migration, no command, no round trip. Writing it reloads
     so AmbientLayer re-resolves its tier from a single source. */
  const [backgroundMotion, setBackgroundMotionState] = useState<'off' | 'subtle' | 'full'>(() => {
    try {
      const v = localStorage.getItem(MOTION_KEY);
      return v === 'off' || v === 'full' ? v : 'subtle';
    } catch {
      return 'subtle';
    }
  });
  const setBackgroundMotion = (value: 'off' | 'subtle' | 'full') => {
    try {
      localStorage.setItem(MOTION_KEY, value);
    } catch {
      /* private mode — the preference just does not persist */
    }
    setBackgroundMotionState(value);
    window.location.reload();
  };

  const [appVersion, setAppVersion] = useState('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  /* Whether the two bundled mushaf faces actually loaded in THIS engine.
     The mushaf chain names no fallback family on purpose, so a face that
     fails to load is the difference between a correct page and one set in
     the browser's last resort — thin, wrongly shaped, ayah number outside
     its medallion. That failure is invisible from here otherwise, and it
     cannot be reproduced on every machine, so the app reports it. */
  /* Kept as the three states rather than as the rendered sentence: the row's
     green/red flag is derived from them. Sniffing a prefix off the sentence
     once reported OK in green while the rest of it said HARAKAT NOT PLACED. */
  const [mushafFonts, setMushafFonts] = useState<{
    hafs: FaceState;
    warsh: FaceState;
    marks: HarakatState;
  } | null>(null);
  const [mushafFontsError, setMushafFontsError] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true);
    try {
      setDiagnostics(await invoke<DiagnosticsReport>('get_diagnostics'));
      try {
        const [hafs, warsh] = await Promise.all([
          checkFace(mushafFamily(false)),
          checkFace(mushafFamily(true)),
        ]);
        /* Loading the face is only half of it: an engine can load the face,
           shape the ayah correctly and still paint every above-the-letter
           harakah down at the baseline (WebKitGTK 2.46+). Report that too —
           it is the difference between a mushaf and bare consonants. */
        const marks = await checkHarakat(mushafFamily(false));
        setMushafFonts({ hafs, warsh, marks });
        setMushafFontsError(false);
      } catch {
        setMushafFonts(null);
        setMushafFontsError(true);
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const faceLabel = (state: FaceState) =>
    state === 'loaded' ? 'OK' : state === 'failed' ? 'FAILED' : '?';
  const mushafFontsValue = mushafFonts
    ? `Hafs ${faceLabel(mushafFonts.hafs)} / Warsh ${faceLabel(mushafFonts.warsh)} / ${
        mushafFonts.marks === 'ok'
          ? 'harakat OK'
          : mushafFonts.marks === 'broken'
            ? 'HARAKAT NOT PLACED'
            : 'harakat ?'
      }`
    : mushafFontsError
      ? 'unavailable'
      : '';
  const mushafFontsOk = Boolean(
    mushafFonts &&
      mushafFonts.hafs === 'loaded' &&
      mushafFonts.warsh === 'loaded' &&
      mushafFonts.marks === 'ok',
  );

  const [rescanning, setRescanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [removingOrphans, setRemovingOrphans] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [installingFfmpeg, setInstallingFfmpeg] = useState(false);
  const [regeneratingThumbs, setRegeneratingThumbs] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openingFolder, setOpeningFolder] = useState(false);
  const [testingSound, setTestingSound] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Each toast owns the dismissal. Without cancelling the previous timer the
  // first one's 3s deadline dismissed the second toast early.
  const toastTimerRef = useRef(0);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    loadSettings();
    detectFfmpeg();
    getVersion().then(setAppVersion).catch(() => setAppVersion(''));
  }, [detectFfmpeg, loadSettings]);

  const updateStatusText = (() => {
    switch (updatePhase) {
      case 'checking':
        return t('checkingForUpdates');
      case 'available':
      case 'downloading':
      case 'installing':
        return t('updateAvailable');
      case 'installed':
        return t('updateReady');
      case 'upToDate':
        return t('upToDate');
      case 'error':
        return updateError ?? t('updateCheckFailed');
      default:
        return '';
    }
  })();

  const handleRemoveFolder = async (path: string) => {
    if (!confirm(`${t('removeFolderConfirm')}\n\n${path}`)) return;
    try {
      await removeImportedFolder(path);
      await refreshPlaylists();
      showToast(t('done'));
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRescanAll = async () => {
    setRescanning(true);
    try {
      await invoke('rescan_all');
      await refreshPlaylists();
      showToast(`${t('rescanAll')}: ${t('done')}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRescanning(false);
    }
  };

  const handleRepairDatabase = async () => {
    if (!confirm(t('repairDatabaseConfirm'))) return;
    setRepairing(true);
    try {
      await invoke('repair_database');
      showToast(`${t('repairDatabase')}: ${t('ok')}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRepairing(false);
    }
  };

  const handleRemoveOrphans = async () => {
    if (!confirm(t('removeOrphansConfirm'))) return;
    setRemovingOrphans(true);
    try {
      const removed = await invoke<number>('remove_orphaned_entries');
      await refreshPlaylists();
      showToast(`${t('removeOrphanedEntries')}: ${removed}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRemovingOrphans(false);
    }
  };

  const handleClearThumbnailCache = async () => {
    if (!confirm(t('clearThumbnailCacheConfirm'))) return;
    setClearingCache(true);
    try {
      await invoke('clear_thumbnail_cache');
      await refreshPlaylists();
      showToast(`${t('clearThumbnailCache')}: ${t('done')}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setClearingCache(false);
    }
  };

  const handleInstallFfmpeg = async () => {
    setInstallingFfmpeg(true);
    try {
      await invoke('install_ffmpeg_helper');
      await detectFfmpeg();
      showToast(t('ffmpegInstalled'));
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setInstallingFfmpeg(false);
    }
  };

  const handleRegenerateMissingThumbnails = async () => {
    setRegeneratingThumbs(true);
    try {
      if (ffmpegStatus?.status === 'missing') {
        await invoke('install_ffmpeg_helper');
        await detectFfmpeg();
      }
      const result = await invoke<ThumbnailBatchResult>('regenerate_missing_thumbnails');
      await refreshPlaylists();
      showToast(
        `${result.generated_count} ${t('ready')} · ${result.skipped_count} ${t('skipped')} · ${result.failed_count} ${t('failed')}`,
        result.failed_count > 0 ? 'error' : 'success',
      );
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRegeneratingThumbs(false);
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const path = await exportBackup();
      showToast(`${t('exportBackup')}: ${path}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImportBackup = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      });
      if (!selected || Array.isArray(selected)) return;

      setImporting(true);
      await importBackup(selected);
      await loadSettings();
      await refreshPlaylists();
      showToast(`${t('importBackup')}: ${t('done')}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleOpenAppDataFolder = async () => {
    setOpeningFolder(true);
    try {
      await invoke('open_app_data_folder');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setOpeningFolder(false);
    }
  };

  const handleTestSound = async () => {
    const currentSettings = useSettingsStore.getState().settings;
    if (!currentSettings) return;

    setTestingSound(true);
    try {
      await playReminderSound({
        soundPath: currentSettings.reminderSoundPath,
        volume: currentSettings.reminderVolume,
      });
      showToast(t('playing'));
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      window.setTimeout(() => {
        stopReminderSound();
        setTestingSound(false);
      }, 1500);
    }
  };

  const handlePickReminderSound = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] },
        ],
      });
      if (!selected || Array.isArray(selected)) return;
      await updateSettings({ reminderSoundPath: selected });
      showToast(`${t('defaultReminderSound')}: ${t('done')}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  if (settingsLoading && !settings) {
    return (
      <div className="page-container">
        <div className="content-max-width flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-muted-text" />
          <p className="text-sm text-muted-text">{t('loadingSettings')}</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page-container">
        <div className="content-max-width flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="mb-3 h-8 w-8 text-muted-text" />
          <h1 className="text-lg font-semibold text-text-primary">{t('settingsTitle')}</h1>
          <p className="mt-2 text-sm text-muted-text">
            {settingsError ?? 'Settings could not be loaded.'}
          </p>
          <button type="button" onClick={() => loadSettings()} className="btn-primary mt-5 px-4 py-2">
            <RefreshCw className="h-4 w-4" />
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  // The status of a helper binary is information, not decoration: only the
  // state that actually needs the user's attention carries a colour.
  const ffmpegBadge = (() => {
    if (!ffmpegStatus) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-text">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('checking')}
        </span>
      );
    }
    if (ffmpegStatus.status === 'missing') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-red">
          <XCircle className="h-3.5 w-3.5" />
          {t('missing')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-text">
        <CheckCircle className="h-3.5 w-3.5" />
        <bdi>{ffmpegStatus.status}{ffmpegStatus.version ? ` ${ffmpegStatus.version}` : ''}</bdi>
      </span>
    );
  })();

  const thumbnailTotal = Math.max(thumbnailQueueLength, thumbnailProcessedCount);

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('settingsTitle')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-text">{t('settingsSubtitle')}</p>
        </div>

        {toast && (
          <div
            className={`mb-4 flex items-center gap-2 border-b py-2.5 text-sm ${
              toast.type === 'success'
                ? 'border-border text-text-primary'
                : 'border-danger-red/30 text-danger-red'
            }`}
          >
            {toast.type === 'success'
              ? <CheckCircle className="h-4 w-4 shrink-0 text-muted-text" />
              : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span className="min-w-0 break-all" dir="auto">{toast.message}</span>
          </div>
        )}

        {settingsError && (
          <div className="mb-4 flex items-center gap-2 border-b border-warning-orange/30 py-2.5 text-sm text-warning-orange">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span dir="auto">{settingsError}</span>
          </div>
        )}

        {/* Eight sections behind 2600px of scroll needed a map. A quiet
            side rail: sticky, scrollspy-free (anchors are enough — a spy
            would need scroll listeners for a page visited twice a month),
            hidden below xl where the page is narrow enough to scan. */}
        <div className="xl:grid xl:grid-cols-[11rem_minmax(0,1fr)] xl:gap-10">
          <nav aria-label={t('settingsTitle')} className="mb-6 hidden xl:block">
            <ul className="sticky top-6 space-y-0.5 text-[13px]">
              {(
                [
                  ['experience', 'experience'],
                  ['library', 'library'],
                  ['thumbnails', 'thumbnails'],
                  ['performance', 'performance'],
                  ['reminderDefaults', 'reminder-defaults'],
                  ['data', 'data'],
                  ['updates', 'updates'],
                  ['diagnostics', 'diagnostics'],
                ] as const
              ).map(([key, anchor]) => (
                <li key={anchor}>
                  <a
                    href={`#settings-${anchor}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById(`settings-${anchor}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="block rounded-[4px] px-3 py-1.5 text-muted-text transition-colors hover:bg-panel-hover hover:text-text-primary"
                  >
                    {t(key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
        <Section id="settings-experience" title={t('experience')}>
          <SettingRow label={t('language')} description={t('languageDescription')}>
            <div className="segmented" role="group" aria-label={t('language')}>
              {languageOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={settings.language === option.id}
                  onClick={() => updateSettings({ language: option.id as AppLanguage })}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </SettingRow>

          {/* The Arabic specimen: a typographic preview of the second language,
              not a callout — a ruled line, no framed strip. */}
          <SettingRow label={t('arabic')}>
            <p className="arabic-text truncate text-xl text-text-soft">{t('arabicPreview')}</p>
          </SettingRow>

          <div className="mt-6">
            <div className="rule-head">
              <h3 className="text-sm text-text-primary">{t('appTheme')}</h3>
              <span className="text-[11px] text-muted-text">{t('appThemeDescription')}</span>
            </div>
            {/* A gallery of real miniatures rather than three 12px swatches.
                You cannot choose a theme you cannot see — and now that the ten
                themes are genuinely ten different rooms, a colour chip is not
                enough information to choose between them. Each preview draws
                from its own theme's tokens, so it cannot disagree with what
                the theme actually looks like. */}
            <div className="theme-gallery" role="radiogroup" aria-label={t('appTheme')}>
              {themeOptions.map((theme) => {
                const active = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => updateSettings({ theme: theme.id as AppTheme })}
                    className="theme-tile"
                  >
                    <ThemePreview theme={theme.id} />
                    <span className="flex min-w-0 items-center gap-1.5 px-1">
                      <span
                        className={`min-w-0 flex-1 truncate text-[13px] ${
                          active ? 'text-text-primary' : 'text-text-soft'
                        }`}
                      >
                        {t(theme.labelKey)}
                      </span>
                      {active && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-accent-gold" aria-label={t('applied')} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section id="settings-library" title={t('library')}>
          <div className="rule-head">
            <h3 className="text-sm text-text-primary">{t('importedFolders')}</h3>
            <span className="text-[11px] tabular-nums text-muted-text">
              <bdi>{settings.importedFolders.length}</bdi>
            </span>
          </div>
          {settings.importedFolders.length === 0 ? (
            <p className="py-4 text-sm text-muted-text">{t('noFoldersImported')}</p>
          ) : (
            <div className="rule-list">
              {settings.importedFolders.map((path) => (
                <div key={path} className="rule-row group">
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-text" />
                  {/* <bdi>, not dir="auto" on the flex item: an LTR path must
                      render left-to-right but still start where the row starts. */}
                  <span className="min-w-0 flex-1 truncate text-sm text-text-primary" title={path}>
                    <bdi>{path}</bdi>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFolder(path)}
                    aria-label={t('remove')}
                    title={t('remove')}
                    className="icon-btn shrink-0 opacity-0 hover:text-danger-red group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <ActionBar>
            <ActionButton icon={RefreshCw} loading={rescanning} label={t('rescanAll')} loadingLabel={t('rescanning')} onClick={handleRescanAll} />
            <ActionButton icon={Database} loading={repairing} label={t('repairDatabase')} loadingLabel={t('repairing')} onClick={handleRepairDatabase} />
            <ActionButton danger icon={Scissors} loading={removingOrphans} label={t('removeOrphanedEntries')} loadingLabel={t('removing')} onClick={handleRemoveOrphans} />
          </ActionBar>
        </Section>

        <Section id="settings-thumbnails" title={t('thumbnails')}>
          <SettingRow label={t('ffmpegStatus')}>
            <div className="flex items-center gap-1">
              {ffmpegBadge}
              <button
                type="button"
                onClick={() => detectFfmpeg()}
                className="icon-btn"
                aria-label={t('ffmpegStatus')}
                title={t('ffmpegStatus')}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </SettingRow>
          {ffmpegStatus?.status === 'missing' && (
            <p className="py-2 text-xs text-warning-orange">{t('ffmpegInstallHelp')}</p>
          )}
          <TextSetting
            label={t('ffmpegPath')}
            placeholder={t('automatic')}
            value={settings.ffmpegPath ?? ffmpegStatus?.path ?? ''}
            onChange={(value) => updateSettings({ ffmpegPath: value || null })}
          />
          <TextSetting
            label={t('ffprobePath')}
            placeholder={t('automatic')}
            value={settings.ffprobePath ?? ffmpegStatus?.ffprobePath ?? ''}
            onChange={(value) => updateSettings({ ffprobePath: value || null })}
          />
          <SettingRow label={t('thumbnailCache')}>
            <input
              type="text"
              readOnly
              dir="auto"
              value={settings.thumbnailCachePath ?? t('defaultAppCache')}
              className="field-quiet max-w-md border-b-transparent text-end text-sm text-muted-text"
            />
          </SettingRow>
          <SettingRow label={t('thumbnailMode')} description={t('thumbnailHelp')}>
            <Select
              label={t('thumbnailMode')}
              value={settings.automaticThumbnailsMode}
              onChange={(v) => updateSettings({
                automaticThumbnailsMode: v as typeof settings.automaticThumbnailsMode,
              })}
              options={[
                { value: 'automatic', label: t('automatic') },
                { value: 'visible-only', label: t('visibleOnly') },
                { value: 'idle-only', label: t('idleOnly') },
                { value: 'disabled', label: t('disabled') },
              ]}
            />
          </SettingRow>
          <ActionBar>
            {ffmpegStatus?.status === 'missing' && (
              <ActionButton icon={Download} loading={installingFfmpeg} label={t('installFfmpeg')} loadingLabel={t('installingFfmpeg')} onClick={handleInstallFfmpeg} />
            )}
            <ActionButton danger icon={Trash2} loading={clearingCache} label={t('clearThumbnailCache')} loadingLabel={t('clearing')} onClick={handleClearThumbnailCache} />
            <ActionButton icon={Image} loading={regeneratingThumbs} label={t('regenerateMissingThumbnails')} loadingLabel={t('generating')} onClick={handleRegenerateMissingThumbnails} />
          </ActionBar>
          {(thumbnailJobsRunning || regeneratingThumbs) && (
            <p className="mt-2 text-xs text-muted-text">
              {t('generating')} <bdi>{Math.min(thumbnailProcessedCount, thumbnailTotal)} / {thumbnailTotal}</bdi>
              {thumbnailGeneratedCount > 0 && <> · <bdi>{thumbnailGeneratedCount} {t('ready')}</bdi></>}
              {thumbnailFailedCount > 0 && <> · <bdi>{thumbnailFailedCount} {t('failed')}</bdi></>}
              {thumbnailSkippedCount > 0 && <> · <bdi>{thumbnailSkippedCount} {t('skipped')}</bdi></>}
            </p>
          )}
        </Section>

        <Section id="settings-performance" title={t('performance')}>
          <SettingRow label={t('performanceMode')} description={t('performanceModeDescription')}>
            <Toggle checked={settings.performanceMode} onChange={(checked) => updateSettings({ performanceMode: checked })} />
          </SettingRow>
          <SettingRow label={t('backgroundMotion')} description={t('backgroundMotionDescription')}>
            <div className="segmented">
              {(['off', 'subtle', 'full'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={backgroundMotion === option}
                  onClick={() => setBackgroundMotion(option)}
                >
                  {t(
                    option === 'off'
                      ? 'backgroundMotionOff'
                      : option === 'subtle'
                        ? 'backgroundMotionSubtle'
                        : 'backgroundMotionFull',
                  )}
                </button>
              ))}
            </div>
          </SettingRow>
        </Section>

        <Section id="settings-reminder-defaults" title={t('reminderDefaults')}>
          <SettingRow label={t('defaultReminderSound')} flush>
            <div className="flex w-full max-w-2xl items-center gap-2">
              <DraftInput
                value={settings.reminderSoundPath ?? ''}
                onCommit={(next) => updateSettings({ reminderSoundPath: next || null })}
                placeholder={t('noSoundSet')}
                className="field-quiet min-w-0 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={handlePickReminderSound}
                className="icon-btn shrink-0"
                aria-label={t('browse')}
                title={t('browse')}
              >
                <FolderOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ reminderSoundPath: null })}
                className="icon-btn shrink-0"
                aria-label={t('clear')}
                title={t('clear')}
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </SettingRow>
          <SettingRow label={t('reminderVolume')}>
            <VolumeSlider value={settings.reminderVolume} onCommit={(next) => updateSettings({ reminderVolume: next })} />
          </SettingRow>
          <ActionBar>
            <ActionButton icon={Volume2} loading={testingSound} label={t('testSound')} loadingLabel={t('testing')} onClick={handleTestSound} />
          </ActionBar>
        </Section>

        <Section id="settings-data" title={t('data')}>
          <ActionBar>
            <ActionButton icon={Download} loading={exporting} label={t('exportBackup')} loadingLabel={t('exporting')} onClick={handleExportBackup} />
            <ActionButton icon={Upload} loading={importing} label={t('importBackup')} loadingLabel={t('importing')} onClick={handleImportBackup} />
            <ActionButton icon={ExternalLink} loading={openingFolder} label={t('openAppDataFolder')} loadingLabel={t('opening')} onClick={handleOpenAppDataFolder} />
          </ActionBar>
        </Section>

        <Section id="settings-updates" title={t('updates')}>
          <SettingRow label={t('appVersion')}>
            <span className="text-sm tabular-nums text-text-primary">
              <bdi>{appVersion || '—'}</bdi>
            </span>
          </SettingRow>
          {updateStatusText && (
            <p
              dir="auto"
              className={`mt-2 text-xs ${updatePhase === 'error' ? 'text-warning-orange' : 'text-muted-text'}`}
            >
              {updateStatusText}
            </p>
          )}
          <ActionBar>
            <ActionButton
              icon={RefreshCw}
              loading={updatePhase === 'checking'}
              label={t('checkForUpdates')}
              loadingLabel={t('checkingForUpdates')}
              onClick={() => checkForUpdates({ manual: true })}
            />
          </ActionBar>
        </Section>

        <Section id="settings-diagnostics" title={t('diagnostics')}>
          {diagnostics && (
            <div className="grid gap-x-10 sm:grid-cols-2">
              <DiagRow label={t('appVersion')} value={diagnostics.appVersion} />
              <DiagRow
                label={t('diagMushafFonts')}
                value={mushafFontsValue || '—'}
                ok={mushafFontsOk}
              />
              <DiagRow label={t('diagDatabaseSize')} value={formatBytes(diagnostics.dbSizeBytes)} />
              <DiagRow
                label={t('diagLibraryItems')}
                value={`${diagnostics.videoCount} ${t('videosLower')} / ${diagnostics.playlistCount} ${t('playlistsLower')}`}
              />
              <DiagRow
                label={t('ffmpegStatus')}
                value={diagnostics.ffmpegStatus === 'missing' ? t('missing') : `${diagnostics.ffmpegStatus}`}
                ok={diagnostics.ffmpegStatus !== 'missing'}
              />
              <DiagRow
                label={t('diagDownloaderHelper')}
                value={diagnostics.ytdlpVersion ?? t('diagNotInstalled')}
                ok={Boolean(diagnostics.ytdlpVersion)}
              />
              <DiagRow
                label={t('diagInternet')}
                value={diagnostics.internetOk ? t('diagConnected') : t('diagNotConnected')}
                ok={diagnostics.internetOk}
              />
              <DiagRow
                label={t('diagUpdateEndpoint')}
                value={diagnostics.updateEndpointOk ? t('diagConnected') : t('diagNotConnected')}
                ok={diagnostics.updateEndpointOk}
              />
              <DiagRow label={t('openAppDataFolder')} value={diagnostics.appDataPath} />
            </div>
          )}
          <ActionBar>
            <ActionButton
              icon={Activity}
              loading={runningDiagnostics}
              label={t('runDiagnostics')}
              loadingLabel={t('runningDiagnostics')}
              onClick={handleRunDiagnostics}
            />
          </ActionBar>
        </Section>
          </div>
        </div>
      </div>
    </div>
  );
};

const DiagRow: React.FC<{ label: string; value: string; ok?: boolean }> = ({ label, value, ok }) => (
  <div className="rule-row justify-between gap-4 py-2.5">
    <span className="shrink-0 text-xs text-muted-text">{label}</span>
    <span
      dir="auto"
      className={`min-w-0 truncate text-end text-xs ${ok === false ? 'text-danger-red' : 'text-text-primary'}`}
      title={value}
    >
      {value}
    </span>
  </div>
);

/** A section is a heading over a hairline. Never a panel inside a panel. */
const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  id?: string;
}> = ({ title, children, id }) => (
  <section id={id} className="mb-9 scroll-mt-6">
    {/* No letter-spacing: index.css pins Arabic to `letter-spacing: 0` because
        tracking breaks the joins between Arabic letters. */}
    <h2 className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase text-muted-text">
      {title}
    </h2>
    {children}
  </section>
);

const SettingRow: React.FC<{
  label: string;
  description?: string;
  /** Drop the row's own rule when the control already carries one (a
      `.field-quiet` baseline), so the row never shows two hairlines. */
  flush?: boolean;
  children: React.ReactNode;
}> = ({ label, description, flush = false, children }) => (
  <div className={`rule-row justify-between gap-6 ${flush ? 'border-b-0' : ''}`}>
    <div className="min-w-0">
      <label className="block text-sm text-text-primary">{label}</label>
      {description && <p className="mt-0.5 text-xs text-muted-text">{description}</p>}
    </div>
    <div className="flex min-w-0 max-w-[60%] flex-1 justify-end">{children}</div>
  </div>
);

/** Actions sit under their section's rows as quiet text, never as a row of
    filled chips — the label already says what the button does. */
const ActionBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">{children}</div>
);

const TextSetting: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder, onChange }) => {
  // Edit locally and commit on blur/Enter so typing never triggers a database
  // write per keystroke (which made these inputs feel laggy).
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onChange(draft);
  };

  return (
    <SettingRow label={label} flush>
      <input
        type="text"
        dir="auto"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
            event.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        className="field-quiet max-w-md text-end text-sm"
      />
    </SettingRow>
  );
};

/** Text input that edits locally and only saves when the user finishes (blur/Enter). */
const DraftInput: React.FC<{
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onCommit, placeholder, className }) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      type="text"
      dir="auto"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit();
          event.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      className={className}
    />
  );
};

/** Volume slider that follows the pointer smoothly and saves once on release. */
const VolumeSlider: React.FC<{
  value: number;
  onCommit: (value: number) => void;
}> = ({ value, onCommit }) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <div className="flex w-full max-w-xs items-center gap-3">
      <Volume2 className="h-4 w-4 shrink-0 text-muted-text" />
      <input
        type="range"
        min={0}
        max={100}
        value={draft}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="range-quiet flex-1"
        // The fill is painted from --fill so it runs the correct way under RTL;
        // `accent-color` always fills from the physical left.
        style={{ '--fill': draft } as React.CSSProperties}
      />
      <span className="w-10 shrink-0 text-end text-sm tabular-nums text-text-primary">
        <bdi>{draft}%</bdi>
      </span>
    </div>
  );
};

const ActionButton: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  label: string;
  loadingLabel: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}> = ({ icon: Icon, loading, label, loadingLabel, onClick, danger = false, disabled = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading || disabled}
    className={`quiet-action ${danger ? 'quiet-action-danger' : ''}`}
  >
    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
    {loading ? loadingLabel : label}
  </button>
);
