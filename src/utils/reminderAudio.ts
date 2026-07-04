import { convertFileSrc, invoke } from '@tauri-apps/api/core';

interface PlayReminderSoundOptions {
  soundPath?: string | null;
  volume?: number | null;
}

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

let activeAudio: HTMLAudioElement | null = null;
let activeAudioContext: AudioContext | null = null;
let activeOscillators: OscillatorNode[] = [];
let defaultSoundStopTimer: number | null = null;

export async function playReminderSound({
  soundPath,
  volume,
}: PlayReminderSoundOptions = {}): Promise<void> {
  stopReminderSound();

  const normalizedVolume = normalizeVolume(volume ?? 80);
  const selectedPath = soundPath?.trim();

  if (selectedPath) {
    await playFileSound(selectedPath, normalizedVolume);
    return;
  }

  await playDefaultTone(normalizedVolume);
}

export function stopReminderSound() {
  if (defaultSoundStopTimer !== null) {
    window.clearTimeout(defaultSoundStopTimer);
    defaultSoundStopTimer = null;
  }

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  for (const oscillator of activeOscillators) {
    try {
      oscillator.stop();
    } catch {
      // The oscillator may already have ended.
    }
  }
  activeOscillators = [];

  if (activeAudioContext) {
    void activeAudioContext.close().catch(() => undefined);
    activeAudioContext = null;
  }
}

const playFileSound = async (soundPath: string, volume: number) => {
  await invoke('allow_reminder_sound_path', { filePath: soundPath });

  const audio = new Audio(convertFileSrc(soundPath, 'asset'));
  audio.volume = volume;
  audio.preload = 'auto';
  activeAudio = audio;

  try {
    await audio.play();
  } catch (error) {
    activeAudio = null;
    throw createAudioError(error);
  }
};

const playDefaultTone = async (volume: number) => {
  const AudioContextCtor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error('Reminder audio is not supported on this system.');
  }

  const context = new AudioContextCtor();
  const gain = context.createGain();
  const now = context.currentTime;
  const peak = Math.max(0.0001, volume * 0.35);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.55), now + 0.32);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  gain.connect(context.destination);

  const firstTone = context.createOscillator();
  firstTone.type = 'sine';
  firstTone.frequency.setValueAtTime(880, now);
  firstTone.connect(gain);
  firstTone.start(now);
  firstTone.stop(now + 0.45);

  const secondTone = context.createOscillator();
  secondTone.type = 'triangle';
  secondTone.frequency.setValueAtTime(1320, now + 0.16);
  secondTone.connect(gain);
  secondTone.start(now + 0.16);
  secondTone.stop(now + 0.9);

  activeAudioContext = context;
  activeOscillators = [firstTone, secondTone];

  try {
    await context.resume();
  } catch (error) {
    stopReminderSound();
    throw createAudioError(error);
  }

  defaultSoundStopTimer = window.setTimeout(() => {
    stopReminderSound();
  }, 1200);
};

const createAudioError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('notallowed')) {
    return new Error('Click Test Sound once to allow reminder audio.');
  }
  return new Error(message || 'Click Test Sound once to allow reminder audio.');
};

const normalizeVolume = (volume: number) => {
  const normalized = volume > 1 ? volume / 100 : volume;
  return Math.max(0, Math.min(1, normalized));
};
