import { onSoundPlayed, play } from './engine';
import { haptic, type HapticKind } from './haptics';
import type { SoundName } from './sounds';

/** Game moments with feedback. docs/FEEL.md has the same table with how each sound is made. */
export type Cue =
  | 'tap'
  | 'back'
  | 'tab'
  | 'buy'
  | 'deny'
  | 'regionLaunch'
  | 'dataCentre'
  | 'modelLaunch'
  | 'eventOpen'
  | 'eventConfirm'
  | 'momentBoost'
  | 'momentAverted'
  | 'rivalLaunch'
  | 'meterWarning'
  | 'win'
  | 'lose'
  | 'achievement'
  | 'garageTap'
  | 'garageBuy'
  | 'garageGolden'
  | 'garageShip'
  | 'garageDeny';

export interface CueSpec {
  sound: SoundName;
  /** Null where the feature already buzzes on its own (event card, Garage). */
  haptic: HapticKind | null;
  /** When one change produces several cues, only the highest ones play (see MAX_CUES_PER_CHANGE). */
  priority: number;
}

export const CUES: Record<Cue, CueSpec> = {
  tap: { sound: 'ui-tap', haptic: 'light', priority: 0 },
  back: { sound: 'ui-back', haptic: 'light', priority: 0 },
  tab: { sound: 'tab', haptic: 'selection', priority: 0 },
  buy: { sound: 'buy', haptic: 'medium', priority: 2 },
  deny: { sound: 'deny', haptic: 'light', priority: 1 },
  regionLaunch: { sound: 'region-launch', haptic: 'medium', priority: 3 },
  dataCentre: { sound: 'datacentre-built', haptic: 'heavy', priority: 3 },
  modelLaunch: { sound: 'model-launch', haptic: 'success', priority: 6 },
  // The event card buzzes by tone (src/ui/events), and its choice buttons on press.
  eventOpen: { sound: 'event-open', haptic: null, priority: 5 },
  eventConfirm: { sound: 'event-confirm', haptic: null, priority: 4 },
  momentBoost: { sound: 'moment-boost', haptic: 'light', priority: 3 },
  momentAverted: { sound: 'moment-averted', haptic: 'medium', priority: 3 },
  rivalLaunch: { sound: 'rival-launch', haptic: 'warning', priority: 5 },
  meterWarning: { sound: 'meter-warning', haptic: 'warning', priority: 4 },
  win: { sound: 'win-sting', haptic: 'success', priority: 9 },
  lose: { sound: 'lose-sting', haptic: 'error', priority: 9 },
  achievement: { sound: 'achievement', haptic: 'success', priority: 7 },
  // The Garage already buzzes on taps, buys, golden moments and ships (src/ui/garage/haptics.ts).
  garageTap: { sound: 'garage-tap', haptic: null, priority: 0 },
  garageBuy: { sound: 'garage-buy', haptic: null, priority: 2 },
  garageGolden: { sound: 'garage-golden', haptic: null, priority: 5 },
  garageShip: { sound: 'garage-ship', haptic: null, priority: 8 },
  garageDeny: { sound: 'deny', haptic: 'light', priority: 1 },
};

/** At most this many cues sound for one state change (the highest priorities); the rest are dropped. */
export const MAX_CUES_PER_CHANGE = 2;

export interface CueRequest {
  cue: Cue;
  rate?: number;
}

/** Plays a cue: its sound and, if it has one, its haptic. */
export function feedback(cue: Cue, opts: { rate?: number } = {}): void {
  const spec = CUES[cue];
  play(spec.sound, { rate: opts.rate });
  if (spec.haptic) haptic(spec.haptic);
}

/** Plays the highest-priority cues of one change (ties keep their order). */
export function playCues(cues: readonly CueRequest[]): void {
  if (!cues.length) return;
  const top = cues
    .map((c, i) => ({ c, i }))
    .sort((a, b) => CUES[b.c.cue].priority - CUES[a.c.cue].priority || a.i - b.i)
    .slice(0, MAX_CUES_PER_CHANGE);
  for (const { c } of top) feedback(c.cue, { rate: c.rate });
}

// ── presses ──
// A press answers with a tap sound and a light buzz, unless the press itself caused a more
// meaningful sound (a buy, a launch, a deny): then the tap is dropped so the two do not stack.
let pressDepth = 0;
let caused = false;
onSoundPlayed(() => {
  if (pressDepth > 0) caused = true;
});

/** Runs a press handler, then plays `cue` (default tap) if the handler made no sound of its own. */
export function pressFeedback(handler: () => void, cue: Cue = 'tap'): void {
  if (pressDepth === 0) caused = false;
  pressDepth++;
  try {
    handler();
  } finally {
    pressDepth--;
    if (pressDepth === 0 && !caused) feedback(cue);
  }
}

/** Wraps a press handler with `pressFeedback`. */
export function withPressFeedback<A extends unknown[]>(handler: (...args: A) => void, cue: Cue = 'tap'): (...args: A) => void {
  return (...args: A) => pressFeedback(() => handler(...args), cue);
}
