import type { AdProvider, AdResult } from './types';

/**
 * Rewarded ads from AdMob, behind the same two-method provider the mock implements.
 *
 * One rewarded ad is kept loaded at a time and shared by every placement (the placement
 * decides the reward, not the ad). After an ad closes or fails, the next one is requested;
 * a failed load is retried with a growing delay. `show` resolves when the ad has closed:
 * 'rewarded' only if AdMob reported the reward as earned.
 *
 * The library is passed in (see installAds.ts) so this file has no native import and the
 * logic runs under Jest.
 */

/** The part of react-native-google-mobile-ads this provider uses. */
export interface RewardedLike {
  load(): void;
  show(): Promise<unknown>;
  addAdEventListener(type: string, listener: (payload?: unknown) => void): () => void;
}

export interface AdmobLib {
  createRewarded(unitId: string): RewardedLike;
  events: { loaded: string; earned: string; closed: string; error: string };
}

export interface AdmobProviderOptions {
  unitId: string;
  /** Delay before retrying a failed load, in ms, by attempt (the last value repeats). */
  retryMs?: readonly number[];
  setTimer?: (fn: () => void, ms: number) => unknown;
  log?: (message: string, data?: Record<string, string>) => void;
}

export interface AdmobProvider extends AdProvider {
  /** Starts loading the first ad (call once consent and SDK start-up are done). */
  start(): void;
}

const DEFAULT_RETRY_MS = [5_000, 15_000, 30_000, 60_000] as const;

export function createAdmobProvider(lib: AdmobLib, options: AdmobProviderOptions): AdmobProvider {
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const log = options.log ?? (() => {});

  let started = false;
  let ad: RewardedLike | null = null;
  let loaded = false;
  let loading = false;
  let failures = 0;
  /** Set while an ad is on screen: how to settle the `show` promise. */
  let settle: ((result: AdResult) => void) | null = null;
  let earned = false;
  let unsubscribe: (() => void)[] = [];

  function drop(): void {
    for (const off of unsubscribe) {
      try {
        off();
      } catch {
        // a listener that is already gone is fine
      }
    }
    unsubscribe = [];
    ad = null;
    loaded = false;
    loading = false;
  }

  function finish(result: AdResult): void {
    const done = settle;
    settle = null;
    earned = false;
    drop();
    load();
    done?.(result);
  }

  function load(): void {
    if (!started || loading || loaded) return;
    let next: RewardedLike;
    try {
      next = lib.createRewarded(options.unitId);
    } catch (e) {
      log('ad create failed', { error: String(e) });
      scheduleRetry();
      return;
    }
    ad = next;
    loading = true;
    unsubscribe = [
      next.addAdEventListener(lib.events.loaded, () => {
        if (ad !== next) return;
        loaded = true;
        loading = false;
        failures = 0;
        log('ad loaded');
      }),
      next.addAdEventListener(lib.events.earned, () => {
        if (ad === next) earned = true;
      }),
      next.addAdEventListener(lib.events.closed, () => {
        if (ad !== next) return;
        finish(earned ? 'rewarded' : 'dismissed');
      }),
      next.addAdEventListener(lib.events.error, (error) => {
        if (ad !== next) return;
        log('ad error', { error: String((error as { message?: unknown } | undefined)?.message ?? error) });
        if (settle) {
          // Failed while showing: no reward, and try for a fresh ad.
          finish('unavailable');
          return;
        }
        drop();
        scheduleRetry();
      }),
    ];
    try {
      next.load();
    } catch (e) {
      log('ad load threw', { error: String(e) });
      drop();
      scheduleRetry();
    }
  }

  function scheduleRetry(): void {
    const delay = retryMs[Math.min(failures, retryMs.length - 1)] ?? 60_000;
    failures += 1;
    setTimer(load, delay);
  }

  return {
    name: 'admob',
    start() {
      if (started) return;
      started = true;
      load();
    },
    isAvailable: () => loaded && settle === null,
    show() {
      const current = ad;
      if (!current || !loaded || settle) return Promise.resolve<AdResult>('unavailable');
      return new Promise<AdResult>((resolve) => {
        settle = resolve;
        earned = false;
        loaded = false;
        current.show().catch((e: unknown) => {
          log('ad show failed', { error: String(e) });
          if (ad === current && settle) finish('unavailable');
        });
      });
    },
  };
}
