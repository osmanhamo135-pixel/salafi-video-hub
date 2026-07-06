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
    <div className="premium-card premium-card-hover flex items-center gap-4 rounded-lg p-4">
      {/* Toggle Switch */}
      <button
        onClick={() => onToggle(reminder.id)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-blue/30 ${
          reminder.enabled ? 'bg-primary-blue' : 'bg-border'
        }`}
        aria-label={reminder.enabled ? t('disableReminder') : t('enableReminder')}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            reminder.enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3
            className={`text-sm font-semibold truncate ${
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
          <span className="truncate">{targetName}</span>
          <span className="flex flex-shrink-0 items-center gap-1 rounded-md border border-primary-blue/15 bg-primary-blue/10 px-2 py-0.5 text-primary-blue">
            <Clock className="w-3 h-3" />
            {dueLabel}
          </span>
          <span className="flex flex-shrink-0 items-center gap-1 rounded-md border border-accent-gold/20 bg-accent-gold/10 px-2 py-0.5 text-accent-gold">
            <Repeat className="w-3 h-3" />
            {repeatLabel}
            {reminder.repeat === 'custom' && reminder.customDays && reminder.customDays.length > 0 && (
              <span className="text-[10px] ms-0.5">
                ({reminder.customDays.map((day) => shortDays[day]).join(', ')})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(reminder)}
          className="p-2 rounded-md text-muted-text hover:text-text-primary hover:bg-elevated-panel transition-colors"
          aria-label={t('edit')}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(reminder.id)}
          className="p-2 rounded-md text-muted-text hover:text-danger-red hover:bg-danger-red/10 transition-colors"
          aria-label={t('delete')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
