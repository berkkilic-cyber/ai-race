import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { logLifecycle } from '../diagnostics/log';
import { createAdmobProvider, type AdmobLib } from './admobProvider';
import { rewardedUnitId, usingSampleIds } from './admobIds';
import { setAdProvider } from './ads';
import { loadAtt, loadGma, type Gma } from './gma';
import type { AdProvider } from './types';

/** A provider that never has an ad: what a shipped build uses until AdMob is ready. */
export const noAdsProvider: AdProvider = {
  name: 'none',
  isAvailable: () => false,
  show: () => Promise.resolve('unavailable'),
};

let installed = false;

/**
 * Chooses the ad source for this build.
 *   - Browser, Expo Go and Jest: the built-in test ad (the AdMob library is native code and
 *     is not there).
 *   - A real build: AdMob. Order matters: Apple's tracking prompt, then Google's consent
 *     form where the law asks for one, then the SDK starts, then the first ad loads.
 * A shipped build never shows the built-in test ad: if AdMob cannot start, ad buttons are
 * simply unavailable.
 */
export function installAds(): void {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web' || process.env.JEST_WORKER_ID !== undefined) return;
  if (Constants.executionEnvironment === 'storeClient') return; // Expo Go

  let loadedGma: Gma | null = null;
  try {
    loadedGma = loadGma();
  } catch (e) {
    logLifecycle('ads: AdMob library missing', { error: String(e) });
  }
  if (!loadedGma) {
    if (!__DEV__) setAdProvider(noAdsProvider);
    return;
  }
  const gma = loadedGma;

  const lib: AdmobLib = {
    createRewarded: (unitId) => gma.RewardedAd.createForAdRequest(unitId) as unknown as ReturnType<AdmobLib['createRewarded']>,
    events: {
      loaded: gma.RewardedAdEventType.LOADED,
      earned: gma.RewardedAdEventType.EARNED_REWARD,
      closed: gma.AdEventType.CLOSED,
      error: gma.AdEventType.ERROR,
    },
  };
  const provider = createAdmobProvider(lib, { unitId: rewardedUnitId(), log: (m, d) => logLifecycle(`ads: ${m}`, d) });
  setAdProvider(provider);
  logLifecycle('ads: AdMob selected', { sampleIds: usingSampleIds() });

  void (async () => {
    if (Platform.OS === 'ios') {
      try {
        await loadAtt()?.requestTrackingPermissionsAsync();
      } catch (e) {
        logLifecycle('ads: tracking prompt skipped', { error: String(e) });
      }
    }
    try {
      await gma.AdsConsent.gatherConsent();
    } catch (e) {
      logLifecycle('ads: consent step failed', { error: String(e) });
    }
    try {
      await gma.default().initialize();
      provider.start();
    } catch (e) {
      logLifecycle('ads: AdMob start failed', { error: String(e) });
    }
  })();
}
