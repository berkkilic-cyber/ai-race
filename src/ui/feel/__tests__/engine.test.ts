import fs from 'node:fs';
import path from 'node:path';

import type { SoundBackend, Voice } from '../backend';
import { feedback, playCues, pressFeedback, MAX_CUES_PER_CHANGE } from '../cues';
import { BURST_LIMIT, SAME_SOUND_GAP_MS, getSoundLog, play, resetSoundEngineForTests } from '../engine';
import { HAPTIC_GAP_MS, haptic, resetHapticsForTests } from '../haptics';
import { resetFeelSettingsForTests, useFeelSettings } from '../settings';
import { SOUND_NAMES, soundSpec } from '../sounds';

const ROOT = path.join(__dirname, '..', '..', '..', '..');

function fakeBackend() {
  const plays: { name: string; volume: number; rate: number; voice: number }[] = [];
  let made = 0;
  const backend: SoundBackend = {
    createVoice(name) {
      const id = made++;
      let busyUntil = -1;
      const v: Voice = {
        play(volume, rate) {
          plays.push({ name, volume, rate, voice: id });
          busyUntil = now + 100;
        },
        busy: () => now < busyUntil,
        release: () => undefined,
      };
      return v;
    },
  };
  return { backend, plays, made: () => made };
}

let now = 0;

beforeEach(() => {
  now = 1000;
  resetFeelSettingsForTests();
  resetHapticsForTests(() => now);
});

describe('sound files', () => {
  it('has one generated WAV per sound name, and the generator knows every name', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SOUNDS } = require(path.join(ROOT, 'scripts', 'sfx', 'generate.js'));
    expect(Object.keys(SOUNDS).sort()).toEqual([...SOUND_NAMES].sort());
    let total = 0;
    for (const name of SOUND_NAMES) {
      const file = path.join(ROOT, 'assets', 'sfx', `${name}.wav`);
      expect(fs.existsSync(file)).toBe(true);
      total += fs.statSync(file).size;
    }
    expect(total).toBeLessThan(900 * 1024);
  });

  it('every file is 16-bit mono 44.1 kHz, peaks near -6 dBFS, never clips and is not silent', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { levels } = require(path.join(ROOT, 'scripts', 'sfx', 'generate.js'));
    for (const name of SOUND_NAMES) {
      const l = levels(path.join(ROOT, 'assets', 'sfx', `${name}.wav`));
      expect({ name, channels: l.channels, rate: l.rate, bits: l.bits }).toEqual({ name, channels: 1, rate: 44100, bits: 16 });
      expect(l.clipped).toBe(0);
      expect(l.peakDb).toBeGreaterThan(-6.5);
      expect(l.peakDb).toBeLessThan(-5.5);
      expect(l.rmsDb).toBeGreaterThan(-40);
      expect(l.ms).toBeLessThanOrEqual(name.endsWith('sting') || name.includes('launch') || name.includes('ship') || name.includes('stage') ? 1000 : 500);
    }
  });
});

describe('sound engine', () => {
  it('plays through the backend with the base volume and the given rate', () => {
    const f = fakeBackend();
    resetSoundEngineForTests({ backend: f.backend, clock: () => now });
    expect(play('buy', { rate: 1.2, volume: 0.5 })).toBe(true);
    expect(f.plays).toEqual([{ name: 'buy', volume: soundSpec('buy').volume * 0.5, rate: 1.2, voice: 0 }]);
    expect(getSoundLog().map((e) => e.name)).toEqual(['buy']);
  });

  it('drops the same sound inside the gap, not other sounds', () => {
    const f = fakeBackend();
    resetSoundEngineForTests({ backend: f.backend, clock: () => now });
    expect(play('ui-tap')).toBe(true);
    now += SAME_SOUND_GAP_MS - 1;
    expect(play('ui-tap')).toBe(false);
    expect(play('buy')).toBe(true);
    now += 1;
    expect(play('ui-tap')).toBe(true);
  });

  it('limits bursts of different sounds', () => {
    resetSoundEngineForTests({ backend: null, clock: () => now });
    const played = SOUND_NAMES.slice(0, BURST_LIMIT + 3).map((n) => play(n));
    expect(played.filter(Boolean)).toHaveLength(BURST_LIMIT);
  });

  it('keeps Garage tapping cheap: a small voice pool reused at 12 taps a second', () => {
    const f = fakeBackend();
    resetSoundEngineForTests({ backend: f.backend, clock: () => now });
    let ok = 0;
    for (let i = 0; i < 120; i++) {
      if (play('garage-tap', { rate: 1 + i / 400 })) ok++;
      now += 83;
    }
    expect(ok).toBe(120);
    expect(f.made()).toBeLessThanOrEqual(soundSpec('garage-tap').voices);
  });

  it('is silent with sound off, and works without any backend', () => {
    resetSoundEngineForTests({ backend: null, clock: () => now });
    expect(play('buy')).toBe(true);
    useFeelSettings.getState().setSound(false);
    now += 1000;
    expect(play('buy')).toBe(false);
    expect(getSoundLog()).toHaveLength(1);
  });

  it('a missing expo-audio module means no backend, never a throw', () => {
    jest.isolateModules(() => {
      jest.doMock('expo-audio', () => {
        throw new Error('Cannot find native module ExpoAudio');
      });
      (globalThis as { __feelAllowAudioInJest?: boolean }).__feelAllowAudioInJest = true;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadExpoAudioBackend } = require('../backend');
      expect(loadExpoAudioBackend()).toBeNull();
      (globalThis as { __feelAllowAudioInJest?: boolean }).__feelAllowAudioInJest = false;
    });
  });

  it('with expo-audio present: ambient session (silent switch, mixes with music) and players restart from the start', () => {
    jest.isolateModules(() => {
      const players: Record<string, unknown>[] = [];
      const setAudioModeAsync = jest.fn(() => Promise.resolve());
      jest.doMock('expo-audio', () => ({
        setAudioModeAsync,
        createAudioPlayer: () => {
          const p = { volume: 1, playing: false, currentTime: 0.2, playbackRate: 1, shouldCorrectPitch: true, play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), setPlaybackRate: jest.fn(), remove: jest.fn() };
          players.push(p);
          return p;
        },
      }));
      (globalThis as { __feelAllowAudioInJest?: boolean }).__feelAllowAudioInJest = true;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadExpoAudioBackend } = require('../backend');
      const b = loadExpoAudioBackend();
      (globalThis as { __feelAllowAudioInJest?: boolean }).__feelAllowAudioInJest = false;
      expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }));
      const v = b.createVoice('garage-tap');
      v.play(0.4, 1.2);
      const p = players[0] as { shouldCorrectPitch: boolean; seekTo: jest.Mock; play: jest.Mock; setPlaybackRate: jest.Mock; volume: number };
      expect(p.shouldCorrectPitch).toBe(false);
      expect(p.setPlaybackRate).toHaveBeenCalledWith(1.2);
      expect(p.seekTo).toHaveBeenCalledWith(0);
      expect(p.play).toHaveBeenCalled();
      expect(p.volume).toBe(0.4);
    });
  });
});

describe('cues and presses', () => {
  beforeEach(() => resetSoundEngineForTests({ backend: null, clock: () => now }));

  it('a plain press plays the tap', () => {
    pressFeedback(() => undefined);
    expect(getSoundLog().map((e) => e.name)).toEqual(['ui-tap']);
  });

  it('a press that causes its own sound drops the tap', () => {
    pressFeedback(() => feedback('buy'));
    expect(getSoundLog().map((e) => e.name)).toEqual(['buy']);
  });

  it('one change plays only its highest cues', () => {
    playCues([{ cue: 'buy' }, { cue: 'win' }, { cue: 'tap' }, { cue: 'modelLaunch' }]);
    expect(getSoundLog().map((e) => e.name)).toEqual(['win-sting', 'model-launch'].slice(0, MAX_CUES_PER_CHANGE));
  });
});

describe('haptics', () => {
  it('merges buzzes inside the gap unless a stronger one follows, and respects the setting', () => {
    expect(haptic('light')).toBe(true);
    expect(haptic('light')).toBe(false);
    expect(haptic('success')).toBe(true);
    now += HAPTIC_GAP_MS;
    expect(haptic('light')).toBe(true);
    useFeelSettings.getState().setHaptics(false);
    now += HAPTIC_GAP_MS;
    expect(haptic('success')).toBe(false);
  });
});
