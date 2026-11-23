import type { GarageState } from '@/idle';

import type { CueRequest } from './cues';

/** Garage tap pitch: rises by this much per combo tap, up to GARAGE_TAP_MAX_RATE. */
export const GARAGE_TAP_RATE_STEP = 0.01;
export const GARAGE_TAP_MAX_RATE = 1.3;

/**
 * The Garage's sounds, all in this one file so the Garage rework can extend it: each line
 * maps a counter that grew in the Garage state to a cue. Pure; only discrete changes
 * produce sounds (the clock advancing alone never does).
 */
export function deriveGarageCues(prev: GarageState | null, next: GarageState | null): CueRequest[] {
  if (!prev || !next || prev === next) return [];
  // A reset or a different save: say nothing.
  if (next.createdAt !== prev.createdAt) return [];
  const a = prev.stats;
  const b = next.stats;
  const cues: CueRequest[] = [];
  if (b.modelsShipped > a.modelsShipped) cues.push({ cue: 'garageShip' });
  if (b.goldenCaught > a.goldenCaught || b.cratesOpened > a.cratesOpened) cues.push({ cue: 'garageGolden' });
  if (b.incidentsFixed > a.incidentsFixed) cues.push({ cue: 'momentAverted' });
  if (b.generatorsBought > a.generatorsBought || b.upgradesBought > a.upgradesBought) cues.push({ cue: 'garageBuy' });
  if (next.achievements.length > prev.achievements.length) cues.push({ cue: 'achievement' });
  if (b.taps > a.taps) cues.push({ cue: 'garageTap', rate: Math.min(GARAGE_TAP_MAX_RATE, 1 + Math.max(0, next.combo.count - 1) * GARAGE_TAP_RATE_STEP) });
  return cues;
}
