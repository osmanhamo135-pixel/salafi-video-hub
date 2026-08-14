/**
 * Detects a backend that has stopped answering.
 *
 * A field report showed the app in exactly this state: the window painted, the
 * hero rendered, and every card sat in its skeleton forever — because every
 * `invoke` was pending and nothing on the page would ever say so. A reader
 * cannot distinguish "still loading" from "will never load", and neither could
 * we from a screenshot.
 *
 * So the app now measures it. One cheap command is pinged at startup; if no
 * answer comes back inside the deadline, the shell shows a plain banner saying
 * the engine is not responding, with what to try and what to send us. The ping
 * is `get_app_data_path`: no database, no filesystem walk, no network — if
 * THAT cannot answer, the IPC channel or the main thread is gone, not the data.
 *
 * The probe result is also kept (latency or failure) so Diagnostics can show
 * it. Skeletons elsewhere are separately bounded by `withTimeout`, so a single
 * slow feature degrades into its own error state rather than an eternal
 * placeholder — this watchdog exists for the case where *everything* is stuck.
 */
import { invoke } from '@tauri-apps/api/core';

export type BackendHealth =
  | { state: 'checking' }
  | { state: 'ok'; latencyMs: number }
  | { state: 'unresponsive'; waitedMs: number };

const DEADLINE_MS = 15_000;

let current: BackendHealth = { state: 'checking' };
const listeners = new Set<(health: BackendHealth) => void>();

const publish = (health: BackendHealth) => {
  current = health;
  for (const listener of listeners) listener(health);
};

export const getBackendHealth = () => current;

export const subscribeBackendHealth = (listener: (health: BackendHealth) => void) => {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
};

/** Ping once. Safe to call again from a Retry button. */
export const probeBackend = async (): Promise<BackendHealth> => {
  publish({ state: 'checking' });
  const started = Date.now();
  let settled = false;

  const deadline = window.setTimeout(() => {
    if (!settled) publish({ state: 'unresponsive', waitedMs: Date.now() - started });
  }, DEADLINE_MS);

  try {
    await invoke('get_app_data_path');
    settled = true;
    window.clearTimeout(deadline);
    // A late answer after the banner showed still clears it: the engine came
    // back, and a stale warning over a working app is its own kind of lie.
    publish({ state: 'ok', latencyMs: Date.now() - started });
  } catch {
    settled = true;
    window.clearTimeout(deadline);
    // An ERROR is an answer — the channel works. Only silence is unhealthy.
    publish({ state: 'ok', latencyMs: Date.now() - started });
  }
  return current;
};
