import { createMemoryProvider, EVENT_NAMES, resetAnalytics, setAnalyticsProvider } from '@/analytics';
import { getDifficulties, getRunLengths } from '@/engine';
import { advance, createGarage } from '@/idle';
import { aiLabGarage } from '@/content/packs/ai-lab/garage';

import { getPackEntry } from '../../packs';
import { t } from '../../i18n';
import { demoAllowedIds, demoClamp, DEMO_LIMITS, isDemo, isLockedInDemo, isStageLockedInDemo } from '../config';
import { DEMO_LOCK_UPGRADE, demoGarage } from '../garage';
import { openWaitlist, useDemoGate } from '../gate';
import { trackDemoGateSeenOnce } from '../../analytics/hooks';
import { DEMO_URL, DISCORD_URL, isPlaceholderLink, WAITLIST_URL } from '../links';
import { demoBlocks, demoOption } from '../options';
import { speedForKey, webFitCss } from '../webFit';
import en from '../../strings/demo.en.json';
import tr from '../../strings/demo.tr.json';

const { pack } = getPackEntry();
const levels = getDifficulties(pack).map((d) => d.id);
const lengths = getRunLengths(pack).map((r) => r.id);

describe('demo mode flag', () => {
  it('is off in tests (no EXPO_PUBLIC_DEMO): the full game', () => {
    expect(isDemo()).toBe(false);
  });

  it('locks nothing when off', () => {
    for (const id of levels) expect(isLockedInDemo('difficulty', id, pack)).toBe(false);
    for (const id of lengths) expect(isLockedInDemo('runLength', id, pack)).toBe(false);
    expect(isStageLockedInDemo(4)).toBe(false);
    expect(demoClamp('runLength', pack, lengths[lengths.length - 1])).toBe(lengths[lengths.length - 1]);
  });
});

describe('demo mode rules (on)', () => {
  it('offers the two easiest levels and the shortest run length', () => {
    expect(demoAllowedIds('difficulty', pack)).toEqual(levels.slice(0, 2));
    expect(demoAllowedIds('runLength', pack)).toEqual(lengths.slice(0, 1));
    levels.forEach((id, i) => expect(isLockedInDemo('difficulty', id, pack, true)).toBe(i >= DEMO_LIMITS.difficulty));
    lengths.forEach((id, i) => expect(isLockedInDemo('runLength', id, pack, true)).toBe(i >= DEMO_LIMITS.runLength));
    expect(isLockedInDemo('difficulty', 'no-such-level', pack, true)).toBe(false);
    expect(isLockedInDemo('difficulty', undefined, pack, true)).toBe(false);
  });

  it('clamps a stored locked choice to the last one the demo offers', () => {
    expect(demoClamp('difficulty', pack, levels[3], true)).toBe(levels[1]);
    expect(demoClamp('difficulty', pack, levels[0], true)).toBe(levels[0]);
    expect(demoClamp('runLength', pack, lengths[1], true)).toBe(lengths[0]);
    expect(demoClamp('runLength', pack, undefined, true)).toBeUndefined();
  });

  it('marks locked options with the full-game note and leaves the others alone', () => {
    const open = { id: levels[0], desc: 'd', name: 'n' };
    expect(demoOption('difficulty', pack, open, true)).toBe(open);
    expect(demoOption('difficulty', pack, { id: levels[2], desc: 'd', name: 'n' }, true).desc).toBe(t('ui.demo.locked.difficulty'));
    const long = demoOption('runLength', pack, { id: lengths[1], desc: 'd', minutes: '20 min' }, true);
    expect(long.desc).toBe(t('ui.demo.locked.runLength'));
    expect(long.minutes).toBe(t('ui.demo.locked.short'));
    const off = { id: levels[3], desc: 'd' };
    expect(demoOption('difficulty', pack, off, false)).toBe(off);
  });

  it('blocks a locked pick and opens the waitlist card', () => {
    useDemoGate.getState().hide();
    expect(demoBlocks('difficulty', pack, levels[0], true)).toBe(false);
    expect(useDemoGate.getState().feature).toBeNull();
    expect(demoBlocks('difficulty', pack, levels[3], true)).toBe(true);
    expect(useDemoGate.getState().feature).toBe('difficulty');
    useDemoGate.getState().hide();
    expect(demoBlocks('runLength', pack, lengths[1], false)).toBe(false);
    expect(useDemoGate.getState().feature).toBeNull();
  });
});

describe('demo Garage', () => {
  it('returns the same content object in the full game', () => {
    expect(demoGarage(aiLabGarage, false)).toBe(aiLabGarage);
  });

  it('never moves the lab past the second stage, whatever it earns', () => {
    const content = demoGarage(aiLabGarage, true);
    expect(demoGarage(aiLabGarage, true)).toBe(content);
    expect(content.stages?.length).toBe(aiLabGarage.stages?.length);
    content.stages?.forEach((st, i) => {
      const locked = st.requires.some((r) => r.type === 'upgrade' && r.id === DEMO_LOCK_UPGRADE);
      expect(locked).toBe(i >= DEMO_LIMITS.garageStage);
    });
    const rich = (c: typeof content) => {
      const s = createGarage(c, 0, 1);
      return { ...s, generation: 20, stats: { ...s.stats, tokensAllTime: 1e30 } };
    };
    expect(advance(rich(content), content, 1000).stage).toBe(DEMO_LIMITS.garageStage - 1);
    // The full game moves all the way with the same save.
    expect(advance(rich(aiLabGarage), aiLabGarage, 1000).stage).toBe((aiLabGarage.stages?.length ?? 1) - 1);
  });
});

describe('demo browser fit', () => {
  it('maps space to pause / resume and 1-3 to speeds', () => {
    expect(speedForKey(' ', 2, 1)).toBe(0);
    expect(speedForKey(' ', 0, 3)).toBe(3);
    expect(speedForKey(' ', 0, 0)).toBe(1);
    expect(speedForKey('1', 0, 1)).toBe(1);
    expect(speedForKey('3', 1, 1)).toBe(3);
    expect(speedForKey('4', 1, 1)).toBeNull();
    expect(speedForKey('a', 1, 1)).toBeNull();
  });

  it('turns off selection and overscroll but keeps text fields selectable', () => {
    const css = webFitCss('#000');
    expect(css).toContain('user-select:none');
    expect(css).toContain('overscroll-behavior:none');
    expect(css).toMatch(/input,textarea[^{]*\{[^}]*user-select:text/);
  });
});

describe('demo links, strings and events', () => {
  it('has the three link constants (placeholders until the owner fills them in)', () => {
    for (const url of [DEMO_URL, WAITLIST_URL, DISCORD_URL]) expect(url).toMatch(/^https:\/\//);
    expect(isPlaceholderLink('https://example.com/x')).toBe(true);
    expect(isPlaceholderLink('https://forms.example.org/x')).toBe(false);
  });

  it('has every English key in Turkish with the same placeholders', () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph(tr[k])).toEqual(ph(en[k]));
  });

  it('has a gate text for every lockable feature', () => {
    for (const f of ['difficulty', 'runLength', 'garageStage']) expect(t(`ui.demo.gate.body.${f}`, { stage: 'X' })).not.toContain('ui.demo');
  });

  it('declares and sends the two demo analytics events', () => {
    expect(EVENT_NAMES).toContain('demo_cta_tap');
    expect(EVENT_NAMES).toContain('demo_gate_seen');
    resetAnalytics();
    const memory = createMemoryProvider();
    setAnalyticsProvider(memory);
    openWaitlist('end');
    trackDemoGateSeenOnce('garageStage');
    trackDemoGateSeenOnce('garageStage');
    const sent = memory.events.map((e) => [e.name, e.params]);
    expect(sent).toEqual([
      ['demo_cta_tap', { where: 'end' }],
      ['demo_gate_seen', { feature: 'garageStage' }],
    ]);
    resetAnalytics();
  });
});
