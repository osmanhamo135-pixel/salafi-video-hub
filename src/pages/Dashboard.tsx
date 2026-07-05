import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bell, BellOff, CheckCircle2, Clock, HardDrive, Image, Library, TimerReset, Video } from 'lucide-react';
import { Reminder } from '@/types';
import { useAppStore } from '@/store/appStore';
import { StatCard } from '@/components/dashboard/StatCard';
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
        // Only show enabled reminders, sorted by time
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
  const totalHours = stats?.totalDuration ? Math.round(stats.totalDuration / 3600) : 0;
  const thumbnailTotal = Math.max(thumbnailQueueLength, thumbnailProcessedCount);
  const thumbnailPercent = thumbnailTotal > 0
    ? Math.min(Math.round((thumbnailProcessedCount / thumbnailTotal) * 100), 100)
    : 0;
  const nextReminder = reminders[0];

  const statCards = [
    { icon: Video, label: t('totalVideos'), value: stats?.totalVideos ?? 0 },
    { icon: Library, label: t('playlists'), value: stats?.totalPlaylists ?? 0, color: 'text-success-green' },
    {
      icon: Clock,
      label: t('watchTime'),
      value: stats?.totalDuration ? formatDurationLong(stats.totalDuration, language) : formatDurationLong(0, language),
      color: 'text-accent-gold',
    },
    {
      icon: HardDrive,
      label: t('libraryStorage'),
      value: formatBytes(stats?.totalStorageBytes ?? 0),
      color: 'text-primary-blue',
    },
    { icon: CheckCircle2, label: t('completed'), value: stats?.completedVideos ?? 0, color: 'text-accent-blue' },
  ];

  return (
    <div className="page-container">
      <div className="content-max-width">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="premium-pill mb-2">
            {t('privateOfflineHub')}
          </div>
          <h1 className="text-3xl font-semibold text-text-primary">{t('dashboard')}</h1>
          <p className="text-sm text-muted-text mt-1">{t('dashboardSubtitle')}</p>
        </div>
        <QuickActions />
      </div>
      <div className="gold-thread mb-6" />

      <section className="premium-surface ornate-corner relative mb-6 overflow-hidden rounded-lg p-4">
        <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-5">
          <OverviewMetric
            icon={CheckCircle2}
            label={t('libraryProgress')}
            value={`${completionPercent}%`}
            detail={`${stats?.completedVideos ?? 0} ${t('of')} ${stats?.totalVideos ?? 0} ${t('completedLower')}`}
            progress={completionPercent}
          />
          <OverviewMetric
            icon={Clock}
            label={t('watchArchive')}
            value={`${totalHours.toLocaleString()}h`}
            detail={stats?.totalDuration ? formatDurationLong(stats.totalDuration, language) : t('durationNotScanned')}
          />
          <OverviewMetric
            icon={TimerReset}
            label={t('nextReminder')}
            value={nextReminder?.time ?? t('none')}
            detail={nextReminder?.title ?? `${reminders.length} ${reminders.length === 1 ? t('activeReminder') : t('activeRemindersLower')}`}
          />
          <OverviewMetric
            icon={Image}
            label={t('thumbnails')}
            value={thumbnailJobsRunning ? `${thumbnailPercent}%` : t('ready')}
            detail={
              thumbnailJobsRunning
                ? `${thumbnailGeneratedCount} ${t('ready')}, ${thumbnailFailedCount} ${t('failed')}`
                : `${thumbnailGeneratedCount} ${t('generatedThisRun')}`
            }
            progress={thumbnailJobsRunning ? thumbnailPercent : undefined}
          />
          <OverviewMetric
            icon={HardDrive}
            label={t('libraryStorage')}
            value={formatBytes(stats?.totalStorageBytes ?? 0)}
            detail={`${(stats?.totalVideos ?? 0).toLocaleString()} ${t('localFiles')}`}
          />
        </div>
      </section>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="premium-card h-20 animate-pulse rounded-lg p-4" />
          ))
        ) : (
          statCards.map((card) => (
            <StatCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              color={card.color}
            />
          ))
        )}
      </div>

      {/* Continue Watching */}
      <ContinueWatching />

      {/* Recently Added */}
      <RecentlyAdded />

      {/* Today's Reminders */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mt-8 mb-4">{t('todaysReminders')}</h2>
        {remindersLoading ? (
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="premium-card h-16 flex-1 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <div className="premium-card ornate-corner relative flex flex-col items-center justify-center rounded-lg p-8 text-muted-text">
            <div className="icon-medallion mb-3 h-14 w-14">
              <BellOff size={28} className="text-primary-blue/70" />
            </div>
            <p className="text-sm">{t('noRemindersSet')}</p>
            <p className="text-xs mt-1 opacity-70">{t('createRemindersInTab')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reminders.slice(0, 6).map((reminder) => (
              <div
                key={reminder.id}
                className="premium-card premium-card-hover flex items-center gap-3 rounded-lg p-3"
              >
                <div className="rounded-md border border-primary-blue/15 bg-background/70 p-2 text-primary-blue">
                  <Bell size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary font-medium truncate">{reminder.title}</p>
                  <p className="text-xs text-muted-text">{reminder.time}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
};

const OverviewMetric: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  progress?: number;
}> = ({ icon: Icon, label, value, detail, progress }) => (
  <div className="rounded-md border border-border bg-background/55 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-text">
        <Icon className="h-4 w-4 text-primary-blue" />
        {label}
      </div>
      <span className="text-lg font-semibold tabular-nums text-text-primary">{value}</span>
    </div>
    <p className="truncate text-xs text-muted-text" title={detail}>{detail}</p>
    {typeof progress === 'number' && (
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel">
        <div
          className="h-full rounded-full bg-primary-blue transition-all"
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
    )}
  </div>
);
