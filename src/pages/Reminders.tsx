import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Reminder } from '@/types';
import { useRemindersStore } from '@/store/remindersStore';
import { ReminderCard } from '@/components/reminders/ReminderCard';
import { ReminderModal } from '@/components/reminders/ReminderModal';
import { ReminderForm, ReminderFormData } from '@/components/reminders/ReminderForm';
import { Bell, Plus, Clock, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { formatReminderDueLabel, getNextReminderOccurrence } from '@/utils/reminderSchedule';

export const Reminders: React.FC = () => {
  const { language, t } = useI18n();
  const reminders = useRemindersStore((state) => state.reminders);
  const remindersLoading = useRemindersStore((state) => state.remindersLoading);
  const remindersError = useRemindersStore((state) => state.remindersError);
  const playlists = useRemindersStore((state) => state.playlists);
  const videos = useRemindersStore((state) => state.videos);
  const loadReminders = useRemindersStore((state) => state.loadReminders);
  const loadPlaylists = useRemindersStore((state) => state.loadPlaylists);
  const loadVideos = useRemindersStore((state) => state.loadVideos);
  const loadVideosByIds = useRemindersStore((state) => state.loadVideosByIds);
  const createReminder = useRemindersStore((state) => state.createReminder);
  const updateReminder = useRemindersStore((state) => state.updateReminder);
  const deleteReminder = useRemindersStore((state) => state.deleteReminder);
  const toggleReminder = useRemindersStore((state) => state.toggleReminder);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [targetsHydrated, setTargetsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadReminderScreen = async () => {
      setTargetsHydrated(false);
      await Promise.all([loadReminders(), loadPlaylists()]);
      if (cancelled) return;

      const reminderVideoIds = useRemindersStore
        .getState()
        .reminders
        .filter((reminder) => reminder.targetType === 'video')
        .map((reminder) => reminder.targetId);

      await loadVideosByIds(reminderVideoIds);
      if (!cancelled) setTargetsHydrated(true);
    };

    void loadReminderScreen();
    return () => {
      cancelled = true;
    };
  }, [loadReminders, loadPlaylists, loadVideosByIds]);

  const targetMap = useMemo(() => {
    const map = new Map<string, string>();
    playlists.forEach((p) => map.set(p.id, p.name));
    videos.forEach((v) => map.set(v.id, v.title));
    return map;
  }, [playlists, videos]);

  const getTargetName = useCallback(
    (reminder: Reminder): string => {
      const name = targetMap.get(reminder.targetId);
      if (name) return name;
      return reminder.targetType === 'playlist'
        ? t('unknownPlaylist')
        : reminder.title || t('unknownVideo');
    },
    [targetMap, t]
  );

  const handleCreate = () => {
    setEditingReminder(null);
    setIsModalOpen(true);
  };

  const handleEdit = async (reminder: Reminder) => {
    if (reminder.targetType === 'video') {
      await loadVideosByIds([reminder.targetId]);
    }
    setEditingReminder(reminder);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingReminder(null);
  };

  const handleSubmit = async (data: ReminderFormData) => {
    try {
      if (editingReminder) {
        await updateReminder(editingReminder.id, {
          title: data.title,
          targetType: data.targetType,
          targetId: data.targetId,
          time: data.time,
          repeat: data.repeat,
          customDays: data.customDays,
          soundPath: data.soundPath,
          volume: data.volume,
        });
      } else {
        await createReminder({
          title: data.title,
          enabled: true,
          targetType: data.targetType,
          targetId: data.targetId,
          time: data.time,
          repeat: data.repeat,
          customDays: data.customDays,
          soundPath: data.soundPath,
          volume: data.volume,
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save reminder:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteReminderConfirm'))) return;
    try {
      await deleteReminder(id);
    } catch (error) {
      console.error('Failed to delete reminder:', error);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleReminder(id);
    } catch (error) {
      console.error('Failed to toggle reminder:', error);
    }
  };

  const brokenReminders = useMemo(() => {
    if (!targetsHydrated) return [];
    return reminders.filter((r) => !targetMap.has(r.targetId));
  }, [reminders, targetMap, targetsHydrated]);

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      // Sort by enabled first, then by time
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.time.localeCompare(b.time);
    });
  }, [reminders]);

  const activeCount = useMemo(() => reminders.filter((reminder) => reminder.enabled).length, [reminders]);
  const nextReminder = useMemo(() => {
    return reminders
      .filter((reminder) => reminder.enabled)
      .map((reminder) => ({ reminder, due: getNextReminderOccurrence(reminder) }))
      .filter((item): item is { reminder: Reminder; due: Date } => Boolean(item.due))
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0]?.reminder ?? null;
  }, [reminders]);

  const nextDueLabel = nextReminder
    ? formatReminderDueLabel(nextReminder, language, t('dueToday'), t('dueTomorrow'), t('noUpcomingReminders'))
    : t('noUpcomingReminders');
  const showInitialLoading = remindersLoading && reminders.length === 0;

  return (
    <div className="page-container">
      <div className="content-max-width">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="icon-medallion h-9 w-9">
              <Bell className="h-5 w-5 text-primary-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">{t('remindersTitle')}</h1>
              <p className="text-xs text-muted-text">
                {reminders.length} {t('remindersCount')}
              </p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="btn-primary px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            {t('createReminder')}
          </button>
        </div>

        {!showInitialLoading && reminders.length > 0 && (
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <ReminderMetric icon={Bell} label={t('activeReminders')} value={activeCount.toLocaleString()} />
            <ReminderMetric icon={Clock} label={t('nextDue')} value={nextDueLabel} />
            <ReminderMetric icon={AlertTriangle} label={t('brokenTargets')} value={brokenReminders.length.toLocaleString()} tone={brokenReminders.length > 0 ? 'warning' : 'normal'} />
          </div>
        )}

        {remindersError && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning-orange/20 bg-warning-orange/10 p-3 text-sm text-warning-orange">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{remindersError}</span>
          </div>
        )}

        {/* Loading */}
        {showInitialLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-border border-t-primary-blue rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!showInitialLoading && reminders.length === 0 && (
          <div className="premium-card ornate-corner relative flex flex-col items-center justify-center rounded-xl border-dashed py-20">
            <div className="icon-medallion mb-4 h-14 w-14">
              <Clock className="h-7 w-7 text-primary-blue/70" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">
              {t('noRemindersYet')}
            </h3>
            <p className="text-sm text-muted-text text-center max-w-xs mb-5">
              {t('noRemindersDescription')}
            </p>
            <button
              onClick={handleCreate}
              className="btn-primary px-4 py-2"
            >
              <Plus className="w-4 h-4" />
              {t('createReminder')}
            </button>
          </div>
        )}

        {/* Reminders List */}
        {!showInitialLoading && reminders.length > 0 && (
          <div className="space-y-2.5">
            {sortedReminders.map((reminder) => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                targetName={getTargetName(reminder)}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Broken references warning */}
        {!showInitialLoading && brokenReminders.length > 0 && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-warning-orange/10 border border-warning-orange/20">
            <AlertTriangle className="w-4 h-4 text-warning-orange flex-shrink-0 mt-0.5" />
            <div className="text-xs text-warning-orange">
              <span className="font-medium">{t('brokenTargets')}:</span>{' '}
              {t('brokenTargetsDescription')}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <ReminderModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingReminder ? t('editReminder') : t('createReminder')}
      >
        <ReminderForm
          reminder={editingReminder}
          playlists={playlists}
          videos={videos}
          onNeedVideos={loadVideos}
          onSubmit={handleSubmit}
          onCancel={handleCloseModal}
          submitLabel={editingReminder ? t('saveChanges') : t('createReminder')}
        />
      </ReminderModal>
    </div>
  );
};

const ReminderMetric: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: 'normal' | 'warning';
}> = ({ icon: Icon, label, value, tone = 'normal' }) => (
  <div className={`premium-card flex min-w-0 items-center gap-3 rounded-lg p-4 ${
    tone === 'warning' ? 'border-warning-orange/25 bg-warning-orange/5' : ''
  }`}>
    <div className={`icon-medallion h-10 w-10 shrink-0 ${
      tone === 'warning' ? 'border-warning-orange/25 bg-warning-orange/10 text-warning-orange' : ''
    }`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-text">{label}</p>
      <p className="truncate text-sm font-semibold text-text-primary" title={value}>{value}</p>
    </div>
  </div>
);
