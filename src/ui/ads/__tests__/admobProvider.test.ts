import { createAdmobProvider, type AdmobLib, type RewardedLike } from '../admobProvider';

const EVENTS = { loaded: 'loaded', earned: 'earned', closed: 'closed', error: 'error' };

class FakeAd implements RewardedLike {
  listeners = new Map<string, ((p?: unknown) => void)[]>();
  loads = 0;
  shows = 0;
  showFails = false;
  load(): void {
    this.loads += 1;
  }
  show(): Promise<unknown> {
    this.shows += 1;
    return this.showFails ? Promise.reject(new Error('not ready')) : Promise.resolve();
  }
  addAdEventListener(type: string, listener: (p?: unknown) => void): () => void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
    return () => this.listeners.set(type, (this.listeners.get(type) ?? []).filter((l) => l !== listener));
  }
  emit(type: string, payload?: unknown): void {
    for (const l of [...(this.listeners.get(type) ?? [])]) l(payload);
  }
}

function setup() {
  const ads: FakeAd[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const lib: AdmobLib = {
    createRewarded: () => {
      const ad = new FakeAd();
      ads.push(ad);
      return ad;
    },
    events: EVENTS,
  };
  const provider = createAdmobProvider(lib, { unitId: 'unit', retryMs: [100, 200], setTimer: (fn, ms) => timers.push({ fn, ms }) });
  return { ads, timers, provider };
}

describe('AdMob rewarded provider', () => {
  it('has no ad until started and loaded', () => {
    const { ads, provider } = setup();
    expect(provider.isAvailable('boost')).toBe(false);
    expect(ads).toHaveLength(0);
    provider.start();
    expect(ads).toHaveLength(1);
    expect(ads[0]!.loads).toBe(1);
    expect(provider.isAvailable('boost')).toBe(false);
    ads[0]!.emit('loaded');
    expect(provider.isAvailable('boost')).toBe(true);
  });

  it('resolves rewarded when the reward was earned before the ad closed, then loads the next ad', async () => {
    const { ads, provider } = setup();
    provider.start();
    ads[0]!.emit('loaded');
    const shown = provider.show('boost', { reward: 'x' });
    expect(provider.isAvailable('boost')).toBe(false);
    ads[0]!.emit('earned');
    ads[0]!.emit('closed');
    await expect(shown).resolves.toBe('rewarded');
    expect(ads).toHaveLength(2);
    expect(ads[1]!.loads).toBe(1);
    ads[1]!.emit('loaded');
    expect(provider.isAvailable('crate')).toBe(true);
  });

  it('resolves dismissed when the ad closed without a reward', async () => {
    const { ads, provider } = setup();
    provider.start();
    ads[0]!.emit('loaded');
    const shown = provider.show('boost', { reward: 'x' });
    ads[0]!.emit('closed');
    await expect(shown).resolves.toBe('dismissed');
  });

  it('does not carry an earned reward over to the next ad', async () => {
    const { ads, provider } = setup();
    provider.start();
    ads[0]!.emit('loaded');
    const first = provider.show('boost', { reward: 'x' });
    ads[0]!.emit('earned');
    ads[0]!.emit('closed');
    await first;
    ads[1]!.emit('loaded');
    const second = provider.show('boost', { reward: 'x' });
    ads[1]!.emit('closed');
    await expect(second).resolves.toBe('dismissed');
  });

  it('is unavailable when asked with nothing loaded or while an ad is showing', async () => {
    const { ads, provider } = setup();
    await expect(provider.show('boost', { reward: 'x' })).resolves.toBe('unavailable');
    provider.start();
    ads[0]!.emit('loaded');
    const shown = provider.show('boost', { reward: 'x' });
    await expect(provider.show('crate', { reward: 'y' })).resolves.toBe('unavailable');
    ads[0]!.emit('closed');
    await shown;
  });

  it('retries a failed load with a growing delay and resets the delay after a success', () => {
    const { ads, timers, provider } = setup();
    provider.start();
    ads[0]!.emit('error', { message: 'no fill' });
    expect(provider.isAvailable('boost')).toBe(false);
    expect(timers.map((t) => t.ms)).toEqual([100]);
    timers[0]!.fn();
    expect(ads).toHaveLength(2);
    ads[1]!.emit('error', { message: 'no fill' });
    expect(timers.map((t) => t.ms)).toEqual([100, 200]);
    timers[1]!.fn();
    ads[2]!.emit('loaded');
    expect(provider.isAvailable('boost')).toBe(true);
    // events from an ad that was replaced are ignored
    ads[0]!.emit('loaded');
    ads[1]!.emit('closed');
    expect(ads).toHaveLength(3);
  });

  it('resolves unavailable and reloads when showing fails', async () => {
    const { ads, provider } = setup();
    provider.start();
    ads[0]!.emit('loaded');
    ads[0]!.showFails = true;
    await expect(provider.show('boost', { reward: 'x' })).resolves.toBe('unavailable');
    expect(ads).toHaveLength(2);
  });

  it('resolves unavailable when the ad errors while on screen', async () => {
    const { ads, provider } = setup();
    provider.start();
    ads[0]!.emit('loaded');
    const shown = provider.show('boost', { reward: 'x' });
    ads[0]!.emit('error', new Error('playback'));
    await expect(shown).resolves.toBe('unavailable');
    expect(ads).toHaveLength(2);
  });
});
