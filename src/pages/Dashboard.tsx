import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { withTimeout } from '@/utils/async';
import { BellOff } from 'lucide-react';
import { Reminder } from '@/types';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import { ContinueWatching, useEyebrowClass } from '@/components/dashboard/ContinueWatching';
import { DashboardRails } from '@/components/dashboard/DashboardRails';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Hero } from '@/components/home/Hero';
import { SectionHead } from '@/components/ui/SectionHead';
import { HeroFeature } from '@/components/home/HeroFeature';
import { StudyCharts } from '@/components/dashboard/StudyCharts';
import { formatBytes } from '@/utils/formatBytes';
import { formatDurationLong } from '@/utils/formatTime';
import { useI18n } from '@/i18n';
import { FirstRun } from '@/components/home/FirstRun';

export const Dashboard: React.FC = () => {
  const { language, t } = useI18n();
  const eyebrow = useEyebrowClass();
  const stats = useAppStore((s) => s.stats);
  const loadStats = useAppStore((s) => s.loadStats);
  const playlistsLoading = useAppStore((s) => s.playlistsLoading);
  const thumbnailJobsRunning = useAppStore((s) => s.thumbnailJobsRunning);
  const thumbnailQueueLength = useAppStore((s) => s.thumbnailQueueLength);
  const thumbnailProcessedCount = useAppStore((s) => s.thumbnailProcessedCount);
  const thumbnailGeneratedCount = useAppStore((s) => s.thumbnailGeneratedCount);
  const thumbnailFailedCount = useAppStore((s) => s.thumbnailFailedCount);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        setRemindersLoading(true);
        const data = await withTimeout(
          invoke<Reminder[]>('get_all_reminders'),
          15000,
          'Loading reminders',
        );
        const enabled = (data || [])
          .filter((r) => r.enabled)
          .sort((a, b) => a.time.localeCompare(b.time));
        setReminders(enabled);
      } catch (error) {
        console.error('Failed to load reminders:', error);
        setReminders([]);
      } finally {
        setRemindersLoading(false);
      }
    };
    fetchReminders();
  }, []);

  const isLoading = !stats && playlistsLoading;
  const importedFolders = useSettingsStore((state) => state.settings?.importedFolders ?? []);
  const isFirstRun =
    !!stats && stats.totalVideos === 0 && importedFolders.length === 0;
  const completionPercent = stats?.totalVideos
    ? Math.round((stats.completedVideos / stats.totalVideos) * 100)
    : 0;
  const thumbnailTotal = Math.max(thumbnailQueueLength, thumbnailProcessedCount);
  const thumbnailPercent = thumbnailTotal > 0
    ? Math.min(Math.round((thumbnailProcessedCount / thumbnailTotal) * 100), 100)
    : 0;
  const nextReminder = reminders[0];
  const watchArchive = stats?.totalDuration
    ? formatDurationLong(stats.totalDuration, language)
    : formatDurationLong(0, language);

  /* Demoted from four equal-weight figures to a caption row. None of these is
     what someone opens the app to find out; they are context for the one
     figure that is. */
  const supporting = [
    { label: t('totalVideos'), value: (stats?.totalVideos ?? 0).toLocaleString() },
    { label: t('playlists'), value: (stats?.totalPlaylists ?? 0).toLocaleString() },
    { label: t('libraryStorage'), value: formatBytes(stats?.totalStorageBytes ?? 0) },
    {
      label: t('watchArchive'),
      value: stats?.totalDuration ? watchArchive : t('durationNotScanned'),
    },
    {
      label: t('thumbnailEngine'),
      value: thumbnailJobsRunning ? `${thumbnailPercent}%` : t('ready'),
      detail: thumbnailJobsRunning
        ? `${thumbnailGeneratedCount} ${t('ready')}, ${thumbnailFailedCount} ${t('failed')}`
        : `${thumbnailGeneratedCount} ${t('generatedThisRun')}`,
    },
  ];

  return (
    <div className="page-container">
      <div className="content-max-width">
        <Hero />

        {/* A brand-new install gets the import moment instead of a dashboard
            of empty sections. The signal is settings-backed and cheap: no
            videos AND no imported folders. Stats loading counts as "not
            empty" so the panel cannot flash during the first fetch. */}
        {isFirstRun ? (
          <FirstRun />
        ) : (
          <>
        {/* The hero that does work. The masthead that used to sit here carried
            an <h1>Dashboard</h1> restating the highlighted sidebar item and a
            "PREMIUM VIDEO LIBRARY" badge that said nothing — between them they
            were the first thing the eye hit and the last thing it needed. The
            featured lesson takes that space instead. */}
        <header className="mt-4">
          <HeroFeature />
          {/* One row closes the block: the directional thread runs from the
              reading edge and the import actions sit at its far end — the
              actions used to float alone in a 160px band of empty ground. */}
          <div className="mt-4 flex items-center gap-6">
            <div
              aria-hidden="true"
              className="h-px min-w-0 flex-1"
              style={{
                background: `linear-gradient(${language === 'ar' ? '270deg' : '90deg'}, rgb(var(--accent-gold-rgb) / 0.55), rgb(var(--accent-gold-rgb) / 0.14) 34%, rgb(var(--accent-gold-rgb) / 0.04) 68%, transparent)`,
              }}
            />
            <QuickActions />
          </div>
        </header>

        <StudyCharts />

        {/* The lesson you were part-way through, first and largest. */}
        <ContinueWatching />

        {/* One figure at display scale; everything else is caption. */}
        <section className="reveal mt-16">
          <SectionHead className="mb-8" title={t('libraryAtAGlance')} />

          {isLoading ? (
            <GlanceSkeleton />
          ) : (
            <>
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
                <div>
                  <div className="flex items-end gap-5">
                    <p className="text-6xl font-semibold leading-none tabular-nums text-text-primary sm:text-7xl">
                      <bdi>{completionPercent}%</bdi>
                    </p>
                    <div className="pb-1">
                      <p className="text-sm font-medium text-text-primary">
                        {t('libraryReadiness')}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-text">
                        <bdi>
                          {(stats?.completedVideos ?? 0).toLocaleString()} {t('of')}{' '}
                          {(stats?.totalVideos ?? 0).toLocaleString()} {t('completedLower')}
                        </bdi>
                      </p>
                    </div>
                  </div>
                  <Meter percent={completionPercent} className="mt-7" />
                </div>

                {/* What is next, at half the weight of what is done. */}
                <div className="lg:border-s lg:border-border lg:ps-16">
                  <p className={eyebrow}>{t('nextSession')}</p>
                  {/* Nothing scheduled is not an alarm: the figure drops out of
                      the accent and the supporting lines go with it, rather
                      than shouting "None" in gold. */}
                  <p
                    className={`mt-3 text-3xl font-semibold leading-none tabular-nums ${
                      nextReminder ? 'text-accent-gold' : 'text-text-faint'
                    }`}
                  >
                    <bdi>{nextReminder?.time ?? t('none')}</bdi>
                  </p>
                  {nextReminder && (
                    <>
                      <p className="mt-3 truncate text-sm text-text-primary" title={nextReminder.title}>
                        <bdi>{nextReminder.title}</bdi>
                      </p>
                      <p className="mt-1 text-xs text-muted-text">
                        <bdi>{reminders.length}</bdi>{' '}
                        {reminders.length === 1 ? t('activeReminder') : t('activeRemindersLower')}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-12 flex flex-col sm:flex-row">
                {supporting.map((metric, i) => (
                  <div
                    key={metric.label}
                    className={`min-w-0 flex-1 py-3 sm:py-0 ${
                      i > 0
                        ? 'border-t border-border pt-3 sm:border-s sm:border-t-0 sm:pt-0 sm:ps-6'
                        : 'sm:pe-6'
                    }`}
                  >
                    <p className="truncate text-[11px] text-muted-text" title={metric.label}>
                      {metric.label}
                    </p>
                    <p
                      className="mt-1.5 truncate text-sm font-medium tabular-nums text-text-soft"
                      title={metric.detail ?? metric.value}
                    >
                      <bdi>{metric.value}</bdi>
                    </p>
                  </div>
                ))}
              </div>

              {thumbnailJobsRunning && <Meter percent={thumbnailPercent} className="mt-6" subtle />}
            </>
          )}
        </section>

        {/* Rails run the full measure. They were sharing a two-column grid
            with the reminders panel, which halved every card row and defeated
            the point of a rail. Reminders keep their column below. */}
        <DashboardRails />

        <div className="mt-9 grid gap-x-16 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div />
          <TodaysRemindersPanel
            reminders={reminders}
            loading={remindersLoading}
            t={t}
          />
        </div>
          </>
        )}
      </div>
    </div>
  );
};

const Meter: React.FC<{ percent: number; className?: string; subtle?: boolean }> = ({
  percent,
  className = '',
  subtle = false,
}) => {
  const safe = Math.min(Math.max(percent, 0), 100);
  return (
    <div
      className={`w-full rounded-full ${subtle ? 'h-px' : 'h-[3px]'} ${className}`}
      style={{ background: 'rgb(var(--text-muted-rgb) / 0.18)' }}
      role="presentation"
    >
      <div
        className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
        style={{
          width: `${safe}%`,
          background: subtle
            ? 'rgb(var(--accent-gold-rgb) / 0.7)'
            : 'rgb(var(--accent-gold-rgb))',
        }}
      />
    </div>
  );
};

const GlanceSkeleton: React.FC = () => (
  <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
    <div>
      <div className="h-16 w-40 rounded bg-panel-hover motion-safe:animate-pulse" />
      <div className="mt-7 h-[3px] w-full rounded bg-panel-hover motion-safe:animate-pulse" />
    </div>
    <div className="lg:border-s lg:border-border lg:ps-16">
      <div className="h-3 w-24 rounded bg-panel-hover motion-safe:animate-pulse" />
      <div className="mt-3 h-8 w-24 rounded bg-panel-hover motion-safe:animate-pulse" />
      <div className="mt-3 h-3 w-32 rounded bg-panel-hover motion-safe:animate-pulse" />
    </div>
  </div>
);

/* A schedule, not a list: the time leads in the accent at a fixed measure so
   the column reads down as times, and the titles hang off it. */
const TodaysRemindersPanel: React.FC<{
  reminders: Reminder[];
  loading: boolean;
  t: (key: import('@/i18n').TranslationKey) => string;
}> = ({ reminders, loading, t }) => (
  <section className="mt-20">
    <SectionHead
      className="mb-2"
      title={t('todaysReminders')}
      meta={!loading && reminders.length > 0 ? <bdi>{reminders.length}</bdi> : undefined}
    />
    {loading ? (
      <div className="flex flex-col">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border py-4">
            <div className="h-3 w-12 shrink-0 rounded bg-panel-hover motion-safe:animate-pulse" />
            <div className="h-3 flex-1 rounded bg-panel-hover motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    ) : reminders.length === 0 ? (
      <div className="px-4 py-16 text-center">
        <span
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border"
          style={{ background: 'rgb(var(--accent-gold-rgb) / 0.05)' }}
        >
          <BellOff className="h-5 w-5 text-accent-gold/60" />
        </span>
        <p className="mt-5 text-sm font-medium text-text-primary">{t('noRemindersSet')}</p>
        <p className="mx-auto mt-2 max-w-[15rem] text-xs text-muted-text">
          {t('createRemindersInTab')}
        </p>
      </div>
    ) : (
      <div className="flex flex-col">
        {reminders.slice(0, 6).map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-baseline gap-4 border-b border-border py-4 last:border-b-0"
          >
            <span className="w-12 shrink-0 text-sm font-medium tabular-nums text-accent-gold">
              <bdi>{reminder.time}</bdi>
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-text-primary" title={reminder.title}>
              <bdi>{reminder.title}</bdi>
            </p>
          </div>
        ))}
      </div>
    )}
  </section>
);
