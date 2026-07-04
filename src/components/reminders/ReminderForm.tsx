import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Reminder, Playlist, Video } from '@/types';
import { Volume2, Volume1, VolumeX, Play, AlertCircle } from 'lucide-react';
import { playReminderSound, stopReminderSound } from '@/utils/reminderAudio';
import { useI18n } from '@/i18n';

interface ReminderFormProps {
  reminder?: Reminder | null;
  playlists: Playlist[];
  videos: Video[];
  onNeedVideos?: () => void | Promise<void>;
  onSubmit: (data: ReminderFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}

export interface ReminderFormData {
  title: string;
  targetType: 'video' | 'playlist';
  targetId: string;
  time: string;
  repeat: 'none' | 'daily' | 'weekly' | 'custom';
  customDays: number[];
  soundPath: string | null;
  volume: number;
}

const DAYS = [
  { value: 0 },
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
];

const defaultFormData: ReminderFormData = {
  title: '',
  targetType: 'playlist',
  targetId: '',
  time: '08:00',
  repeat: 'none',
  customDays: [],
  soundPath: null,
  volume: 80,
};

export const ReminderForm: React.FC<ReminderFormProps> = ({
  reminder,
  playlists,
  videos,
  onNeedVideos,
  onSubmit,
  onCancel,
  submitLabel,
}) => {
  const { t, shortDays } = useI18n();
  const [form, setForm] = useState<ReminderFormData>(defaultFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testingSound, setTestingSound] = useState(false);
  const [soundMessage, setSoundMessage] = useState<string | null>(null);

  useEffect(() => {
    if (reminder) {
      setForm({
        title: reminder.title,
        targetType: reminder.targetType,
        targetId: reminder.targetId,
        time: reminder.time,
        repeat: reminder.repeat,
        customDays: reminder.customDays || [],
        soundPath: reminder.soundPath,
        volume: reminder.volume,
      });
    } else {
      setForm(defaultFormData);
    }
    setErrors({});
    setSoundMessage(null);
  }, [reminder]);

  useEffect(() => () => stopReminderSound(), []);

  const targetOptions = useMemo(
    () => (
      form.targetType === 'playlist'
        ? playlists.map((p) => ({ value: p.id, label: p.name }))
        : videos.map((v) => ({ value: v.id, label: v.title }))
    ),
    [form.targetType, playlists, videos],
  );

  useEffect(() => {
    if (form.targetId || targetOptions.length === 0) return;
    setForm((prev) => ({ ...prev, targetId: targetOptions[0].value }));
  }, [form.targetId, targetOptions]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.title.trim()) {
      newErrors.title = t('titleRequired');
    }
    if (!form.targetId) {
      newErrors.targetId = targetOptions.length === 0 ? t('noTargetsAvailable') : t('targetRequired');
    }
    if (!form.time) {
      newErrors.time = t('timeRequired');
    }
    if (form.repeat === 'custom' && form.customDays.length === 0) {
      newErrors.customDays = t('customDaysRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, t, targetOptions.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(form);
    }
  };

  const updateField = <K extends keyof ReminderFormData>(
    field: K,
    value: ReminderFormData[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleDay = (day: number) => {
    setForm((prev) => {
      const hasDay = prev.customDays.includes(day);
      const newDays = hasDay
        ? prev.customDays.filter((d) => d !== day)
        : [...prev.customDays, day].sort();
      return { ...prev, customDays: newDays };
    });
    if (errors.customDays) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.customDays;
        return next;
      });
    }
  };

  const handleTestSound = async () => {
    try {
      setTestingSound(true);
      setSoundMessage(null);
      await playReminderSound({
        soundPath: form.soundPath,
        volume: form.volume,
      });
    } catch (error) {
      console.error('Failed to test sound:', error);
      setSoundMessage(error instanceof Error ? error.message : String(error));
    } finally {
      window.setTimeout(() => {
        stopReminderSound();
        setTestingSound(false);
      }, 1000);
    }
  };

  const handlePickSound = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }],
      });
      if (!selected || Array.isArray(selected)) return;
      updateField('soundPath', selected);
    } catch (error) {
      setSoundMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const setTestReminderTime = () => {
    const testTime = new Date(Date.now() + 60_000);
    const time = `${String(testTime.getHours()).padStart(2, '0')}:${String(testTime.getMinutes()).padStart(2, '0')}`;
    setForm((prev) => ({
      ...prev,
      title: prev.title.trim() ? prev.title : t('reminder'),
      time,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.title;
      delete next.time;
      return next;
    });
  };

  const VolumeIcon =
    form.volume === 0 ? VolumeX : form.volume < 50 ? Volume1 : Volume2;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-muted-text mb-1.5">
          {t('reminderTitleLabel')}
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder={t('reminderTitlePlaceholder')}
          className={`surface-input w-full ${
            errors.title ? 'border-danger-red' : 'border-border'
          }`}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-danger-red flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.title}
          </p>
        )}
      </div>

      {/* Target Type & Selector */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-text mb-1.5">
            {t('targetType')}
          </label>
          <div className="flex overflow-hidden rounded-md border border-border bg-background">
            <button
              type="button"
              onClick={() => {
                updateField('targetType', 'playlist');
                updateField('targetId', '');
              }}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                form.targetType === 'playlist'
                  ? 'bg-primary-blue text-[#03110f]'
                  : 'text-muted-text hover:text-text-primary'
              }`}
            >
              {t('playlist')}
            </button>
            <button
              type="button"
              onClick={() => {
                updateField('targetType', 'video');
                updateField('targetId', '');
                void onNeedVideos?.();
              }}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                form.targetType === 'video'
                  ? 'bg-primary-blue text-[#03110f]'
                  : 'text-muted-text hover:text-text-primary'
              }`}
            >
              {t('video')}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-text mb-1.5">
            {t('selectTarget')}
          </label>
          <select
            value={form.targetId}
            onChange={(e) => updateField('targetId', e.target.value)}
            className={`surface-input w-full ${
              errors.targetId ? 'border-danger-red' : 'border-border'
            } appearance-none`}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237E8AA1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          >
            <option value="" disabled>
              {t('choose')}
            </option>
            {targetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.targetId && (
            <p className="mt-1 text-xs text-danger-red flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.targetId}
            </p>
          )}
        </div>
      </div>

      {/* Time & Repeat */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-muted-text">
              {t('time')}
            </label>
            <button
              type="button"
              onClick={setTestReminderTime}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary-blue hover:bg-primary-blue/10"
            >
              {t('testInOneMinute')}
            </button>
          </div>
          <input
            type="time"
            value={form.time}
            onChange={(e) => updateField('time', e.target.value)}
            className={`surface-input w-full ${
              errors.time ? 'border-danger-red' : 'border-border'
            }`}
          />
          {errors.time && (
            <p className="mt-1 text-xs text-danger-red flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.time}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-text mb-1.5">
            {t('repeat')}
          </label>
          <select
            value={form.repeat}
            onChange={(e) =>
              updateField(
                'repeat',
                e.target.value as ReminderFormData['repeat']
              )
            }
            className="surface-input w-full appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237E8AA1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
          >
            <option value="none">{t('noRepeat')}</option>
            <option value="daily">{t('daily')}</option>
            <option value="weekly">{t('weekly')}</option>
            <option value="custom">{t('customDays')}</option>
          </select>
        </div>
      </div>

      {/* Custom Days */}
      {form.repeat === 'custom' && (
        <div>
          <label className="block text-xs font-medium text-muted-text mb-1.5">
            {t('days')}
          </label>
          <div className="flex gap-1.5">
            {DAYS.map((day) => {
              const isSelected = form.customDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-semibold transition-colors ${
                    isSelected
                      ? 'bg-primary-blue text-background'
                      : 'border border-border bg-background text-muted-text hover:text-text-primary'
                  }`}
                >
                  {shortDays[day.value]}
                </button>
              );
            })}
          </div>
          {errors.customDays && (
            <p className="mt-1 text-xs text-danger-red flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.customDays}
            </p>
          )}
        </div>
      )}

      {/* Sound Path */}
      <div>
        <label className="block text-xs font-medium text-muted-text mb-1.5">
          {t('soundFileOptional')}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={form.soundPath || ''}
            onChange={(e) =>
              updateField('soundPath', e.target.value || null)
            }
            placeholder={t('leaveEmptyDefaultSound')}
            className="surface-input min-w-0 flex-1"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handlePickSound}
              className="btn-secondary px-3 py-2 text-xs"
            >
              {t('browse')}
            </button>
            <button
              type="button"
              onClick={() => updateField('soundPath', null)}
              className="btn-secondary px-3 py-2 text-xs"
            >
              {t('clear')}
            </button>
          </div>
        </div>
      </div>

      {/* Volume + Test */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-muted-text">{t('volume')}</label>
          <span className="text-xs text-muted-text">{form.volume}%</span>
        </div>
        <div className="flex items-center gap-3">
          <VolumeIcon className="w-4 h-4 text-muted-text flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            value={form.volume}
            onChange={(e) => updateField('volume', Number(e.target.value))}
            className="flex-1 h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-primary-blue"
            style={{
              background: `linear-gradient(to right, #0FB9B1 ${form.volume}%, rgba(45, 207, 200, 0.12) ${form.volume}%)`,
            }}
          />
          <button
            type="button"
            onClick={handleTestSound}
            disabled={testingSound}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border bg-elevated-panel px-3 py-1.5 text-xs text-muted-text transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
          >
            <Play className={`w-3 h-3 ${testingSound ? 'text-primary-blue' : ''}`} />
            {testingSound ? t('playing') : t('test')}
          </button>
        </div>
        {soundMessage && (
          <p className="mt-2 text-xs text-warning-orange">
            {soundMessage}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary px-4 py-2"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          className="btn-primary px-4 py-2"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};
