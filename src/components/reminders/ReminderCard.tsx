import React from 'react';
import { Reminder } from '@/types';
import { Pencil, Trash2, Clock, Repeat, Film, ListVideo } from 'lucide-react';
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
    <div className="rule-row gap-4">
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3
            dir="auto"
            className={`text-sm font-medium truncate ${
              reminder.enabled ? 'text-text-primary' : 'text-muted-text line-through'
            }`}
          >
            {reminder.title}
          </h3>
          {reminder.targetType === 'video' ? (
            <Film className="w-3.5 h-3.5 text-muted-text flex-shrink-0" />
          ) : (
            <ListVideo className="w-3.5 h-3.5 text-muted-text flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-text">
          <span dir="auto" className="truncate">{targetName}</span>
          <span className="flex flex-shrink-0 items-center gap-1">
            <Clock className="w-3 h-3" />
            <bdi>{dueLabel}</bdi>
          </span>
          <span className="flex flex-shrink-0 items-center gap-1">
            <Repeat className="w-3 h-3" />
            {repeatLabel}
            {reminder.repeat === 'custom' && reminder.customDays && reminder.customDays.length > 0 && (
              <bdi className="text-[10px] ms-0.5">
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
