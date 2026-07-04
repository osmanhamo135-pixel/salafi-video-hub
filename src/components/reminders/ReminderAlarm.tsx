import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { Bell, Clock, ExternalLink, TimerReset, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Playlist, Reminder, Video } from '@/types';
import { usePlayerStore } from '@/store/playerStore';
import { useRemindersStore } from '@/store/remindersStore';
import { useSettingsStore } from '@/store/settingsStore';
import { playReminderSound, stopReminderSound } from '@/utils/reminderAudio';
import { formatReminderTime, isReminderScheduledForDate, localDateKey, parseReminderTime } from '@/utils/reminderSchedule';
import { useI18n } from '@/i18n';

const CHECK_INTERVAL_MS = 10_000;
const DUE_WINDOW_MS = 10 * 60_000;
const SNOOZE_MS = 5 * 60_000;

interface ReminderAlarmItem {
  eventId: string;
  reminder: Reminder;
  targetName: string;
  firedKey: string;
  source: 'schedule' | 'snooze';
}

interface DueReminder {
  firedKey: string;
  dueAt: number;
}

interface SnoozedReminder {
  eventId: string;
  reminder: Reminder;
  dueAt: number;
}

export const ReminderAlarm: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const [alarmQueue, setAlarmQueue] = useState<ReminderAlarmItem[]>([]);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const sessionFiredKeys = useRef(new Set<string>());
  const snoozedReminders = useRef<SnoozedReminder[]>([]);

  const activeAlarm = alarmQueue[0] ?? null;

  const enqueueAlarm = useCallback((alarm: ReminderAlarmItem) => {
    setAlarmQueue((current) => {
      if (current.some((item) => item.eventId === alarm.eventId)) return current;
      return [...current, alarm];
    });
  }, []);

  const markReminderTriggered = useCallback((reminder: Reminder, firedKey: string) => {
    const triggeredAt = Date.now();
    void invoke('mark_reminder_triggered', {
      id: reminder.id,
      firedKey,
      triggeredAt,
      disableIfOneTime: reminder.repeat === 'none',
    })
      .then(() => useRemindersStore.getState().loadReminders())
      .catch((error) => {
        console.error('Failed to mark reminder as triggered:', error);
      });
  }, []);

  const checkReminders = useCallback(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const { reminders, playlists, videos } = useRemindersStore.getState();

    const remainingSnoozes: SnoozedReminder[] = [];
    for (const snoozed of snoozedReminders.current) {
      if (snoozed.dueAt <= nowMs) {
        enqueueAlarm({
          eventId: snoozed.eventId,
          reminder: snoozed.reminder,
          targetName: getTargetName(snoozed.reminder, playlists, videos),
          firedKey: snoozed.eventId,
          source: 'snooze',
        });
      } else {
        remainingSnoozes.push(snoozed);
      }
    }
    snoozedReminders.current = remainingSnoozes;

    for (const reminder of reminders) {
      if (!reminder.enabled) continue;

      const due = getDueReminder(reminder, now);
      if (!due) continue;
      if (reminder.lastFiredKey === due.firedKey) continue;
      if (sessionFiredKeys.current.has(due.firedKey)) continue;

      sessionFiredKeys.current.add(due.firedKey);
      markReminderTriggered(reminder, due.firedKey);
      enqueueAlarm({
        eventId: due.firedKey,
        reminder,
        targetName: getTargetName(reminder, playlists, videos),
        firedKey: due.firedKey,
        source: 'schedule',
      });
    }
  }, [enqueueAlarm, markReminderTriggered]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      await Promise.all([
        useRemindersStore.getState().loadReminders(),
        useRemindersStore.getState().loadPlaylists(),
        loadSettings(),
      ]);
      const reminderVideoIds = useRemindersStore
        .getState()
        .reminders
        .filter((reminder) => reminder.enabled && reminder.targetType === 'video')
        .map((reminder) => reminder.targetId);
      await useRemindersStore.getState().loadVideosByIds(reminderVideoIds);
      if (!cancelled) checkReminders();
    };

    void start();
    const interval = window.setInterval(checkReminders, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      stopReminderSound();
    };
  }, [checkReminders, loadSettings]);

  useEffect(() => {
    if (!activeAlarm) return;

    const soundPath = activeAlarm.reminder.soundPath || settings?.reminderSoundPath || null;
    const volume = activeAlarm.reminder.volume ?? settings?.reminderVolume ?? 80;

    setAudioMessage(null);
    playReminderSound({ soundPath, volume }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setAudioMessage(message || 'Click Test Sound once to allow reminder audio.');
    });

    sendReminderDesktopNotification(activeAlarm).catch((error) => {
      console.error('Failed to send reminder notification:', error);
    });

    return () => {
      stopReminderSound();
    };
  }, [activeAlarm, settings?.reminderSoundPath, settings?.reminderVolume]);

  const dismissActive = useCallback(() => {
    setAlarmQueue((current) => current.slice(1));
    setAudioMessage(null);
    stopReminderSound();
  }, []);

  const snoozeActive = useCallback(() => {
    if (!activeAlarm) return;

    const dueAt = Date.now() + SNOOZE_MS;
    snoozedReminders.current.push({
      eventId: `${activeAlarm.reminder.id}:snooze:${dueAt}`,
      reminder: activeAlarm.reminder,
      dueAt,
    });
    dismissActive();
  }, [activeAlarm, dismissActive]);

  const openTarget = useCallback(async () => {
    if (!activeAlarm) return;

    let { playlists, videos } = useRemindersStore.getState();
    if (activeAlarm.reminder.targetType === 'playlist') {
      await usePlayerStore.getState().openPlaylist(activeAlarm.reminder.targetId);
      dismissActive();
      return;
    }

    if (!videos.some((item) => item.id === activeAlarm.reminder.targetId)) {
      await useRemindersStore.getState().loadVideosByIds([activeAlarm.reminder.targetId]);
      ({ playlists, videos } = useRemindersStore.getState());
    }

    const video = videos.find((item) => item.id === activeAlarm.reminder.targetId);
    const playlist = findPlaylistForVideo(activeAlarm.reminder.targetId, video, playlists);
    if (playlist) {
      await usePlayerStore.getState().openPlaylist(playlist.id, activeAlarm.reminder.targetId);
    } else {
      navigate('/library');
    }
    dismissActive();
  }, [activeAlarm, dismissActive, navigate]);

  const formattedTime = useMemo(() => {
    if (!activeAlarm) return '';
    return formatReminderTime(activeAlarm.reminder.time, language);
  }, [activeAlarm, language]);

  if (!activeAlarm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="premium-surface ornate-corner relative w-full max-w-md rounded-lg shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="icon-medallion h-10 w-10 shrink-0">
            <Bell className="h-5 w-5 text-primary-blue" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-text">{t('reminder')}</p>
            <h2 className="mt-0.5 truncate text-base font-semibold text-text-primary">
              {activeAlarm.reminder.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={dismissActive}
            className="rounded-md p-1.5 text-muted-text transition-colors hover:bg-elevated-panel hover:text-text-primary"
            title={t('dismiss')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-md border border-border bg-background px-3 py-2.5">
            <p className="truncate text-sm font-medium text-text-primary" title={activeAlarm.targetName}>
              {activeAlarm.targetName}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-text">
              <Clock className="h-3.5 w-3.5" />
              <span>{formattedTime}</span>
              {activeAlarm.source === 'snooze' && <span>{t('snoozed')}</span>}
            </div>
          </div>

          {audioMessage && (
            <div className="mt-3 rounded-md border border-warning-orange/25 bg-warning-orange/10 px-3 py-2 text-xs text-warning-orange">
              {audioMessage}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={dismissActive}
            className="btn-secondary px-3 py-2"
          >
            {t('dismiss')}
          </button>
          <button
            type="button"
            onClick={snoozeActive}
            className="btn-secondary px-3 py-2"
          >
            <TimerReset className="h-4 w-4" />
            {t('snoozeFive')}
          </button>
          <button
            type="button"
            onClick={() => {
              openTarget().catch(console.error);
            }}
            className="btn-primary px-3 py-2"
          >
            <ExternalLink className="h-4 w-4" />
            {t('openTarget')}
          </button>
        </div>
      </div>
    </div>
  );
};

const getDueReminder = (reminder: Reminder, now: Date): DueReminder | null => {
  const parsed = parseReminderTime(reminder.time);
  if (!parsed) return null;

  for (const dayOffset of [0, -1]) {
    const due = new Date(now);
    due.setDate(now.getDate() + dayOffset);
    due.setHours(parsed.hours, parsed.minutes, 0, 0);
    const dueAt = due.getTime();
    const diff = now.getTime() - dueAt;

    if (diff < 0 || diff > DUE_WINDOW_MS) continue;
    if (!isReminderScheduledForDate(reminder, due)) continue;

    if (reminder.repeat === 'none' && reminder.createdAt > dueAt + DUE_WINDOW_MS) {
      continue;
    }

    return {
      dueAt,
      firedKey: `${reminder.id}:${localDateKey(due)}:${reminder.time}`,
    };
  }

  return null;
};

const getTargetName = (reminder: Reminder, playlists: Playlist[], videos: Video[]) => {
  if (reminder.targetType === 'playlist') {
    return playlists.find((playlist) => playlist.id === reminder.targetId)?.name ?? 'Unknown Playlist';
  }
  return videos.find((video) => video.id === reminder.targetId)?.title ?? 'Unknown Video';
};

const findPlaylistForVideo = (
  videoId: string,
  video: Video | undefined,
  playlists: Playlist[],
) => {
  return playlists.find((playlist) => playlist.videoIds.includes(videoId))
    ?? (video ? playlists.find((playlist) => playlist.folderPath === video.folderPath) : undefined);
};

const sendReminderDesktopNotification = async (alarm: ReminderAlarmItem) => {
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  if (!permissionGranted) return;

  sendNotification({
    id: hashToInt(alarm.eventId),
    title: alarm.reminder.title,
    body: alarm.targetName,
  });
};

const hashToInt = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_147_483_647;
};
