import React from 'react';
import { Reminder } from '@/types';
import { Pencil, Trash2, Repeat, Film, ListVideo } from 'lucide-react';
import { repeatLabelKeys, useI18n } from '@/i18n';
import { formatReminderDueLabel } from '@/utils/reminderSchedule';

interface ReminderCardProps {
  reminder: Reminder;
  targetName: string;
  onToggle: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  targetName,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const { language, shortDays, t } = useI18n();
  const dueLabel = formatReminderDueLabel(
    reminder,
    language,
    t('dueToday'),
    t('dueTomorrow'),
    reminder.enabled ? t('noUpcomingReminders') : t('disabled'),
  );
  const repeatLabel = t(repeatLabelKeys[reminder.repeat]);

  return (
    <div className="rule-row gap-4 py-3.5">
      {/* Toggle Switch */}
      {/* Smaller, and the "on" track is a tint rather than a solid accent fill.
          At full saturation it was the loudest thing on the page — a control
          shouting over the reminder it belongs to. The knob carries the accent
          instead, which is enough to read state at a glance. */}
      <button
        onClick={() => onToggle(reminder.id)}
        className={`relative h-5 w-9 flex-shrink-0 rounded-full border transition-colors duration-150 motion-reduce:transition-none ${
          reminder.enabled
            ? 'border-accent-gold/40 bg-accent-gold/20'
            : 'border-border-strong/60 bg-border-strong/30 hover:border-border-strong'
        }`}
        aria-label={reminder.enabled ? t('disableReminder') : t('enableReminder')}
        aria-pressed={reminder.enabled}
      >
        {/* Logical inset and an RTL-flipped travel: with `left` + `translate-x`
            alone the knob slid the wrong way on the Arabic layout. */}
        <span
          className={`absolute start-[3px] top-[3px] h-3 w-3 rounded-full transition-transform duration-150 motion-reduce:transition-none ${
            reminder.enabled
              ? 'translate-x-4 bg-accent-gold rtl:-translate-x-4'
              : 'translate-x-0 bg-muted-text'
          }`}
        />
      </button>

      {/* The time leads, at a fixed measure, so a column of reminders reads down
          as times — which is the thing you actually scan a reminder list for.
          It used to sit inside a 12px metadata line behind the title. */}
      <div className="w-[124px] shrink-0 text-start">
        <p
          className={`text-lg font-semibold tabular-nums leading-none ${
            reminder.enabled ? 'text-accent-gold' : 'text-text-faint'
          }`}
        >
          <bdi>{reminder.time}</bdi>
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-text">
          <bdi>{dueLabel}</bdi>
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <h3
            className={`truncate text-[15px] font-medium ${
              reminder.enabled ? 'text-text-primary' : 'text-muted-text line-through'
            }`}
          >
            <bdi>{reminder.title}</bdi>
          </h3>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-muted-text">
          {reminder.targetType === 'video' ? (
            <Film className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ListVideo className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate"><bdi>{targetName}</bdi></span>
          <span className="text-text-faint">·</span>
          <span className="flex shrink-0 items-center gap-1">
            <Repeat className="h-3 w-3" />
            {repeatLabel}
            {reminder.repeat === 'custom' && reminder.customDays && reminder.customDays.length > 0 && (
              <bdi className="ms-0.5 text-[10px]">
                ({reminder.customDays.map((day) => shortDays[day]).join(', ')})
              </bdi>
            )}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(reminder)}
          className="icon-btn"
          aria-label={t('edit')}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(reminder.id)}
          className="icon-btn hover:text-danger-red"
          aria-label={t('delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
