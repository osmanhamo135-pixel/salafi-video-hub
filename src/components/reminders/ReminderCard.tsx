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
      <button
        onClick={() => onToggle(reminder.id)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
          reminder.enabled ? 'bg-accent-gold' : 'bg-border-strong'
        }`}
        aria-label={reminder.enabled ? t('disableReminder') : t('enableReminder')}
        aria-pressed={reminder.enabled}
      >
        {/* Logical inset and an RTL-flipped travel: with `left` + `translate-x`
            alone the knob slid the wrong way on the Arabic layout. */}
        <span
          className={`absolute start-0.5 top-0.5 h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${
            reminder.enabled ? 'translate-x-5 bg-background rtl:-translate-x-5' : 'translate-x-0 bg-muted-text'
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
