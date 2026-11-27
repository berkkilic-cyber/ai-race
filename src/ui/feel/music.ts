/* eslint-disable @typescript-eslint/no-require-imports */
import { AppState, Platform } from 'react-native';

import { useFeelSettings } from './settings';

/**
 * Background music: one looping track per mode, cross-faded when the mode changes.
 *
 * The files in assets/music are prepared so the end runs into the start (the last seconds are
 * the outro cross-faded into the intro), so a plain `loop` repeats without a seam in the music.
 * Like the sound effects, expo-audio is loaded lazily inside try/catch: a build without the
 * native module, or Jest, simply has no music.
 */
export type TrackName = 'race' | 'garage';

const TRACK_FILES: Record<TrackName, unknown> = {
  race: require('../../../assets/music/race.m4a'),
  garage: require('../../../assets/music/garage.m4a'),
};

/** Music sits under the sound effects. */
export const MUSIC_VOLUME = 0.4;
const FADE_MS = 700;
const FADE_STEP_MS = 50;

/**
 * Which track a route plays. The race and its end screen get the race track; the Garage and
 * the start screen share the calm one. Unknown routes keep whatever is playing.
 */
export function trackForPath(path: string): TrackName | 'keep' {
  if (path === '/game' || path.startsWith('/game/') || path === '/end') return 'race';
  if (path === '/' || path === '/garage' || path.startsWith('/garage/')) return 'garage';
  return 'keep';
}

interface MusicPlayer {
  volume: number;
  loop: boolean;
  playing: boolean;
  play(): void;
  pause(): void;
  remove(): void;
}
interface MusicModule {
  createAudioPlayer(source: unknown, options?: Record<string, unknown>): MusicPlayer;
}

/** A test or another backend can stand in for expo-audio. */
export type MusicLoader = () => MusicModule | null;

function loadExpoAudio(): MusicModule | null {
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return null;
  try {
    const mod = require('expo-audio') as MusicModule;
    return mod && typeof mod.createAudioPlayer === 'function' ? mod : null;
  } catch {
    return null;
  }
}

function quietly(call: () => unknown): void {
  try {
    const r = call() as Promise<unknown> | undefined;
    r?.catch?.(() => undefined);
  } catch {
    // Music is a nicety: never let a player error surface.
  }
}

let loader: MusicLoader = loadExpoAudio;
let mod: MusicModule | null | undefined;
const players: Partial<Record<TrackName, MusicPlayer | null>> = {};
const levels: Record<TrackName, number> = { race: 0, garage: 0 };
let wanted: TrackName | null = null;
let active = true;
let timer: ReturnType<typeof setInterval> | null = null;
let installed = false;

function playerFor(name: TrackName): MusicPlayer | null {
  if (name in players) return players[name] ?? null;
  if (mod === undefined) mod = loader();
  let p: MusicPlayer | null = null;
  if (mod) {
    try {
      p = mod.createAudioPlayer(TRACK_FILES[name], { updateInterval: 1000 });
      p.loop = true;
      p.volume = 0;
    } catch {
      p = null;
    }
  }
  players[name] = p;
  return p;
}

/** The track that should be audible now, given the wish, the setting and the app's state. */
function target(): TrackName | null {
  return active && useFeelSettings.getState().music ? wanted : null;
}

function step(): void {
  const goal = target();
  const delta = FADE_STEP_MS / FADE_MS;
  let moving = false;
  for (const name of ['race', 'garage'] as const) {
    const to = name === goal ? 1 : 0;
    const from = levels[name];
    if (from === to) continue;
    const next = to > from ? Math.min(to, from + delta) : Math.max(to, from - delta);
    levels[name] = next;
    const p = next > 0 || name === goal ? playerFor(name) : (players[name] ?? null);
    if (p) {
      quietly(() => {
        p.volume = next * MUSIC_VOLUME;
        if (next > 0 && !p.playing) p.play();
        if (next === 0 && p.playing) p.pause();
      });
    }
    if (next !== to) moving = true;
  }
  if (!moving && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function kick(): void {
  if (!timer) timer = setInterval(step, FADE_STEP_MS);
}

/** Asks for a track (or silence). Fades from whatever is playing; the same track keeps playing. */
export function setMusic(name: TrackName | null): void {
  if (wanted === name) return;
  wanted = name;
  kick();
}

/** Follows the route: call with the current path whenever it changes. */
export function setMusicForPath(path: string): void {
  const next = trackForPath(path);
  if (next !== 'keep') setMusic(next);
}

/** For tests and the debug handle: what is wanted and how loud each track is (0..1 before MUSIC_VOLUME). */
export function getMusicState(): { wanted: TrackName | null; audible: TrackName | null; levels: Record<TrackName, number> } {
  return { wanted, audible: target(), levels: { ...levels } };
}

/**
 * Wires music to the setting, to the app going to the background, and (on the web, where a
 * browser refuses to start audio before the first tap) to the first pointer press. Safe to
 * call more than once.
 */
export function installMusic(): void {
  if (installed) return;
  installed = true;
  useFeelSettings.subscribe((s, prev) => {
    if (s.music !== prev.music) kick();
  });
  AppState.addEventListener('change', (state) => {
    active = state === 'active';
    kick();
  });
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const retry = () => {
      const goal = target();
      const p = goal ? (players[goal] ?? null) : null;
      if (p && !p.playing) quietly(() => p.play());
    };
    document.addEventListener('pointerdown', retry, { passive: true });
  }
}

/** Tests only: start from a clean slate, optionally with a stand-in for expo-audio. */
export function resetMusicForTests(next?: MusicLoader): void {
  if (timer) clearInterval(timer);
  timer = null;
  for (const name of ['race', 'garage'] as const) {
    quietly(() => players[name]?.remove());
    delete players[name];
    levels[name] = 0;
  }
  wanted = null;
  active = true;
  mod = undefined;
  loader = next ?? loadExpoAudio;
}
