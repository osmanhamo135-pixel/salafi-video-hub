import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-dialog';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  Languages,
  HardDrive,
  Image,
  Loader2,
  RefreshCw,
  Scissors,
  Trash2,
  Upload,
  Volume2,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUpdateStore } from '@/store/updateStore';
import { playReminderSound, stopReminderSound } from '@/utils/reminderAudio';
import { AppLanguage, AppTheme } from '@/types';
import { languageOptions, themeOptions, useI18n } from '@/i18n';

interface ThumbnailBatchResult {
  generated_count: number;
  skipped_count: number;
  failed_count: number;
  errors: string[];
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
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue/50 ${
      checked ? 'bg-primary-blue' : 'bg-border'
    } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition ${
        checked ? 'translate-x-5' : 'translate-x-0'
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

  const [appVersion, setAppVersion] = useState('');

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

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

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
    if (!confirm(`Remove "${path}" from imported folders?\n\nThis will not delete any files.`)) return;
    try {
      await removeImportedFolder(path);
      await refreshPlaylists();
      showToast('Folder removed successfully');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRescanAll = async () => {
    setRescanning(true);
    try {
      await invoke('rescan_all');
      await refreshPlaylists();
      showToast('Library rescanned successfully');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRescanning(false);
    }
  };

  const handleRepairDatabase = async () => {
    if (!confirm('Repair database? This will run SQLite integrity checks.')) return;
    setRepairing(true);
    try {
      await invoke('repair_database');
      showToast('Database check passed');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRepairing(false);
    }
  };

  const handleRemoveOrphans = async () => {
    if (!confirm('Remove database entries for videos that no longer exist on disk?')) return;
    setRemovingOrphans(true);
    try {
      const removed = await invoke<number>('remove_orphaned_entries');
      await refreshPlaylists();
      showToast(`Removed ${removed} orphaned entr${removed === 1 ? 'y' : 'ies'}`);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setRemovingOrphans(false);
    }
  };

  const handleClearThumbnailCache = async () => {
    if (!confirm('Clear all generated thumbnails from the app cache?')) return;
    setClearingCache(true);
    try {
      await invoke('clear_thumbnail_cache');
      await refreshPlaylists();
      showToast('Thumbnail cache cleared');
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
        `Generated ${result.generated_count}, skipped ${result.skipped_count}, failed ${result.failed_count}`,
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
      showToast(`Backup exported to ${path}`);
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
      showToast('Backup imported successfully');
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
      showToast('Playing test sound');
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
      showToast('Reminder sound updated');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  if (settingsLoading && !settings) {
    return (
      <div className="page-container">
        <div className="content-max-width flex flex-col items-center justify-center py-24">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary-blue" />
          <p className="text-sm text-muted-text">{t('loadingSettings')}</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page-container">
        <div className="content-max-width flex flex-col items-center justify-center py-24">
          <div className="premium-surface ornate-corner relative w-full max-w-lg rounded-lg p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-9 w-9 text-danger-red" />
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
      </div>
    );
  }

  const ffmpegBadge = (() => {
    if (!ffmpegStatus) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted-text/10 px-2.5 py-1 text-xs font-medium text-muted-text">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('checking')}
        </span>
      );
    }
    if (ffmpegStatus.status === 'missing') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-red/15 px-2.5 py-1 text-xs font-medium text-danger-red">
          <XCircle className="h-3 w-3" />
          {t('missing')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-green/15 px-2.5 py-1 text-xs font-medium text-success-green">
        <CheckCircle className="h-3 w-3" />
        {ffmpegStatus.status}{ffmpegStatus.version ? ` ${ffmpegStatus.version}` : ''}
      </span>
    );
  })();

  const thumbnailTotal = Math.max(thumbnailQueueLength, thumbnailProcessedCount);

  return (
    <div className="page-container">
      <div className="content-max-width">
        <div className="mb-6 flex items-center gap-3">
          <div className="icon-medallion h-9 w-9">
            <Wrench className="h-5 w-5 text-primary-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{t('settingsTitle')}</h1>
            <p className="text-xs text-muted-text">{t('settingsSubtitle')}</p>
          </div>
        </div>

        {toast && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${
              toast.type === 'success'
                ? 'border-success-green/20 bg-success-green/10 text-success-green'
                : 'border-danger-red/20 bg-danger-red/10 text-danger-red'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.message}
          </div>
        )}

        {settingsError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning-orange/20 bg-warning-orange/10 px-4 py-2.5 text-sm font-medium text-warning-orange">
            <AlertCircle className="h-4 w-4" />
            {settingsError}
          </div>
        )}

        <SettingsSection icon={Languages} title={t('experience')}>
          <SettingRow label={t('language')} description={t('languageDescription')}>
            <div className="flex flex-wrap justify-end gap-2">
              {languageOptions.map((option) => {
                const active = settings.language === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => updateSettings({ language: option.id as AppLanguage })}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border-primary-blue/45 bg-primary-blue/15 text-primary-blue'
                        : 'border-border bg-panel text-muted-text hover:border-border-strong hover:text-text-primary'
                    }`}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </SettingRow>

          <div className="mb-4 rounded-lg border border-border bg-background/60 px-4 py-3">
            <p className="arabic-text text-2xl font-semibold text-text-primary">{t('arabicPreview')}</p>
            <p className="mt-1 text-xs text-muted-text">{t('languageDescription')}</p>
          </div>

          <SettingRow label={t('appTheme')} description={t('appThemeDescription')}>
            <div className="grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2">
              {themeOptions.map((theme) => {
                const active = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => updateSettings({ theme: theme.id as AppTheme })}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-start transition-colors ${
                      active
                        ? 'border-primary-blue/45 bg-primary-blue/10 text-text-primary'
                        : 'border-border bg-background/70 text-muted-text hover:border-border-strong hover:text-text-primary'
                    }`}
                  >
                    <span className="flex shrink-0 overflow-hidden rounded-md border border-white/10">
                      {theme.swatches.map((color) => (
                        <span key={color} className="h-8 w-5" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{t(theme.labelKey)}</span>
                      <span className="block text-xs text-muted-text">{t(theme.descriptionKey)}</span>
                    </span>
                    {active && <span className="rounded-md bg-primary-blue/15 px-2 py-1 text-[10px] font-semibold text-primary-blue">{t('applied')}</span>}
                  </button>
                );
              })}
            </div>
          </SettingRow>
        </SettingsSection>

        <SettingsSection icon={FolderOpen} title={t('library')}>
          <div className="mb-4">
            <p className="mb-2 text-sm text-muted-text">{t('importedFolders')}</p>
            {settings.importedFolders.length === 0 ? (
              <div className="rounded-lg border border-border bg-background p-4 text-center text-sm text-muted-text">
                {t('noFoldersImported')}
              </div>
            ) : (
              <div className="space-y-1.5">
                {settings.importedFolders.map((path) => (
                  <div key={path} className="group flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5">
                    <span className="truncate text-sm text-text-primary" title={path}>{path}</span>
                    <button
                      onClick={() => handleRemoveFolder(path)}
                      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-danger-red opacity-0 transition-colors hover:bg-danger-red/10 group-hover:opacity-100 focus:opacity-100"
                    >
                      {t('remove')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={RefreshCw} loading={rescanning} label={t('rescanAll')} loadingLabel={t('rescanning')} onClick={handleRescanAll} />
            <ActionButton icon={Database} loading={repairing} label={t('repairDatabase')} loadingLabel={t('repairing')} onClick={handleRepairDatabase} />
            <ActionButton danger icon={Scissors} loading={removingOrphans} label={t('removeOrphanedEntries')} loadingLabel={t('removing')} onClick={handleRemoveOrphans} />
          </div>
        </SettingsSection>

        <SettingsSection icon={Image} title={t('thumbnails')}>
          <SettingRow label={t('ffmpegStatus')}>
            <div className="flex items-center gap-2">
              {ffmpegBadge}
              <button
                onClick={() => detectFfmpeg()}
                className="rounded-md p-1.5 text-muted-text transition-colors hover:bg-elevated-panel hover:text-text-primary"
                title={t('ffmpegStatus')}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </SettingRow>
          {ffmpegStatus?.status === 'missing' && (
            <div className="mb-3 rounded-lg border border-warning-orange/25 bg-warning-orange/10 px-4 py-3 text-xs text-warning-orange">
              {t('ffmpegInstallHelp')}
            </div>
          )}
          <TextSetting label={t('ffmpegPath')} value={settings.ffmpegPath ?? ffmpegStatus?.path ?? ''} onChange={(value) => updateSettings({ ffmpegPath: value || null })} />
          <TextSetting label={t('ffprobePath')} value={settings.ffprobePath ?? ffmpegStatus?.ffprobePath ?? ''} onChange={(value) => updateSettings({ ffprobePath: value || null })} />
          <SettingRow label={t('thumbnailCache')}>
            <input
              type="text"
              readOnly
              value={settings.thumbnailCachePath ?? t('defaultAppCache')}
              className="surface-input w-full min-w-0 py-1.5 text-muted-text"
            />
          </SettingRow>
          <SettingRow label={t('thumbnailMode')}>
            <select
              value={settings.automaticThumbnailsMode}
              onChange={(event) => updateSettings({
                automaticThumbnailsMode: event.target.value as typeof settings.automaticThumbnailsMode,
              })}
              className="surface-input w-full max-w-xs py-1.5"
            >
              <option value="automatic">{t('automatic')}</option>
              <option value="visible-only">{t('visibleOnly')}</option>
              <option value="idle-only">{t('idleOnly')}</option>
              <option value="disabled">{t('disabled')}</option>
            </select>
          </SettingRow>
          <p className="mb-3 text-xs text-muted-text">{t('thumbnailHelp')}</p>
          <div className="flex flex-wrap gap-2">
            {ffmpegStatus?.status === 'missing' && (
              <ActionButton icon={Download} loading={installingFfmpeg} label={t('installFfmpeg')} loadingLabel={t('installingFfmpeg')} onClick={handleInstallFfmpeg} />
            )}
            <ActionButton danger icon={Trash2} loading={clearingCache} label={t('clearThumbnailCache')} loadingLabel={t('clearing')} onClick={handleClearThumbnailCache} />
            <ActionButton icon={Image} loading={regeneratingThumbs} label={t('regenerateMissingThumbnails')} loadingLabel={t('generating')} onClick={handleRegenerateMissingThumbnails} />
          </div>
          {(thumbnailJobsRunning || regeneratingThumbs) && (
            <div className="mt-3 rounded-md border border-primary-blue/20 bg-primary-blue/10 px-3 py-2 text-xs text-primary-blue">
              {t('generating')} {Math.min(thumbnailProcessedCount, thumbnailTotal)} / {thumbnailTotal}
              {thumbnailGeneratedCount > 0 && ` - ${thumbnailGeneratedCount} ${t('ready')}`}
              {thumbnailFailedCount > 0 && ` - ${thumbnailFailedCount} ${t('failed')}`}
              {thumbnailSkippedCount > 0 && ` - ${thumbnailSkippedCount} ${t('skipped')}`}
            </div>
          )}
        </SettingsSection>

        <SettingsSection icon={Zap} title={t('performance')}>
          <SettingRow label={t('performanceMode')} description={t('performanceModeDescription')}>
            <Toggle checked={settings.performanceMode} onChange={(checked) => updateSettings({ performanceMode: checked })} />
          </SettingRow>
        </SettingsSection>

        <SettingsSection icon={Bell} title={t('reminderDefaults')}>
          <SettingRow label={t('defaultReminderSound')}>
            <div className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={settings.reminderSoundPath ?? ''}
                onChange={(event) => updateSettings({ reminderSoundPath: event.target.value || null })}
                placeholder={t('noSoundSet')}
                className="surface-input min-w-0 flex-1 py-1.5"
              />
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={handlePickReminderSound} className="btn-secondary px-3 py-1.5 text-xs">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {t('browse')}
                </button>
                <button type="button" onClick={() => updateSettings({ reminderSoundPath: null })} className="btn-secondary px-3 py-1.5 text-xs">
                  {t('clear')}
                </button>
              </div>
            </div>
          </SettingRow>
          <SettingRow label={t('reminderVolume')}>
            <div className="flex w-full max-w-xs items-center gap-3">
              <Volume2 className="h-4 w-4 text-muted-text" />
              <input
                type="range"
                min={0}
                max={100}
                value={settings.reminderVolume}
                onChange={(event) => updateSettings({ reminderVolume: Number(event.target.value) })}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-border accent-primary-blue"
              />
              <span className="w-10 text-end text-sm tabular-nums text-text-primary">{settings.reminderVolume}%</span>
            </div>
          </SettingRow>
          <div className="flex justify-end">
            <ActionButton icon={Volume2} loading={testingSound} label={t('testSound')} loadingLabel={t('testing')} onClick={handleTestSound} />
          </div>
        </SettingsSection>

        <SettingsSection icon={HardDrive} title={t('data')}>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={Download} loading={exporting} label={t('exportBackup')} loadingLabel={t('exporting')} onClick={handleExportBackup} />
            <ActionButton icon={Upload} loading={importing} label={t('importBackup')} loadingLabel={t('importing')} onClick={handleImportBackup} />
            <ActionButton icon={ExternalLink} loading={openingFolder} label={t('openAppDataFolder')} loadingLabel={t('opening')} onClick={handleOpenAppDataFolder} />
          </div>
        </SettingsSection>

        <SettingsSection icon={RefreshCw} title={t('updates')}>
          <SettingRow label={t('appVersion')}>
            <span className="text-sm font-medium tabular-nums text-text-primary">{appVersion || '—'}</span>
          </SettingRow>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${updatePhase === 'error' ? 'text-warning-orange' : 'text-muted-text'}`}>
              {updateStatusText}
            </p>
            <ActionButton
              icon={RefreshCw}
              loading={updatePhase === 'checking'}
              label={t('checkForUpdates')}
              loadingLabel={t('checkingForUpdates')}
              onClick={() => checkForUpdates({ manual: true })}
            />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
};

const SettingsSection: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
  <section className="premium-surface ornate-corner relative mb-4 rounded-lg p-5">
    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-text-primary">
      <Icon className="h-4 w-4 text-primary-blue" />
      {title}
    </h2>
    {children}
  </section>
);

const SettingRow: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
}> = ({ label, description, children }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <div>
      <label className="text-sm text-text-primary">{label}</label>
      {description && <p className="mt-0.5 text-xs text-muted-text">{description}</p>}
    </div>
    <div className="flex min-w-0 flex-1 justify-end">{children}</div>
  </div>
);

const TextSetting: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}> = ({ label, value, placeholder = 'Auto-detect', onChange }) => (
  <SettingRow label={label}>
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="surface-input w-full max-w-md py-1.5"
    />
  </SettingRow>
);

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
    onClick={onClick}
    disabled={loading || disabled}
    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
      danger
        ? 'border-danger-red/20 bg-danger-red/5 text-danger-red hover:bg-danger-red/10'
        : 'border-border bg-elevated-panel text-text-primary hover:border-primary-blue/30 hover:bg-panel-hover'
    }`}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
    {loading ? loadingLabel : label}
  </button>
);
