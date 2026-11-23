import type { OfferId } from '@/idle';

/**
 * Ad placements. Each is one opt-in rewarded ad backing one Garage offer (same id); the
 * cooldowns and daily caps live in the garage content (offers) and are enforced by the
 * idle engine, so the ad layer never decides what a reward is worth.
 */
export type PlacementId = OfferId;

export const PLACEMENTS: readonly PlacementId[] = ['offlineDouble', 'boost', 'frenzyExtend', 'incidentFix', 'crate', 'prestigeBonus', 'bonusMultiply'];

export type AdResult = 'rewarded' | 'dismissed' | 'unavailable';

export interface AdShowInfo {
  /** What the player gets, already in words (shown on the test ad). */
  reward: string;
}

/**
 * A source of rewarded ads. The mock provider (mockProvider.ts) is the only one today; a
 * real one (AdMob or similar, in a development build) implements the same two methods.
 * `show` resolves once the ad has closed: 'rewarded' only if the player earned the reward.
 */
export interface AdProvider {
  readonly name: string;
  isAvailable(placement: PlacementId): boolean;
  show(placement: PlacementId, info: AdShowInfo): Promise<AdResult>;
}

export interface PlacementStats {
  requested: number;
  shown: number;
  rewarded: number;
  dismissed: number;
  unavailable: number;
  /** Rewards granted without an ad (ads removed). */
  granted: number;
}
