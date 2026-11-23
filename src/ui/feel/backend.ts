/* eslint-disable @typescript-eslint/no-require-imports */
import { SOUND_FILES, type SoundName } from './sounds';

/** One playable copy of a sound (a native player or an HTML audio element). */
export interface Voice {
  /** Restarts the sound from the beginning at this volume (0..1) and rate (pitch changes with it). */
  play(volume: number, rate: number): void;
  /** True while it is still sounding. */
  busy(): boolean;
  release(): void;
}

export interface SoundBackend {
  createVoice(name: SoundName): Voice | null;
}

/** The subset of expo-audio this file uses (typed loosely: the module may be missing at run time). */
interface ExpoAudioPlayer {
  volume: number;
  playing: boolean;
  currentTime: number;
  playbackRate: number;
  shouldCorrectPitch: boolean;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  remove(): void;
  media?: { preservesPitch?: boolean };
}
interface ExpoAudioModule {
  createAudioPlayer(source: unknown, options?: Record<string, unknown>): ExpoAudioPlayer;
  setAudioModeAsync(mode: Record<string, unknown>): Promise<void>;
}

function quietly(call: () => unknown): void {
  try {
    const r = call() as Promise<unknown> | undefined;
    r?.catch?.(() => undefined);
  } catch {
    // Sound is a nicety: never let a player error surface.
  }
}

function voiceFor(mod: ExpoAudioModule, name: SoundName): Voice | null {
  let player: ExpoAudioPlayer;
  try {
    player = mod.createAudioPlayer(SOUND_FILES[name], { updateInterval: 1000 });
  } catch {
    return null;
  }
  quietly(() => {
    // Rate changes pitch (Garage tap streak), like a sampler, instead of time-stretching.
    player.shouldCorrectPitch = false;
    if (player.media && 'preservesPitch' in player.media) player.media.preservesPitch = false;
  });
  let rate = 1;
  return {
    play(volume, r) {
      quietly(() => {
        player.volume = volume;
        if (r !== rate) {
          rate = r;
          player.setPlaybackRate(r);
        }
        if (player.playing) player.pause();
        if (player.currentTime > 0) quietly(() => player.seekTo(0));
        player.play();
      });
    },
    busy() {
      try {
        return !!player.playing;
      } catch {
        return false;
      }
    },
    release() {
      quietly(() => player.remove());
    },
  };
}

/**
 * Loads expo-audio lazily, inside try/catch: an installed build without the native module
 * (or Jest, or any load error) gets no backend and the game runs silently. Also sets the
 * audio session so the iPhone silent switch is respected (`playsInSilentMode: false`) and
 * the player's own music keeps playing (`mixWithOthers`).
 */
export function loadExpoAudioBackend(): SoundBackend | null {
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID && !(globalThis as { __feelAllowAudioInJest?: boolean }).__feelAllowAudioInJest) return null;
  let mod: ExpoAudioModule;
  try {
    mod = require('expo-audio') as ExpoAudioModule;
    if (!mod || typeof mod.createAudioPlayer !== 'function') return null;
  } catch {
    return null;
  }
  quietly(() =>
    mod.setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      allowsRecording: false,
      shouldPlayInBackground: false,
    }),
  );
  return { createVoice: (name) => voiceFor(mod, name) };
}
