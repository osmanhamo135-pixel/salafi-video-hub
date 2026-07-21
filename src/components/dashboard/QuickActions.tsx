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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={handleImport}
          disabled={importing}
          className="btn-primary"
        >
          {importing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FolderOpen size={16} />
          )}
          {importing ? t('importingStatus') : t('importFolder')}
        </button>

        <button
          onClick={handleImportSingleVideo}
          disabled={importing}
          className="btn-secondary"
        >
          <FileVideo size={16} />
          {t('importSingleVideo')}
        </button>

        {hasLastPlaylist && (
          <button
            onClick={handleOpenLastPlaylist}
            className="btn-secondary"
          >
            <History size={16} />
            {t('openLastPlaylist')}
          </button>
        )}
      </div>

      {importError && (
        <div className="flex items-center gap-2 text-danger-red text-sm bg-danger-red/10 border border-danger-red/20 rounded-lg px-3 py-2">
          <AlertCircle size={16} />
          <span>{importError}</span>
        </div>
      )}

      {importSummary && (
        <div className="flex items-center gap-2 text-success-green text-sm bg-success-green/10 border border-success-green/20 rounded-lg px-3 py-2">
          <CheckCircle2 size={16} />
          <span>{importSummary}</span>
        </div>
      )}
    </div>
  );
};
