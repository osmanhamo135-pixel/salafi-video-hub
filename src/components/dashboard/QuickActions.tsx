import React, { useState } from 'react';
import { FileVideo, FolderOpen, History, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { pickFolder, pickVideoFile } from '@/hooks/useTauriCommands';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePlayerStore } from '@/store/playerStore';
import { useI18n } from '@/i18n';

export const QuickActions: React.FC = () => {
  const { t } = useI18n();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const importFolder = useAppStore((s) => s.importFolder);
  const importSingleVideo = useAppStore((s) => s.importSingleVideo);
  const loadStats = useAppStore((s) => s.loadStats);
  const settings = useSettingsStore((s) => s.settings);
  const openPlaylist = usePlayerStore((s) => s.openPlaylist);

  const handleImport = async () => {
    try {
      setImportError(null);
      setImportSummary(null);
      const path = await pickFolder(t('dialogSelectFolder'));
      if (!path) return;

      setImporting(true);
      const result = await importFolder(path, true);
      setImportSummary(`${t('importFolder')}: ${result.imported_count} / ${t('skipped')}: ${result.skipped_count} / ${t('failed')}: ${result.failed_count}`);
      await loadStats();
    } catch (error) {
      console.error('Import failed:', error);
      setImportError(error instanceof Error ? error.message : t('importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleImportSingleVideo = async () => {
    try {
      setImportError(null);
      setImportSummary(null);
      const path = await pickVideoFile(t('dialogSelectVideo'));
      if (!path) return;

      setImporting(true);
      const result = await importSingleVideo(path);
      setImportSummary(`${t('importSingleVideo')}: ${result.imported_count} / ${t('skipped')}: ${result.skipped_count} / ${t('failed')}: ${result.failed_count}`);
      await loadStats();
    } catch (error) {
      console.error('Video import failed:', error);
      setImportError(error instanceof Error ? error.message : t('videoImportFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleOpenLastPlaylist = () => {
    const lastId = settings?.lastOpenedPlaylistId;
    if (lastId) {
      openPlaylist(lastId);
    }
  };

  const hasLastPlaylist = !!settings?.lastOpenedPlaylistId;

  return (
    /* Three buttons of equal weight read as a toolbar and flatten the
       masthead. One filled primary carries the page's single call to action;
       the rest step down to quiet text actions on a second line. */
    <div className="flex flex-col items-start gap-3 xl:items-end">
      <button
        onClick={handleImport}
        disabled={importing}
        className="btn-primary px-5 py-2.5"
      >
        {importing ? (
          <Loader2 size={16} className="motion-safe:animate-spin" />
        ) : (
          <FolderOpen size={16} />
        )}
        {importing ? t('importingStatus') : t('importFolder')}
      </button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 xl:justify-end">
        <button
          onClick={handleImportSingleVideo}
          disabled={importing}
          className="quiet-action"
        >
          <FileVideo size={14} />
          {t('importSingleVideo')}
        </button>

        {hasLastPlaylist && (
          <>
            <span aria-hidden="true" className="text-xs text-text-faint">·</span>
            <button onClick={handleOpenLastPlaylist} className="quiet-action">
              <History size={14} />
              {t('openLastPlaylist')}
            </button>
          </>
        )}
      </div>

      {/* Status reads as an inset marker and a value step, never a filled box —
          the same idiom as .rule-row-active. */}
      {importError && (
        <div className="flex items-start gap-2 border-s-2 border-danger-red/70 ps-3 text-sm text-danger-red">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <bdi>{importError}</bdi>
        </div>
      )}

      {importSummary && (
        <div className="flex items-start gap-2 border-s-2 border-success-green/70 ps-3 text-sm text-success-green">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <bdi>{importSummary}</bdi>
        </div>
      )}
    </div>
  );
};
