import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Reminder, Playlist, Video } from '@/types';
import { Volume2, Volume1, VolumeX, Play, AlertCircle, FolderOpen, X } from 'lucide-react';
import { playReminderSound, stopReminderSound } from '@/utils/reminderAudio';
import { useI18n } from '@/i18n';
import { Select } from '@/components/ui/Select';

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
          dir="auto"
          value={form.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder={t('reminderTitlePlaceholder')}
          className={`field-quiet text-sm ${errors.title ? 'border-b-danger-red' : ''}`}
        />
        {errors.title && (
          <p className="mt-1 text-xs text-danger-red flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors.title}
          </p>
        )}
      </div>

      {/* Target Type & Selector */}
      <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0">
        <div>
          <label className="block text-xs font-medium text-muted-text mb-1.5">
            {t('targetType')}
          </label>
          <div className="segmented py-1.5" role="group" aria-label={t('targetType')}>
            <button
              type="button"
              aria-pressed={form.targetType === 'playlist'}
              onClick={() => {
                updateField('targetType', 'playlist');
                updateField('targetId', '');
              }}
            >
              {t('playlist')}
            </button>
            <button
              type="button"
              aria-pressed={form.targetType === 'video'}
              onClick={() => {
                updateField('targetType', 'video');
                updateField('targetId', '');
                void onNeedVideos?.();
              }}
            >
              {t('video')}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-text mb-1.5">
            {t('selectTarget')}
          </label>
          {/* The chevron is the platform's own again: the hand-drawn one was a
              hardcoded #7E8AA1 pinned to the right edge — invisible on the
              light theme and on the wrong side in Arabic. */}
          <Select
            label={t('choose')}
            value={form.targetId}
            onChange={(v: string) => updateField('targetId', v)}
            className={`select-block ${errors.targetId ? 'text-danger-red' : ''}`}
            options={[
              { value: '', label: t('choose') },
              ...targetOptions.map((opt) => ({ value: opt.value, label: opt.label })),
            ]}
          />
          {errors.targetId && (
            <p className="mt-1 text-xs text-danger-red flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors.targetId}
            </p>
          )}
        </div>
      </div>

      {/* Time & Repeat */}
      <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-muted-text">
              {t('time')}
            </label>
            <button
              type="button"
              onClick={setTestReminderTime}
              className="py-0.5 text-[10px] font-medium text-muted-text transition-colors hover:text-text-primary motion-reduce:transition-none"
            >
              {t('testInOneMinute')}
            </button>
          </div>
          <input
            type="time"
            value={form.time}
            onChange={(e) => updateField('time', e.target.value)}
            className={`field-quiet text-sm ${errors.time ? 'border-b-danger-red' : ''}`}
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
          <Select
            label={t('repeat')}
            value={form.repeat}
            onChange={(v: string) => updateField('repeat', v as ReminderFormData['repeat'])}
            options={[
              { value: 'none', label: t('noRepeat') },
              { value: 'daily', label: t('daily') },
              { value: 'weekly', label: t('weekly') },
              { value: 'custom', label: t('customDays') },
            ]}
          />
        </div>
      </div>

      {/* Custom Days */}
      {form.repeat === 'custom' && (
        <div>
          <label className="block text-xs font-medium text-muted-text mb-1.5">
            {t('days')}
          </label>
          {/* Seven labels sharing one baseline rule, the selected days marked
              by the accent under them — not seven filled chips. */}
          <div className="segmented w-full justify-between" role="group" aria-label={t('days')}>
            {DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                aria-pressed={form.customDays.includes(day.value)}
                onClick={() => toggleDay(day.value)}
                className="flex-1"
              >
                {shortDays[day.value]}
              </button>
            ))}
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
        <div className="flex items-center gap-1">
          <input
            type="text"
            dir="auto"
            value={form.soundPath || ''}
            onChange={(e) =>
              updateField('soundPath', e.target.value || null)
            }
            placeholder={t('leaveEmptyDefaultSound')}
            className="field-quiet min-w-0 flex-1 text-sm"
          />
          <button
            type="button"
            onClick={handlePickSound}
            className="icon-btn shrink-0"
            aria-label={t('browse')}
            title={t('browse')}
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => updateField('soundPath', null)}
            className="icon-btn shrink-0"
            aria-label={t('clear')}
            title={t('clear')}
          >
            <X className="w-4 h-4" />
          </button>
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
            className="range-quiet flex-1"
            style={{ '--fill': form.volume } as React.CSSProperties}
          />
          <button
            type="button"
            onClick={handleTestSound}
            disabled={testingSound}
            className="inline-flex flex-shrink-0 items-center gap-1.5 py-1 text-xs font-medium text-muted-text transition-colors hover:text-text-primary disabled:opacity-50 motion-reduce:transition-none"
          >
            <Play className="w-3 h-3" />
            {testingSound ? t('playing') : t('test')}
          </button>
        </div>
        {soundMessage && (
          <p className="mt-2 text-xs text-warning-orange" dir="auto">
            {soundMessage}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center py-1 text-sm font-medium text-muted-text transition-colors hover:text-text-primary motion-reduce:transition-none"
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
