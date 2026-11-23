import { Platform } from 'react-native';

import type { PlacementId } from './types';

/**
 * Ad layer settings. Rewards, cooldowns and daily caps are content data (garage offers);
 * these are presentation switches.
 */
export const AD_CONFIG = {
  /** The optional banner slot on the Garage screen. Off by default. */
  bannerEnabled: false,
  /** Seconds the mock rewarded ad runs before its reward can be claimed. */
  mockSeconds: 5,
  /** Height of the banner slot (a landscape phone banner is 32 high). */
  bannerHeight: 32,
  bannerWidth: 320,
  /**
   * Ad unit ids per placement for a real provider (placeholders: fill in from the ad
   * network's console; see docs/GARAGE.md).
   */
  adUnits: {
    offlineDouble: 'garage_offline_double',
    boost: 'garage_boost_2x',
    frenzyExtend: 'garage_frenzy_extend',
    incidentFix: 'garage_incident_fix',
    crate: 'garage_bonus_crate',
    prestigeBonus: 'garage_prestige_bonus',
    bonusMultiply: 'garage_bonus_multiply',
  } satisfies Record<PlacementId, string>,
} as const;

/** Debug (web): `?banner=1` shows the banner slot, `?adseconds=1` shortens the mock ad. */
function webParam(name: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const m = new RegExp(`[?&]${name}=([^&#]*)`).exec(window.location?.search ?? '');
  return m ? decodeURIComponent(m[1]) : null;
}

export function bannerEnabled(): boolean {
  return AD_CONFIG.bannerEnabled || webParam('banner') === '1';
}

export function mockSeconds(): number {
  const v = Number(webParam('adseconds'));
  return Number.isFinite(v) && v >= 0 && webParam('adseconds') !== null ? v : AD_CONFIG.mockSeconds;
}
