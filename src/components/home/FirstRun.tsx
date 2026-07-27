import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FolderOpen, Loader2, RadioTower } from 'lucide-react';
import { pickFolder } from '@/hooks/useTauriCommands';
import { useAppStore } from '@/store/appStore';
import { useQuranStore } from '@/store/quranStore';
import { useI18n } from '@/i18n';

/**
 * The import-a-folder moment — the most important screen in the app, and
 * until now it did not exist. A brand-new install landed on a dashboard of
 * empty sections, which answers the first question a person asks ("what do I
 * do?") with a shrug.
 *
 * One panel, jadwal-framed like the featured card it will become, making the
 * three honest offers a fresh install can keep: bring your lessons in, open
 * the mushaf, or listen to the radio. The mushaf and radio work with zero
 * setup, which is worth surfacing — the app is useful before a single file is
 * imported.
 *
 * It renders only while the library is genuinely empty and disappears the
 * moment the first import lands, because the import triggers the stats
 * refresh the Dashboard already subscribes to.
 */
export const FirstRun: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const importFolder = useAppStore((s) => s.importFolder);
  const loadStats = useAppStore((s) => s.loadStats);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openSurah = useQuranStore((s) => s.openSurah);

  const handleImport = async () => {
    try {
      setError(null);
      const path = await pickFolder(t('dialogSelectFolder'));
      if (!path) return;
      setImporting(true);
      await importFolder(path, true);
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('importFailed'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="hero-feature glass glow-edge mt-4 p-6 sm:p-10">
      <div className="jadwal" aria-hidden="true" />
      <div className="relative z-[1] mx-auto flex max-w-xl flex-col items-center gap-4 py-4 text-center">
        <p className="text-[11px] font-medium text-accent-gold">{t('firstRunEyebrow')}</p>
        <h2 className="font-display text-3xl font-semibold text-text-primary sm:text-4xl">
          {t('firstRunTitle')}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-text">{t('firstRunBody')}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="btn-primary px-6 py-3 text-sm"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            {importing ? t('importingStatus') : t('firstRunImport')}
          </button>
          <button
            type="button"
            onClick={() => {
              void openSurah(1);
              navigate('/quran');
            }}
            className="btn-secondary px-5 py-3 text-sm"
          >
            <BookOpen className="h-4 w-4" />
            {t('heroFeatureStartFatihah')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/radio')}
            className="btn-ghost px-4 py-3 text-sm"
          >
            <RadioTower className="h-4 w-4" />
            {t('navRadio')}
          </button>
        </div>

        {error && (
          <p className="mt-2 border-s-2 border-danger-red/70 ps-3 text-start text-sm text-danger-red">
            <bdi>{error}</bdi>
          </p>
        )}

        <p className="mt-4 text-xs text-text-faint">{t('firstRunHint')}</p>
      </div>
    </section>
  );
};
