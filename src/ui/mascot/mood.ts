import type { ComposureLevel } from '../composure/logic';

export type MascotMood = 'calm' | 'pleased' | 'smug' | 'uneasy' | 'sweating' | 'panicking' | 'asleep';

export const MASCOT_MOODS: readonly MascotMood[] = ['calm', 'pleased', 'smug', 'uneasy', 'sweating', 'panicking', 'asleep'];

export interface MoodInputs {
  /** The run is paused. */
  paused: boolean;
  level: ComposureLevel;
  /** Tone of news about the player in the last few seconds, if any. */
  recentNews: 'good' | 'bad' | null;
  /** The player bought something (node, data centre, launch) in the last few seconds. */
  recentPurchase: boolean;
  /** The player has the largest world share of all labs. */
  leading: boolean;
}

/** How long a piece of news or a purchase colours the mood, in ms. */
export const MOOD_MEMORY_MS = 2600;

/**
 * The mascot's mood. Order: asleep while paused; danger (composure 3, 2) beats
 * everything else; then a fresh reaction (pleased after good news or a purchase,
 * uneasy after bad news); then the resting state (uneasy at composure 1, smug
 * when leading the race, calm otherwise).
 */
export function mascotMood({ paused, level, recentNews, recentPurchase, leading }: MoodInputs): MascotMood {
  if (paused) return 'asleep';
  if (level === 3) return 'panicking';
  if (level === 2) return 'sweating';
  if (recentNews === 'good' || recentPurchase) return 'pleased';
  if (recentNews === 'bad') return 'uneasy';
  if (level === 1) return 'uneasy';
  if (leading) return 'smug';
  return 'calm';
}
