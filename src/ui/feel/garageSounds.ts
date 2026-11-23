import type { GarageContent, GarageState } from '@/idle';

import { garageContent } from '../garage/content';
import { garageMoments } from '../garage/moments';
import type { ShipDayInfo } from '../garage/store';
import type { CueRequest } from './cues';

/** Garage tap pitch: rises by this much per combo tap, up to GARAGE_TAP_MAX_RATE. */
export const GARAGE_TAP_RATE_STEP = 0.01;
export const GARAGE_TAP_MAX_RATE = 1.3;
/** The helpers' tick (auto-collect, auto-buy) sounds at most once in this much Garage time. */
export const HELPER_SOUND_GAP_MS = 30_000;
/** A lab happening appearing chirps at most once in this much Garage time. */
export const HAPPENING_SOUND_GAP_MS = 15_000;

/** Rate limits that need memory across changes (one per store subscription). */
export interface GarageSoundMemo {
  helperAt: number;
  happeningAt: number;
}

export function createGarageMemo(): GarageSoundMemo {
  return { helperAt: -Infinity, happeningAt: -Infinity };
}

/**
 * The Garage's sounds, all in this one file: each line maps a discrete change in the Garage
 * state (src/ui/garage/moments.ts) to a cue. Pure apart from the memo's rate limits; the
 * clock advancing alone never sounds, and what the helpers do on their own is a barely
 * audible tick at most every HELPER_SOUND_GAP_MS.
 */
export function deriveGarageCues(prev: GarageState | null, next: GarageState | null, content: GarageContent = garageContent(), memo: GarageSoundMemo = createGarageMemo()): CueRequest[] {
  if (!prev || !next || prev === next) return [];
  // A reset or a different save: say nothing.
  if (next.createdAt !== prev.createdAt) return [];
  const a = prev.stats;
  const b = next.stats;
  const m = garageMoments(prev, next, content);
  const cues: CueRequest[] = [];
  if (b.modelsShipped > a.modelsShipped) cues.push({ cue: 'garageShip' });
  if (m.stage !== null) cues.push({ cue: 'garageStage' });
  if (m.multiplied) cues.push({ cue: 'garageMultiply' });
  if (b.goldenCaught > a.goldenCaught || b.cratesOpened > a.cratesOpened) cues.push({ cue: 'garageGolden' });
  if (b.incidentsFixed > a.incidentsFixed) cues.push({ cue: 'momentAverted' });
  if (next.achievements.length > prev.achievements.length) cues.push({ cue: 'achievement' });
  if (m.trainingStarted) cues.push({ cue: 'trainingReveal' });
  if (m.pick) cues.push({ cue: m.pick.action === 'scrap' ? 'modelScrap' : 'modelKeep' });
  if (m.happening?.outcome === 'tapped') cues.push({ cue: m.happening.averted ? 'happeningAverted' : 'happeningGood' });
  if (m.milestones.length && m.bought > 0) cues.push({ cue: 'garageMilestone' });
  if (m.bought > 0 || b.upgradesBought > a.upgradesBought) cues.push({ cue: 'garageBuy' });
  if (m.staff) cues.push({ cue: 'staffMove' });
  if (m.trainingReady) cues.push({ cue: 'trainingReady' });
  if (m.happening?.outcome === 'missed') cues.push({ cue: 'happeningMiss' });
  if ((m.happening?.outcome === 'auto' || m.autoBought > 0) && next.now - memo.helperAt >= HELPER_SOUND_GAP_MS) {
    memo.helperAt = next.now;
    cues.push({ cue: 'garageHelper' });
  }
  if (m.happeningShown && next.now - memo.happeningAt >= HAPPENING_SOUND_GAP_MS) {
    memo.happeningAt = next.now;
    cues.push({ cue: 'happeningShow' });
  }
  if (b.taps > a.taps) cues.push({ cue: 'garageTap', rate: Math.min(GARAGE_TAP_MAX_RATE, 1 + Math.max(0, next.combo.count - 1) * GARAGE_TAP_RATE_STEP) });
  return cues;
}

/** Ship day's steps: the benchmark reveal as it opens, the press as the headline lands. */
export function deriveShipDayCues(prev: ShipDayInfo | null, next: ShipDayInfo | null): CueRequest[] {
  if (!next || prev?.step === next.step) return [];
  if (next.step === 'reveal') return [{ cue: 'shipReveal' }];
  if (next.step === 'press') return [{ cue: 'shipPress' }];
  return [];
}
