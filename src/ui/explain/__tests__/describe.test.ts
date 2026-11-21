import type { Effect, Modifier, NodeDef, Stat } from '@/engine';

import { setI18nContext } from '../../i18n';
import { getPackEntry } from '../../packs';
import { describeChannel, describeEffect, describeEffects, describeFlag, describeModifier, describeNode, STAT_HIGHER_IS_GOOD, statPhrase, tagLabel } from '../describe';

const pack = getPackEntry().pack;

beforeAll(() => setI18nContext(pack, null));

/** The pack's own phrases, with the size filled in: the describer must use them, not its own words. */
const phrase = (stat: Stat, dir: 'gain' | 'loss', pct: string) => pack.strings.en[`stat.${stat}.${dir}`].replace('{pct}', pct);

const STATS = Object.keys(STAT_HIGHER_IS_GOOD) as Stat[];

describe('describeModifier', () => {
  it('covers every stat the engine knows', () => {
    const engineStats: Stat[] = [
      'spreadRate',
      'seedChance',
      'cashIncome',
      'hypeIncome',
      'computeCapacity',
      'agiRate',
      'regulationGain',
      'backlashGain',
      'riskChance',
      'dataCentreCost',
      'dataCentreUpkeep',
      'launchCost',
      'nodeCost',
      'acquireCost',
      'banDuration',
    ];
    expect([...STATS].sort()).toEqual([...engineStats].sort());
  });

  describe.each(STATS)('%s', (stat) => {
    const good = STAT_HIGHER_IS_GOOD[stat];

    it('mul above 1 uses the gain phrase', () => {
      expect(describeModifier({ stat, op: 'mul', value: 1.2 })).toEqual({ text: phrase(stat, 'gain', '20%'), tone: good ? 'good' : 'bad' });
    });

    it('mul below 1 uses the loss phrase', () => {
      expect(describeModifier({ stat, op: 'mul', value: 0.75 })).toEqual({ text: phrase(stat, 'loss', '25%'), tone: good ? 'bad' : 'good' });
    });

    it('add reads as the same percentage', () => {
      expect(describeModifier({ stat, op: 'add', value: 0.1 })).toEqual({ text: phrase(stat, 'gain', '10%'), tone: good ? 'good' : 'bad' });
      expect(describeModifier({ stat, op: 'add', value: -0.05 })).toEqual({ text: phrase(stat, 'loss', '5%'), tone: good ? 'bad' : 'good' });
    });
  });

  it('says what the product owner asked about in plain words', () => {
    expect(describeModifier({ stat: 'launchCost', op: 'mul', value: 0.75 })).toEqual({ text: 'Launching in a new region costs 25% less', tone: 'good' });
    expect(describeModifier({ stat: 'spreadRate', op: 'mul', value: 1.2 }).text).toBe('Spreads 20% faster');
    expect(describeModifier({ stat: 'regulationGain', op: 'mul', value: 0.75 })).toEqual({ text: 'Regulators notice you 25% less', tone: 'good' });
    expect(describeModifier({ stat: 'regulationGain', op: 'mul', value: 1.1 }).tone).toBe('bad');
  });

  it('never shows the old terse form', () => {
    for (const stat of STATS) {
      expect(describeModifier({ stat, op: 'mul', value: 0.75 }).text).not.toMatch(/^[+−-]\d/);
    }
  });

  it('adds a readable region suffix', () => {
    expect(describeModifier({ stat: 'spreadRate', op: 'mul', value: 1.15, regionTag: 'eu' }).text).toBe('Spreads 15% faster in EU regions');
    expect(describeModifier({ stat: 'spreadRate', op: 'mul', value: 1.4, regionTag: 'spanish' }).text).toBe('Spreads 40% faster in Spanish-speaking regions');
  });

  it('falls back to a generic name for unknown tags', () => {
    expect(tagLabel('moon-base')).toBe('moon base regions');
  });

  it('keeps a decimal for small changes', () => {
    expect(statPhrase('spreadRate', 0.05)).toBe('Spreads 5% faster');
    expect(statPhrase('spreadRate', 0.005)).toBe('Spreads 0.5% faster');
  });
});

describe('describeChannel', () => {
  it('describes every channel in the pack without placeholders', () => {
    for (const channel of pack.channels ?? []) {
      const line = describeChannel(channel.id, pack.channels);
      expect(line.tone).toBe('good');
      expect(line.text).not.toMatch(/[{}]/);
      expect(line.text.length).toBeGreaterThan(5);
    }
  });

  it('crosses oceans', () => {
    expect(describeChannel('ocean', pack.channels).text).toBe('Your model crosses oceans');
  });

  it('falls back by kind for channels without their own line', () => {
    expect(describeChannel('teleport', [{ id: 'teleport', nameKey: 'x', kind: 'jump' }]).text).toBe('Can skip a neighbouring region when spreading');
    expect(describeChannel('moon', [{ id: 'moon', nameKey: 'x', kind: 'clear', clears: ['ocean'] }]).text).toBe('Gets past Ocean');
  });
});

describe('describeFlag', () => {
  it('names the buyout flag and timed channel flags, hides the rest', () => {
    expect(describeFlag('canAcquire')).toEqual({ text: 'Lets you buy out rival labs', tone: 'good' });
    expect(describeFlag('channel:open', pack.channels, 600)).toEqual({ text: "Everything spreads more easily (rivals' too) for 600 days", tone: 'good' });
    expect(describeFlag('$internal')).toBeNull();
    expect(describeFlag('podbay')).toBeNull();
  });
});

describe('describeEffect', () => {
  const cases: [Effect, string, 'good' | 'bad'][] = [
    [{ type: 'resource', resource: 'hype', amount: 10 }, 'Get 10 Hype now', 'good'],
    [{ type: 'resource', resource: 'cash', amount: -50 }, 'Lose $50M now', 'bad'],
    [{ type: 'resource', resource: 'cash', amount: 30, target: 'leadRival' }, 'The leading rival gets $30M', 'bad'],
    [{ type: 'resource', resource: 'hype', amount: 5, scaleWithIncome: 20 }, 'Get 5 Hype now, plus 20 days of your usual income', 'good'],
    [{ type: 'resourcePercent', resource: 'hype', percent: 10 }, 'Get 10% more Hype now', 'good'],
    [{ type: 'resourcePercent', resource: 'cash', percent: -20 }, 'Lose 20% of your Cash', 'bad'],
    [{ type: 'meter', meter: 'backlash', amount: 5 }, 'Backlash rises by 5%', 'bad'],
    [{ type: 'meter', meter: 'regulation', amount: -4 }, 'Regulation falls by 4%', 'good'],
    [{ type: 'meter', meter: 'regulation', amount: 8, target: 'leadRival' }, "The leading rival's Regulation rises by 8%", 'good'],
    [{ type: 'agiProgress', amount: -3, target: 'leadRival' }, 'The leading rival loses 3% of its AGI progress', 'good'],
    [{ type: 'agiProgress', amount: 2 }, 'Moves you 2% closer to AGI', 'good'],
    [{ type: 'agiProgress', amount: 2, target: 'rivals' }, 'Every rival moves 2% closer to AGI', 'bad'],
    [{ type: 'compute', amount: 3 }, 'Adds 3 compute for good', 'good'],
    [{ type: 'compute', amount: 5, target: 'rivals' }, 'Every rival gets 5 more compute', 'bad'],
    [{ type: 'adoption', scope: { kind: 'all' }, factor: 1.1 }, '10% more users in every region', 'good'],
    [{ type: 'adoption', scope: { kind: 'top', count: 2 }, factor: 0.8, target: 'leadRival' }, 'The leading rival loses 20% of its users in their top 2 regions', 'good'],
    [{ type: 'ban', scope: { kind: 'tag', tag: 'eu' }, durationTicks: 30 }, 'Banned in EU regions for 30 days', 'bad'],
    [{ type: 'ban', scope: { kind: 'home' }, durationTicks: -1 }, 'Banned in your home region for good', 'bad'],
    [{ type: 'unban', scope: { kind: 'home' } }, 'Ban lifted in your home region', 'good'],
    [
      { type: 'timedModifier', modifier: { stat: 'agiRate', op: 'mul', value: 0.8 }, durationTicks: 300, target: 'rivals' },
      'Every rival: research 20% slower for 300 days',
      'good',
    ],
    [{ type: 'timedModifier', modifier: { stat: 'spreadRate', op: 'mul', value: 1.3 }, durationTicks: 100 }, 'Spreads 30% faster for 100 days', 'good'],
    [{ type: 'dataCentre', action: 'disable', scope: { kind: 'top', count: 2 }, durationTicks: 10 }, 'Your data centres in your top 2 regions go offline for 10 days', 'bad'],
    [{ type: 'dataCentre', action: 'destroy', scope: { kind: 'random', count: 1 } }, 'Your data centres in 1 of your regions are destroyed', 'bad'],
    [{ type: 'setFlag', flag: 'canAcquire' }, 'Lets you buy out rival labs', 'good'],
  ];
  it.each(cases)('%j', (effect, text, tone) => {
    expect(describeEffect(effect, { channels: pack.channels })).toEqual({ text, tone });
  });

  it('skips news and unknown flags', () => {
    expect(describeEffect({ type: 'news', textKey: 'x' })).toBeNull();
    expect(describeEffect({ type: 'setFlag', flag: '$internal' })).toBeNull();
    expect(describeEffects([{ type: 'news', textKey: 'x' }, { type: 'compute', amount: 1 }])).toHaveLength(1);
  });

  it('describes every effect of every event choice in the pack without placeholders', () => {
    for (const event of pack.events) {
      for (const choice of event.choices) {
        for (const line of describeEffects([...choice.effects, ...(choice.risk?.effects ?? [])], { channels: pack.channels })) {
          expect(line.text).not.toMatch(/[{}]/);
        }
      }
    }
  });
});

describe('describeNode', () => {
  const base: NodeDef = { id: 'n', tree: 'capability', nameKey: 'n', descKey: 'n', cost: 1, requires: [], row: 1, col: 1, modifiers: [] };

  it('lists tier, channels, flags, modifiers, then one-off effects', () => {
    const modifiers: Modifier[] = [{ stat: 'backlashGain', op: 'mul', value: 1.1 }];
    const lines = describeNode(
      {
        ...base,
        capabilityLevel: 3,
        channels: ['ocean'],
        grantsFlags: ['canAcquire'],
        modifiers,
        onBuy: [{ type: 'resource', resource: 'hype', amount: 10 }],
      },
      { channels: pack.channels, computeFor: (tier) => tier * 14 },
    );
    expect(lines).toEqual([
      { text: 'Your Model tier 3: needs 42 compute to run', tone: 'good' },
      { text: 'Your model crosses oceans', tone: 'good' },
      { text: 'Lets you buy out rival labs', tone: 'good' },
      { text: 'The public turns on you 10% faster', tone: 'bad' },
      { text: 'Get 10 Hype now', tone: 'good' },
    ]);
  });

  it('leaves the compute out when it is not known', () => {
    expect(describeNode({ ...base, capabilityLevel: 2 })[0].text).toBe('Your Model tier 2');
  });

  it('describes every node in the pack without placeholders', () => {
    for (const node of pack.nodes) {
      const lines = describeNode(node, { channels: pack.channels, computeFor: () => 10 });
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.text).not.toMatch(/[{}]/);
    }
  });
});
