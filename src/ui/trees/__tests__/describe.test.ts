import type { Effect, Modifier, NodeDef, Stat } from '@/engine';

import { setI18nContext } from '../../i18n';
import { getPackEntry } from '../../packs';
import { describeEffect, describeModifier, describeNode, STAT_HIGHER_IS_GOOD, statLabel, tagLabel } from '../describe';

const pack = getPackEntry().pack;
const MINUS = '−';

beforeAll(() => setI18nContext(pack, null));

const EXPECTED_LABEL: Record<Stat, string> = {
  spreadRate: 'spread',
  seedChance: 'chance to reach new regions',
  cashIncome: 'cash income',
  hypeIncome: 'hype income',
  computeCapacity: 'compute capacity',
  agiRate: 'AGI speed',
  regulationGain: 'regulation gain',
  backlashGain: 'backlash gain',
  riskChance: 'scandal risk',
  dataCentreCost: 'data centre cost',
  dataCentreUpkeep: 'data centre upkeep',
  launchCost: 'launch cost',
  nodeCost: 'upgrade cost',
  acquireCost: 'buyout cost',
  banDuration: 'ban length',
};

const STATS = Object.keys(STAT_HIGHER_IS_GOOD) as Stat[];

describe('describeModifier', () => {
  it('covers every stat', () => {
    expect(STATS.sort()).toEqual((Object.keys(EXPECTED_LABEL) as Stat[]).sort());
  });

  describe.each(STATS)('%s', (stat) => {
    const good = STAT_HIGHER_IS_GOOD[stat];
    const label = EXPECTED_LABEL[stat];

    it('has a readable label', () => {
      expect(statLabel(stat)).toBe(label);
    });

    it('mul above 1 is a percentage increase', () => {
      expect(describeModifier({ stat, op: 'mul', value: 1.2 })).toEqual({ text: `+20% ${label}`, tone: good ? 'good' : 'bad' });
    });

    it('mul below 1 is a percentage decrease', () => {
      expect(describeModifier({ stat, op: 'mul', value: 0.75 })).toEqual({ text: `${MINUS}25% ${label}`, tone: good ? 'bad' : 'good' });
    });

    it('add is a signed value', () => {
      expect(describeModifier({ stat, op: 'add', value: 0.1 })).toEqual({ text: `+10 pts ${label}`, tone: good ? 'good' : 'bad' });
      expect(describeModifier({ stat, op: 'add', value: -0.05 })).toEqual({ text: `${MINUS}5 pts ${label}`, tone: good ? 'bad' : 'good' });
    });
  });

  it('treats more regulation gain as bad and less as good', () => {
    expect(describeModifier({ stat: 'regulationGain', op: 'mul', value: 1.1 }).tone).toBe('bad');
    expect(describeModifier({ stat: 'regulationGain', op: 'mul', value: 0.75 })).toEqual({ text: `${MINUS}25% regulation gain`, tone: 'good' });
  });

  it('adds a readable region suffix', () => {
    expect(describeModifier({ stat: 'spreadRate', op: 'mul', value: 1.15, regionTag: 'eu' }).text).toBe('+15% spread in EU regions');
    expect(describeModifier({ stat: 'spreadRate', op: 'mul', value: 1.4, regionTag: 'spanish' }).text).toBe('+40% spread in Spanish-speaking regions');
  });

  it('falls back to a generic name for unknown tags', () => {
    expect(tagLabel('moon-base')).toBe('moon base regions');
  });

  it('keeps a decimal for small changes', () => {
    expect(describeModifier({ stat: 'spreadRate', op: 'mul', value: 1.05 }).text).toBe('+5% spread');
    expect(describeModifier({ stat: 'spreadRate', op: 'mul', value: 1.005 }).text).toBe('+0.5% spread');
  });
});

describe('describeEffect', () => {
  const cases: [Effect, string, 'good' | 'bad'][] = [
    [{ type: 'resource', resource: 'hype', amount: 10 }, '+10 Hype now', 'good'],
    [{ type: 'resource', resource: 'cash', amount: -50 }, `${MINUS}$50M Cash now`, 'bad'],
    [{ type: 'resourcePercent', resource: 'hype', percent: 10 }, '+10% Hype now', 'good'],
    [{ type: 'meter', meter: 'backlash', amount: 5 }, '+5 Backlash now', 'bad'],
    [{ type: 'meter', meter: 'regulation', amount: -4 }, `${MINUS}4 Regulation now`, 'good'],
    [{ type: 'agiProgress', amount: -3, target: 'leadRival' }, `${MINUS}3 AGI progress for the leading rival`, 'good'],
    [{ type: 'agiProgress', amount: 2 }, '+2 AGI progress', 'good'],
    [{ type: 'compute', amount: 3 }, '+3 Compute', 'good'],
    [{ type: 'adoption', scope: { kind: 'all' }, factor: 1.1 }, '+10% users in all regions', 'good'],
    [{ type: 'ban', scope: { kind: 'tag', tag: 'eu' }, durationTicks: 30 }, 'Banned in EU regions for 30 days', 'bad'],
    [{ type: 'unban', scope: { kind: 'home' } }, 'Ban lifted in your home region', 'good'],
    [
      { type: 'timedModifier', modifier: { stat: 'agiRate', op: 'mul', value: 0.8 }, durationTicks: 300, target: 'rivals' },
      `${MINUS}20% AGI speed for rivals for 300 days`,
      'good',
    ],
    [{ type: 'dataCentre', action: 'disable', scope: { kind: 'top', count: 2 }, durationTicks: 10 }, 'Data centres offline in your top 2 regions', 'bad'],
    [{ type: 'setFlag', flag: 'canAcquire' }, 'Lets you buy out rivals', 'good'],
  ];
  it.each(cases)('%j', (effect, text, tone) => {
    expect(describeEffect(effect)).toEqual({ text, tone });
  });

  it('skips news and unknown flags', () => {
    expect(describeEffect({ type: 'news', textKey: 'x' })).toBeNull();
    expect(describeEffect({ type: 'setFlag', flag: '$internal' })).toBeNull();
  });
});

describe('describeNode', () => {
  const base: NodeDef = { id: 'n', tree: 'capability', nameKey: 'n', descKey: 'n', cost: 1, requires: [], row: 1, col: 1, modifiers: [] };

  it('lists tier, flags, modifiers, then one-off effects', () => {
    const modifiers: Modifier[] = [{ stat: 'backlashGain', op: 'mul', value: 1.1 }];
    const lines = describeNode({
      ...base,
      capabilityLevel: 3,
      grantsFlags: ['canAcquire'],
      modifiers,
      onBuy: [{ type: 'resource', resource: 'hype', amount: 10 }],
    });
    expect(lines).toEqual([
      { text: 'Unlocks Model tier 3', tone: 'good' },
      { text: 'Lets you buy out rivals', tone: 'good' },
      { text: '+10% backlash gain', tone: 'bad' },
      { text: '+10 Hype now', tone: 'good' },
    ]);
  });

  it('describes every node in the pack without placeholders', () => {
    for (const node of pack.nodes) {
      const lines = describeNode(node);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.text).not.toMatch(/[{}]/);
    }
  });
});
