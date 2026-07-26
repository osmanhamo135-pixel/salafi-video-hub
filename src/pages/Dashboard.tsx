import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Bell,
  Clock,
  Image,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { Reminder } from '@/types';
import { useAppStore } from '@/store/appStore';
import { ContinueWatching } from '@/components/dashboard/ContinueWatching';
import { RecentlyAdded } from '@/components/dashboard/RecentlyAdded';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Hero } from '@/components/home/Hero';
import { formatBytes } from '@/utils/formatBytes';
import { formatDurationLong } from '@/utils/formatTime';
import { useI18n } from '@/i18n';

export const Dashboard: React.FC = () => {
  const { language, t } = useI18n();
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
        const data = await invoke<Reminder[]>('get_all_reminders');
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

  const metrics = [
    { label: t('totalVideos'), value: (stats?.totalVideos ?? 0).toLocaleString() },
    { label: t('playlists'), value: (stats?.totalPlaylists ?? 0).toLocaleString() },
    { label: t('libraryStorage'), value: formatBytes(stats?.totalStorageBytes ?? 0) },
    { label: t('completed'), value: (stats?.completedVideos ?? 0).toLocaleString() },
  ];

  return (
    <div className="page-container">
      <div className="content-max-width">
        <Hero />

        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="premium-pill mb-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('premiumLibraryCommand')}
            </div>
            <h1 className="text-3xl font-semibold text-text-primary">{t('dashboard')}</h1>
            <p className="mt-1 text-sm text-muted-text">{t('dashboardSubtitle')}</p>
          </div>
          <QuickActions />
        </div>

        <section>
          <div className="rule-head mb-1">
            <h2 className="text-sm font-semibold text-text-primary">{t('libraryAtAGlance')}</h2>
            <span className="text-xs tabular-nums text-muted-text">
              <bdi>{watchArchive}</bdi>
            </span>
          </div>

          <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)] lg:items-center">
            <ProgressRing
              label={t('libraryReadiness')}
              value={completionPercent}
              detail={`${stats?.completedVideos ?? 0} ${t('of')} ${stats?.totalVideos ?? 0} ${t('completedLower')}`}
            />

            {isLoading ? (
              <div className="flex flex-col sm:flex-row">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`min-w-0 flex-1 py-2 ${i > 0 ? 'border-t border-border pt-3 sm:border-s sm:border-t-0 sm:ps-5 sm:pt-2' : 'sm:pe-5'}`}
                  >
                    <div className="h-7 w-20 rounded bg-panel-hover motion-safe:animate-pulse" />
                    <div className="mt-2 h-3 w-16 rounded bg-panel-hover motion-safe:animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row">
                {metrics.map((metric, i) => (
                  <div
                    key={metric.label}
                    className={`min-w-0 flex-1 py-2 ${i > 0 ? 'border-t border-border pt-3 sm:border-s sm:border-t-0 sm:ps-5 sm:pt-2' : 'sm:pe-5'}`}
                  >
                    <p className="text-2xl font-semibold tabular-nums text-text-primary">
                      <bdi>{metric.value}</bdi>
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-text" title={metric.label}>
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rule-list">
            <InsightRow
              icon={TimerReset}
              label={t('nextSession')}
              value={nextReminder?.time ?? t('none')}
              detail={nextReminder?.title ?? `${reminders.length} ${reminders.length === 1 ? t('activeReminder') : t('activeRemindersLower')}`}
            />
            <InsightRow
              icon={Clock}
              label={t('watchArchive')}
              value={watchArchive}
              detail={stats?.totalDuration ? t('watchTime') : t('durationNotScanned')}
            />
            <InsightRow
              icon={Image}
              label={t('thumbnailEngine')}
              value={thumbnailJobsRunning ? `${thumbnailPercent}%` : t('ready')}
              detail={
                thumbnailJobsRunning
                  ? `${thumbnailGeneratedCount} ${t('ready')}, ${thumbnailFailedCount} ${t('failed')}`
                  : `${thumbnailGeneratedCount} ${t('generatedThisRun')}`
              }
              progress={thumbnailJobsRunning ? thumbnailPercent : undefined}
            />
          </div>
        </section>

        <ContinueWatching />

        <div className="grid gap-x-10 xl:grid-cols-[minmax(0,1fr)_340px]">
          <RecentlyAdded />
          <TodaysRemindersPanel
            reminders={reminders}
            loading={remindersLoading}
            t={t}
          />
        </div>
      </div>
    </div>
  );
};

/* The one key figure on the page, and the only accented mark below the hero:
   an arc, not a boxed tile. Both stops are token-derived so it re-colours in
   every theme. */
const ProgressRing: React.FC<{
  label: string;
  value: number;
  detail: string;
}> = ({ label, value, detail }) => {
  const safeValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className="relative flex h-32 w-32 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(rgb(var(--accent-gold-rgb)) ${safeValue * 3.6}deg, rgb(var(--border-subtle-rgb) / 0.18) 0deg)`,
        }}
      >
        <div className="absolute inset-[7px] rounded-full bg-background" />
        <p className="relative text-3xl font-semibold tabular-nums text-text-primary">
          <bdi>{safeValue}%</bdi>
        </p>
      </div>
      <div>
        <p className="text-xs text-text-primary">{label}</p>
        <p className="mt-0.5 text-xs text-muted-text">{detail}</p>
      </div>
    </div>
  );
};

const InsightRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  progress?: number;
}> = ({ icon: Icon, label, value, detail, progress }) => (
  <div className="rule-row">
    <Icon className="h-4 w-4 shrink-0 text-muted-text" />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm text-text-primary">{label}</p>
      <p className="mt-0.5 truncate text-xs text-muted-text" title={detail}><bdi>{detail}</bdi></p>
      {typeof progress === 'number' && (
        <div className="mt-2 h-px w-full bg-border">
          <div
            className="h-px bg-muted-text"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
    <p className="shrink-0 text-sm font-medium tabular-nums text-text-primary">
      <bdi>{value}</bdi>
    </p>
  </div>
);

const TodaysRemindersPanel: React.FC<{
  reminders: Reminder[];
  loading: boolean;
  t: (key: import('@/i18n').TranslationKey) => string;
}> = ({ reminders, loading, t }) => (
  <section className="mt-8">
    <div className="rule-head mb-1">
      <h2 className="text-sm font-semibold text-text-primary">{t('todaysReminders')}</h2>
      <span className="text-xs tabular-nums text-muted-text">
        <bdi>{reminders.length}</bdi>
      </span>
    </div>
    {loading ? (
      <div className="rule-list">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rule-row">
            <div className="h-4 w-4 shrink-0 rounded bg-panel-hover motion-safe:animate-pulse" />
            <div className="h-3 flex-1 rounded bg-panel-hover motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    ) : reminders.length === 0 ? (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-text">{t('noRemindersSet')}</p>
        <p className="mt-1 text-xs text-text-faint">{t('createRemindersInTab')}</p>
      </div>
    ) : (
      <div className="rule-list">
        {reminders.slice(0, 6).map((reminder) => (
          <div key={reminder.id} className="rule-row">
            <Bell className="h-4 w-4 shrink-0 text-muted-text" />
            <p className="min-w-0 flex-1 truncate text-sm text-text-primary" title={reminder.title}>
              <bdi>{reminder.title}</bdi>
            </p>
            <span className="shrink-0 text-xs tabular-nums text-muted-text">
              <bdi>{reminder.time}</bdi>
            </span>
          </div>
        ))}
      </div>
    )}
  </section>
);
