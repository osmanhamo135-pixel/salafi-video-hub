import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Gauge,
  HardDrive,
  Image,
  Library,
  ShieldCheck,
  TimerReset,
  Video,
} from 'lucide-react';
import appIcon from '@/assets/app-icon.png';
import { Reminder } from '@/types';
import { useAppStore } from '@/store/appStore';
import { ContinueWatching } from '@/components/dashboard/ContinueWatching';
import { RecentlyAdded } from '@/components/dashboard/RecentlyAdded';
import { QuickActions } from '@/components/dashboard/QuickActions';
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

  const metricTiles = [
    { icon: Video, label: t('totalVideos'), value: (stats?.totalVideos ?? 0).toLocaleString() },
    { icon: Library, label: t('playlists'), value: (stats?.totalPlaylists ?? 0).toLocaleString() },
    { icon: HardDrive, label: t('libraryStorage'), value: formatBytes(stats?.totalStorageBytes ?? 0) },
    { icon: CheckCircle2, label: t('completed'), value: (stats?.completedVideos ?? 0).toLocaleString() },
  ];

  return (
    <div className="page-container">
      <div className="content-max-width">
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

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="salafi-dashboard-hero ornate-corner relative overflow-hidden rounded-lg p-5">
            <img
              src={appIcon}
              alt=""
              className="pointer-events-none absolute -right-8 -top-10 h-56 w-56 select-none opacity-[0.08]"
              draggable={false}
            />
            <div className="relative grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <ProgressRing
                label={t('libraryReadiness')}
                value={completionPercent}
                detail={`${stats?.completedVideos ?? 0} ${t('of')} ${stats?.totalVideos ?? 0} ${t('completedLower')}`}
              />

              <div className="min-w-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-gold">
                      {t('libraryAtAGlance')}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-text-primary">
                      {formatBytes(stats?.totalStorageBytes ?? 0)}
                    </h2>
                    <p className="mt-1 text-sm text-muted-text">
                      {(stats?.totalVideos ?? 0).toLocaleString()} {t('localFiles')} / {watchArchive}
                    </p>
                  </div>
                  <div className="hidden h-16 w-16 items-center justify-center rounded-lg border border-accent-gold/25 bg-accent-gold/10 text-accent-gold sm:flex">
                    <Gauge className="h-7 w-7" />
                  </div>
                </div>

                {isLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-20 animate-pulse rounded-md border border-border bg-background/45" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {metricTiles.map((item) => (
                      <MetricTile
                        key={item.label}
                        icon={item.icon}
                        label={item.label}
                        value={item.value}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="premium-surface ornate-corner relative rounded-lg p-5">
            <div className="space-y-4">
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
          </div>
        </section>

        <ContinueWatching />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
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

const ProgressRing: React.FC<{
  label: string;
  value: number;
  detail: string;
}> = ({ label, value, detail }) => {
  const safeValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-accent-gold/20 bg-black/20 p-5 text-center">
      <div
        className="relative flex h-36 w-36 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--accent-gold) ${safeValue * 3.6}deg, rgba(var(--border-subtle-rgb), 0.16) 0deg)`,
        }}
      >
        <div className="absolute inset-3 rounded-full bg-background shadow-[inset_0_0_0_1px_rgba(214,181,109,0.16)]" />
        <div className="relative">
          <p className="text-4xl font-semibold tabular-nums text-text-primary">{safeValue}%</p>
          <p className="text-xs text-muted-text">{label}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-text">{detail}</p>
    </div>
  );
};

const MetricTile: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="rounded-md border border-border bg-background/45 p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <Icon className="h-4 w-4 text-primary-blue" />
      <span className="text-lg font-semibold tabular-nums text-text-primary">{value}</span>
    </div>
    <p className="truncate text-xs text-muted-text">{label}</p>
  </div>
);

const InsightRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  progress?: number;
}> = ({ icon: Icon, label, value, detail, progress }) => (
  <div className="border-b border-border/70 pb-4 last:border-b-0 last:pb-0">
    <div className="flex items-start gap-3">
      <div className="icon-medallion h-10 w-10 shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-text">{label}</p>
          <p className="text-sm font-semibold tabular-nums text-text-primary">{value}</p>
        </div>
        <p className="mt-1 truncate text-xs text-muted-text" title={detail}>{detail}</p>
        {typeof progress === 'number' && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary-blue transition-all"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  </div>
);

const TodaysRemindersPanel: React.FC<{
  reminders: Reminder[];
  loading: boolean;
  t: (key: import('@/i18n').TranslationKey) => string;
}> = ({ reminders, loading, t }) => (
  <section className="mt-8">
    <h2 className="mb-4 text-lg font-semibold text-text-primary">{t('todaysReminders')}</h2>
    {loading ? (
      <div className="premium-surface h-48 animate-pulse rounded-lg" />
    ) : reminders.length === 0 ? (
      <div className="premium-surface ornate-corner relative flex min-h-48 flex-col items-center justify-center rounded-lg p-6 text-center text-muted-text">
        <div className="icon-medallion mb-3 h-14 w-14">
          <BellOff className="h-7 w-7 text-primary-blue/70" />
        </div>
        <p className="text-sm">{t('noRemindersSet')}</p>
        <p className="mt-1 text-xs opacity-70">{t('createRemindersInTab')}</p>
      </div>
    ) : (
      <div className="premium-surface ornate-corner relative rounded-lg p-4">
        <div className="space-y-3">
          {reminders.slice(0, 6).map((reminder) => (
            <div key={reminder.id} className="flex items-center gap-3 border-b border-border/70 pb-3 last:border-b-0 last:pb-0">
              <div className="rounded-md border border-primary-blue/15 bg-background/70 p-2 text-primary-blue">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{reminder.title}</p>
                <p className="text-xs text-muted-text">{reminder.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </section>
);
