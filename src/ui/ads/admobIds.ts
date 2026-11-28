import { Platform } from 'react-native';

/**
 * AdMob ids. The app ids also sit in app.json (the library's config plugin writes them into
 * the native project); the rewarded unit ids are used here. Ids are not secrets: they ship
 * inside every app that shows ads.
 *
 * Live ads are served only by a store build (EXPO_PUBLIC_ADS_LIVE=1, set by the production
 * profile in eas.json). Development and preview builds use Google's public sample units,
 * which only ever serve test ads, so nobody on the team can tap a live ad by accident
 * (AdMob suspends accounts for that).
 */
export const ADMOB_IDS = {
  ios: { rewarded: 'ca-app-pub-2761229802602660/2249871659' },
  /** Not created yet: still Google's sample unit. */
  android: { rewarded: 'ca-app-pub-3940256099942544/5224354917' },
} as const;

/** Google's sample units (test ads only). */
export const SAMPLE_UNITS = {
  ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313' },
  android: { rewarded: 'ca-app-pub-3940256099942544/5224354917' },
} as const;

/** Google's sample publisher id: anything under it is a test ad. */
export const SAMPLE_PUBLISHER = 'ca-app-pub-3940256099942544';

/** True only in a store build. */
export function liveAds(): boolean {
  return !__DEV__ && process.env.EXPO_PUBLIC_ADS_LIVE === '1';
}

export function rewardedUnitId(os: string = Platform.OS, live: boolean = liveAds()): string {
  const key = os === 'android' ? 'android' : 'ios';
  return (live ? ADMOB_IDS : SAMPLE_UNITS)[key].rewarded;
}

/** True when this build shows test ads only. */
export function usingSampleIds(): boolean {
  return rewardedUnitId().startsWith(SAMPLE_PUBLISHER);
}
