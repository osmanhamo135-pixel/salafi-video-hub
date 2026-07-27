import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Reminder } from '@/types';
import { useRemindersStore } from '@/store/remindersStore';
import { ReminderCard } from '@/components/reminders/ReminderCard';
import { ReminderModal } from '@/components/reminders/ReminderModal';
import { ReminderForm, ReminderFormData } from '@/components/reminders/ReminderForm';
import { Bell, Plus, Clock, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n';
import { formatReminderDueLabel, getNextReminderOccurrence } from '@/utils/reminderSchedule';
import { SectionHead } from '@/components/ui/SectionHead';

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

  /* Today / Upcoming / Paused, because "when does the next one fire" is the
     only question this page is ever opened to answer. Within a group the sort
     is by next occurrence, not by wall-clock string — an 06:00 daily reminder
     read after 06:00 belongs to tomorrow, and localeCompare on "06:00" put it
     ahead of a 22:00 one that still fires tonight. */
  const grouped = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const today: Reminder[] = [];
    const upcoming: Reminder[] = [];
    const paused: Reminder[] = [];
    const nextAt = new Map<string, number>();

    for (const r of reminders) {
      if (!r.enabled) {
        paused.push(r);
        continue;
      }
      const due = getNextReminderOccurrence(r);
      nextAt.set(r.id, due ? due.getTime() : Number.MAX_SAFE_INTEGER);
      if (due && due <= endOfToday) today.push(r);
      else upcoming.push(r);
    }

    const byDue = (a: Reminder, b: Reminder) =>
      (nextAt.get(a.id) ?? 0) - (nextAt.get(b.id) ?? 0);
    today.sort(byDue);
    upcoming.sort(byDue);
    paused.sort((a, b) => a.time.localeCompare(b.time));

    return { today, upcoming, paused };
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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-normal text-text-primary">{t('remindersTitle')}</h1>
            <p className="mt-1 text-sm text-muted-text">
              <bdi>{reminders.length}</bdi> {t('remindersCount')}
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="btn-primary shrink-0 px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            {t('createReminder')}
          </button>
        </div>

        {!showInitialLoading && reminders.length > 0 && (
          <div className="reveal mb-6 grid gap-x-10 md:grid-cols-3">
            <ReminderMetric icon={Bell} label={t('activeReminders')} value={activeCount.toLocaleString()} />
            <ReminderMetric icon={Clock} label={t('nextDue')} value={nextDueLabel} />
            <ReminderMetric icon={AlertTriangle} label={t('brokenTargets')} value={brokenReminders.length.toLocaleString()} tone={brokenReminders.length > 0 ? 'warning' : 'normal'} />
          </div>
        )}

        {remindersError && (
          <div className="mb-4 flex items-start gap-2 border-b border-warning-orange/30 pb-3 text-sm text-warning-orange">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span dir="auto">{remindersError}</span>
          </div>
        )}

        {/* Loading */}
        {showInitialLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-border border-t-muted-text rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!showInitialLoading && reminders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <Clock className="mb-4 h-8 w-8 text-text-faint" />
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

        {/* Today first and heaviest; Upcoming next; Paused recedes to the
            bottom. The next-due card carries the accent through
            ReminderCard's own active treatment. */}
        {!showInitialLoading && reminders.length > 0 && (
          <div className="reveal space-y-8">
            {(
              [
                ['remindersToday', grouped.today],
                ['remindersUpcoming', grouped.upcoming],
                ['remindersPaused', grouped.paused],
              ] as const
            ).map(([labelKey, list]) =>
              list.length === 0 ? null : (
                <section key={labelKey}>
                  <SectionHead
                    className="mb-1"
                    title={t(labelKey)}
                    meta={<bdi>{list.length}</bdi>}
                  />
                  <div className={`rule-list ${labelKey === 'remindersPaused' ? 'opacity-70' : ''}`}>
                    {list.map((reminder) => (
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
                </section>
              ),
            )}
          </div>
        )}

        {/* Broken references warning */}
        {!showInitialLoading && brokenReminders.length > 0 && (
          <div className="mt-5 flex items-start gap-2 border-t border-warning-orange/30 pt-3">
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
  <div className="rule-row min-w-0 gap-3">
    <Icon className={`h-4 w-4 shrink-0 ${tone === 'warning' ? 'text-warning-orange' : 'text-muted-text'}`} />
    <div className="min-w-0">
      <p className="text-xs text-muted-text">{label}</p>
      <p
        className={`truncate text-sm font-medium ${tone === 'warning' ? 'text-warning-orange' : 'text-text-primary'}`}
        title={value}
      >
        <bdi>{value}</bdi>
      </p>
    </div>
  </div>
);
