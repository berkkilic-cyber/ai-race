import { loadExpoAudioBackend, type SoundBackend, type Voice } from './backend';
import { useFeelSettings } from './settings';
import { SOUND_NAMES, soundSpec, type SoundName } from './sounds';

export interface PlayOptions {
  /** Playback rate, 0.5..2 (pitch moves with it). Default 1. */
  rate?: number;
  /** Multiplies the sound's base volume, 0..1. Default 1. */
  volume?: number;
}

/** The same sound plays at most once in this window (ms); a repeat inside it is dropped, not queued. */
export const SAME_SOUND_GAP_MS = 50;
/** At most this many sounds start in any `BURST_WINDOW_MS` window (a pile-up is dropped). */
export const BURST_LIMIT = 4;
export const BURST_WINDOW_MS = 120;
/** Entries kept in the played-sound log (debug handle, tests). */
const LOG_SIZE = 400;

let backend: SoundBackend | null | undefined;
let clock: () => number = () => Date.now();
const pools = new Map<SoundName, { voices: Voice[]; next: number }>();
const lastStart = new Map<SoundName, number>();
const recent: number[] = [];
const log: { name: SoundName; at: number; rate: number }[] = [];
const listeners = new Set<(name: SoundName) => void>();

function resolveBackend(): SoundBackend | null {
  if (backend === undefined) backend = loadExpoAudioBackend();
  return backend;
}

/** A voice for the sound: an idle one from its pool, a new one while the pool has room, else the oldest (restarted). */
function voiceFor(name: SoundName): Voice | null {
  const b = resolveBackend();
  if (!b) return null;
  let pool = pools.get(name);
  if (!pool) {
    pool = { voices: [], next: 0 };
    pools.set(name, pool);
  }
  const idle = pool.voices.find((v) => !v.busy());
  if (idle) return idle;
  if (pool.voices.length < soundSpec(name).voices) {
    const v = b.createVoice(name);
    if (v) pool.voices.push(v);
    return v;
  }
  if (!pool.voices.length) return null;
  const v = pool.voices[pool.next % pool.voices.length];
  pool.next++;
  return v;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Plays a sound, unless sound is off, the same sound started less than SAME_SOUND_GAP_MS
 * ago, or BURST_LIMIT sounds already started in the last BURST_WINDOW_MS. Returns whether
 * it played (also when no audio backend exists: the log still records it).
 */
export function play(name: SoundName, opts: PlayOptions = {}): boolean {
  if (!useFeelSettings.getState().sound) return false;
  const now = clock();
  const last = lastStart.get(name);
  if (last !== undefined && now - last < SAME_SOUND_GAP_MS) return false;
  while (recent.length && now - recent[0] >= BURST_WINDOW_MS) recent.shift();
  if (recent.length >= BURST_LIMIT) return false;
  recent.push(now);
  lastStart.set(name, now);
  const rate = clamp(opts.rate ?? 1, 0.5, 2);
  log.push({ name, at: now, rate });
  if (log.length > LOG_SIZE) log.shift();
  for (const l of listeners) l(name);
  const voice = voiceFor(name);
  voice?.play(clamp(soundSpec(name).volume * (opts.volume ?? 1), 0, 1), rate);
  return true;
}

/** Creates one voice per sound ahead of time so the first play has no load delay. Cheap no-op without a backend. */
export function preloadSounds(): void {
  if (!resolveBackend()) return;
  for (const name of SOUND_NAMES) if (!pools.get(name)?.voices.length) {
    const v = backend!.createVoice(name);
    if (v) pools.set(name, { voices: [v], next: 0 });
  }
}

/** Every sound started so far (newest last, capped), for the debug handle and tests. */
export function getSoundLog(): readonly { name: SoundName; at: number; rate: number }[] {
  return log;
}

/** Called with each sound name as it starts (the press tracker uses it). */
export function onSoundPlayed(listener: (name: SoundName) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests: swap the backend (null = silent) and the clock, and clear all state. */
export function resetSoundEngineForTests(opts: { backend?: SoundBackend | null; clock?: () => number } = {}): void {
  for (const p of pools.values()) for (const v of p.voices) v.release();
  pools.clear();
  lastStart.clear();
  recent.length = 0;
  log.length = 0;
  backend = opts.backend === undefined ? null : opts.backend;
  clock = opts.clock ?? (() => Date.now());
}
