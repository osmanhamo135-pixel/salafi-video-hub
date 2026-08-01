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
// Any scheduled source node (noise burst today, previously oscillators).
let activeSources: AudioScheduledSourceNode[] = [];
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

  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // The node may already have ended.
    }
  }
  activeSources = [];

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

  /* A NON-PITCHED alert, deliberately. This used to be 880Hz followed by
     1320Hz — a rising perfect fifth, two pitched tones in sequence, which is
     a melodic sting; the manhaj forbids music and melodic feedback outright,
     and this is the sound every install hears by default. What replaces it is
     a short filtered noise burst: an attention signal with no pitch, no
     interval and no tune, the acoustic equivalent of a knock. */
  const context = new AudioContextCtor();
  const gain = context.createGain();
  const now = context.currentTime;
  const peak = Math.max(0.0001, volume * 0.32);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.4), now + 0.09);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
  gain.connect(context.destination);

  // White noise, one buffer, played twice as a knock-knock — two identical
  // bursts, so there is no interval between them to hear as a melody.
  const frames = Math.floor(context.sampleRate * 0.34);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    // Two bursts: 0–90ms and 150–240ms, silence between and after.
    const t = i / context.sampleRate;
    const inBurst = t < 0.09 || (t >= 0.15 && t < 0.24);
    channel[i] = inBurst ? Math.random() * 2 - 1 : 0;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  // Band-limit it so it reads as a soft wooden knock rather than a hiss.
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(1100, now);
  band.Q.setValueAtTime(0.7, now);

  source.connect(band);
  band.connect(gain);
  source.start(now);
  source.stop(now + 0.34);

  activeAudioContext = context;
  activeSources = [source];

  try {
    await context.resume();
  } catch (error) {
    stopReminderSound();
    throw createAudioError(error);
  }

  defaultSoundStopTimer = window.setTimeout(() => {
    stopReminderSound();
  }, 600);
};

const createAudioError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('notallowed')) {
    return new Error('Click Test Sound once to allow reminder audio.');
  }
  return new Error(message || 'Click Test Sound once to allow reminder audio.');
};

// Volumes are stored and passed around on a 0-100 scale. The old
// "greater than 1 means percent" guess made a deliberate 1% play at full
// volume — the one case where guessing wrong is loudest.
const normalizeVolume = (volume: number) => {
  if (!Number.isFinite(volume)) return 1;
  return Math.max(0, Math.min(1, volume / 100));
};
