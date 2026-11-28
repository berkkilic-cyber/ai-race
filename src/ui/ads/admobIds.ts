import { Platform } from 'react-native';

/**
 * AdMob ids. The app ids also sit in app.json (the library's config plugin writes them into
 * the native project); the rewarded unit ids are used here. Until the owner's own ids are
 * filled in, these are Google's public sample ids, which only ever serve test ads.
 * Ids are not secrets: they ship inside every app that shows ads.
 */
export const ADMOB_IDS = {
  ios: { rewarded: 'ca-app-pub-3940256099942544/1712485313' },
  android: { rewarded: 'ca-app-pub-3940256099942544/5224354917' },
} as const;

/** Google's sample publisher id: anything under it is a test ad. */
export const SAMPLE_PUBLISHER = 'ca-app-pub-3940256099942544';

export function rewardedUnitId(): string {
  return Platform.OS === 'android' ? ADMOB_IDS.android.rewarded : ADMOB_IDS.ios.rewarded;
}

/** True while the ids above are still Google's samples (the build shows test ads only). */
export function usingSampleIds(): boolean {
  return rewardedUnitId().startsWith(SAMPLE_PUBLISHER);
}
