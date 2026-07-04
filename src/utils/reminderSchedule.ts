import { Reminder } from '@/types';
import type { AppLanguage } from '@/types';
import { dayLabels } from '@/i18n';

export const parseReminderTime = (time: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
};

export const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isReminderScheduledForDate = (reminder: Reminder, due: Date) => {
  const day = due.getDay();
  if (reminder.repeat === 'custom') {
    return reminder.customDays?.includes(day) ?? false;
  }
  if (reminder.repeat === 'weekly') {
    const createdAt = reminder.createdAt ? new Date(reminder.createdAt) : due;
    return createdAt.getDay() === day;
  }
  return true;
};

export const getNextReminderOccurrence = (reminder: Reminder, from = new Date()) => {
  const parsed = parseReminderTime(reminder.time);
  if (!parsed || !reminder.enabled) return null;

  const createdAt = reminder.createdAt ? new Date(reminder.createdAt) : from;
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(from);
    candidate.setDate(from.getDate() + offset);
    candidate.setHours(parsed.hours, parsed.minutes, 0, 0);

    if (candidate.getTime() <= from.getTime()) continue;
    if (!isReminderScheduledForDate(reminder, candidate)) continue;

    if (reminder.repeat === 'none' && candidate.getTime() < createdAt.getTime() - 60_000) {
      continue;
    }

    return candidate;
  }

  return null;
};

export const formatReminderTime = (time: string, language: AppLanguage = 'en') => {
  const parsed = parseReminderTime(time);
  if (!parsed) return time;
  const date = new Date();
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date.toLocaleTimeString(language === 'ar' ? 'ar' : undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatReminderDueLabel = (
  reminder: Reminder,
  language: AppLanguage,
  todayLabel: string,
  tomorrowLabel: string,
  noneLabel: string,
) => {
  const due = getNextReminderOccurrence(reminder);
  if (!due) return noneLabel;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const dayName = dayLabels[language][due.getDay()];
  const formattedTime = due.toLocaleTimeString(language === 'ar' ? 'ar' : undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (localDateKey(due) === localDateKey(now)) return `${todayLabel} ${formattedTime}`;
  if (localDateKey(due) === localDateKey(tomorrow)) return `${tomorrowLabel} ${formattedTime}`;
  return `${dayName} ${formattedTime}`;
};
