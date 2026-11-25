import { claimOffer, createGarage, offerStatus, type UpgradeEffect } from '@/idle';

import { mockProvider, requestRewardedAd, setAdProvider, useAdStore, type AdProvider } from '../../ads';
import { hasIcon } from '../../icons';
import { readValue, setStorageBackend } from '../../tutorial/storage';
import { garageContent } from '../content';
import { SAVE_KEY, useGarageStore } from '../store';
import { effectText, generationLabel, gt, requirementText } from '../text';

const content = garageContent();

describe('garage content in the UI', () => {
  it('every icon the content names has a drawing', () => {
    const icons = [
      ...content.generators.map((g) => g.icon),
      ...content.upgrades.map((u) => u.icon),
      ...content.golden.defs.map((d) => d.icon),
      ...content.incidents.defs.map((d) => d.icon),
      ...content.achievements.map((a) => a.icon),
    ];
    for (const icon of icons) expect({ icon, drawn: hasIcon(icon) }).toEqual({ icon, drawn: true });
  });
  it('describes every effect and requirement in words', () => {
    const kinds: UpgradeEffect[] = [
      { kind: 'tapMult', mult: 2 },
      { kind: 'tapFromRate', share: 0.02 },
      { kind: 'generatorMult', generator: 'gpu', mult: 3 },
      { kind: 'globalMult', mult: 1.5 },
      { kind: 'offlineCap', hours: 2 },
      { kind: 'offlineRate', add: 0.15 },
      { kind: 'comboStacks', add: 5 },
      { kind: 'goldenMult', mult: 2 },
      { kind: 'goldenInterval', mult: 0.8 },
    ];
    expect(kinds.map((e) => effectText(e))).toEqual([
      'Taps ×2',
      'Taps +2% of production',
      'Rented GPU ×3',
      'All production ×1.5',
      'Away storage +2 h',
      'Away earnings +15%',
      'Combo cap +5',
      'Golden moments ×2',
      'Golden moments 25% more often',
    ]);
    expect(requirementText({ type: 'owned', generator: 'intern', count: 10 })).toBe('Own 10 Intern with a laptop');
    expect(requirementText({ type: 'lifetime', tokens: 3e6 })).toBe('Earn 3M this model');
    expect(requirementText({ type: 'generation', min: 1 })).toBe('Ship Model 2: Chatty');
  });
  it('translates garage keys inside params and names endless generations', () => {
    expect(gt('garage.incident.gpu-shortage.text', { tier: 'garage.gen.gpu.name' })).toBe('GPU shortage: Rented GPU at half speed');
    expect(gt('garage.news.achievement', { name: 'garage.ach.first-tap.name' })).toBe('Achievement unlocked: Hello, Garage');
    expect(generationLabel(0)).toBe('Model 1: Autocomplete Deluxe');
    expect(generationLabel(40)).toBe('Model 41');
  });
});

describe('garage store', () => {
  beforeEach(() => {
    setStorageBackend(null);
    useGarageStore.setState({ state: null, launch: null, flash: null });
  });
  it('loads a fresh save, taps, buys and saves', async () => {
    await useGarageStore.getState().load();
    const s = useGarageStore.getState();
    expect(s.state?.tokens).toBe(0);
    for (let i = 0; i < 20; i++) useGarageStore.getState().tap();
    expect(useGarageStore.getState().state!.stats.taps).toBe(20);
    expect(useGarageStore.getState().buy('intern')).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse((await readValue(SAVE_KEY))!);
    expect(saved.state.generators.intern).toBe(1);
  });
  it('reset wipes the garage', async () => {
    await useGarageStore.getState().load();
    useGarageStore.getState().tap();
    useGarageStore.getState().reset();
    expect(useGarageStore.getState().state!.stats.taps).toBe(0);
  });
});

describe('ad layer', () => {
  beforeEach(() => {
    useAdStore.setState({ adsRemoved: false, mock: null, stats: useAdStore.getState().stats });
    setAdProvider(mockProvider);
  });
  it('the mock provider shows a test ad and resolves when it is claimed or closed', async () => {
    const before = useAdStore.getState().stats.boost.rewarded;
    const p = requestRewardedAd('boost', '+30 min');
    await Promise.resolve();
    const mock = useAdStore.getState().mock!;
    expect(mock.placement).toBe('boost');
    expect(mock.reward).toBe('+30 min');
    mock.resolve('rewarded');
    await expect(p).resolves.toBe('rewarded');
    expect(useAdStore.getState().mock).toBeNull();
    expect(useAdStore.getState().stats.boost.rewarded).toBe(before + 1);
    const q = requestRewardedAd('crate', 'x');
    await Promise.resolve();
    useAdStore.getState().mock!.resolve('dismissed');
    await expect(q).resolves.toBe('dismissed');
  });
  it('one ad at a time; unavailable providers degrade to "unavailable"', async () => {
    const first = requestRewardedAd('boost', 'a');
    await expect(requestRewardedAd('crate', 'b')).resolves.toBe('unavailable');
    useAdStore.getState().mock!.resolve('rewarded');
    await first;
    const none: AdProvider = { name: 'none', isAvailable: () => false, show: async () => 'rewarded' };
    setAdProvider(none);
    await expect(requestRewardedAd('boost', 'a')).resolves.toBe('unavailable');
  });
  it('with ads removed, rewards are granted without an ad', async () => {
    useAdStore.setState({ adsRemoved: true });
    const granted = useAdStore.getState().stats.crate.granted;
    await expect(requestRewardedAd('crate', 'x')).resolves.toBe('rewarded');
    expect(useAdStore.getState().mock).toBeNull();
    expect(useAdStore.getState().stats.crate.granted).toBe(granted + 1);
  });
  it('the reward itself is still capped by the engine', () => {
    let s = createGarage(content, 1_700_000_000_000);
    s = claimOffer(s, content, 'crate', s.now).state;
    expect(offerStatus(s, content, 'crate', s.now).reason).toBe('cooldown');
  });
});
