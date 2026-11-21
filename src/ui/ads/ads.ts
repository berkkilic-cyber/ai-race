import { logLifecycle } from '../diagnostics/log';
import { mockProvider } from './mockProvider';
import { useAdStore } from './store';
import type { AdProvider, AdResult, PlacementId } from './types';

let provider: AdProvider = mockProvider;
let inFlight = false;

/** Swap the ad source (a real SDK-backed provider in a development build; tests). */
export function setAdProvider(next: AdProvider): void {
  provider = next;
}

export function getAdProvider(): AdProvider {
  return provider;
}

/** True when pressing an ad button can lead to a reward right now. */
export function adReady(placement: PlacementId): boolean {
  return useAdStore.getState().adsRemoved || (!inFlight && provider.isAvailable(placement));
}

/**
 * Asks for a rewarded ad. Opt-in only: call this from a button the player pressed after
 * seeing the reward. With ads removed the reward is granted at once. Logs every request,
 * show and result with `[AI-RACE]` lines and counts them per placement.
 */
export async function requestRewardedAd(placement: PlacementId, reward: string): Promise<AdResult> {
  const store = useAdStore.getState();
  store.count(placement, 'requested');
  logLifecycle('ad requested', { placement, provider: provider.name });
  if (store.adsRemoved) {
    store.count(placement, 'granted');
    logLifecycle('ad reward granted without ad', { placement });
    return 'rewarded';
  }
  if (inFlight || !provider.isAvailable(placement)) {
    store.count(placement, 'unavailable');
    logLifecycle('ad unavailable', { placement });
    return 'unavailable';
  }
  inFlight = true;
  try {
    store.count(placement, 'shown');
    logLifecycle('ad shown', { placement });
    let result: AdResult;
    try {
      result = await provider.show(placement, { reward });
    } catch {
      result = 'unavailable';
    }
    useAdStore.getState().count(placement, result === 'rewarded' ? 'rewarded' : result === 'dismissed' ? 'dismissed' : 'unavailable');
    logLifecycle(result === 'rewarded' ? 'ad rewarded' : `ad ${result}`, { placement });
    return result;
  } finally {
    inFlight = false;
  }
}
