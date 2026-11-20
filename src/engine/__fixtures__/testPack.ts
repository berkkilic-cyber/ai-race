/** A small, theme-neutral content pack for engine tests. */
import { ENGINE_NEWS_KEYS } from '../news';
import type { ContentPack, GameSetup, RegionDef } from '../types';

function region(
  id: string,
  population: number,
  wealth: number,
  openness: number,
  strictness: number,
  powerCost: number,
  neighbors: string[],
  tags: string[],
): RegionDef {
  return { id, nameKey: `region.${id}`, countries: [], population, wealth, openness, strictness, powerCost, neighbors, tags };
}

const regions: RegionDef[] = [
  region('north', 600, 0.8, 0.8, 0.6, 0.5, ['west', 'east', 'center'], ['coastal']),
  region('west', 400, 0.6, 0.7, 0.4, 0.4, ['north', 'center', 'south'], ['coastal']),
  region('east', 800, 0.4, 0.6, 0.3, 0.3, ['north', 'center', 'south', 'isle'], []),
  region('center', 300, 0.7, 0.9, 0.8, 0.6, ['north', 'west', 'east', 'south'], ['strict']),
  region('south', 500, 0.3, 0.6, 0.2, 0.2, ['west', 'center', 'east'], []),
  region('isle', 100, 0.9, 0.7, 0.5, 0.7, ['east'], ['coastal']),
];

const engineStrings: Record<string, string> = {
  [ENGINE_NEWS_KEYS.ban]: '{lab} is banned in {region}.',
  [ENGINE_NEWS_KEYS.eliminatedBanned]: '{lab} is shut down.',
  [ENGINE_NEWS_KEYS.eliminatedRevolt]: '{lab} collapses under protest.',
  [ENGINE_NEWS_KEYS.acquired]: '{rival} buys {lab}.',
  [ENGINE_NEWS_KEYS.rivalEntered]: '{lab} enters in {region}.',
  [ENGINE_NEWS_KEYS.dataCentreUnpaid]: 'A site of {lab} in {region} goes dark.',
  [ENGINE_NEWS_KEYS.launched]: '{lab} launches in {region}.',
  [ENGINE_NEWS_KEYS.achievement]: 'Achievement: {achievement}.',
};

export const testPack: ContentPack = {
  id: 'test',
  version: 1,
  regions,
  nodes: [
    { id: 'c1', tree: 'capability', nameKey: 'node.c1', descKey: 'node.c1.desc', cost: 8, requires: [], row: 1, col: 1, modifiers: [{ stat: 'spreadRate', op: 'mul', value: 1.1 }], capabilityLevel: 1 },
    { id: 'c2', tree: 'capability', nameKey: 'node.c2', descKey: 'node.c2.desc', cost: 30, requires: ['c1'], row: 2, col: 1, modifiers: [{ stat: 'agiRate', op: 'add', value: 0.1 }], capabilityLevel: 2 },
    { id: 'c3', tree: 'capability', nameKey: 'node.c3', descKey: 'node.c3.desc', cost: 70, requires: ['c2'], row: 3, col: 1, modifiers: [{ stat: 'backlashGain', op: 'mul', value: 1.1 }], capabilityLevel: 3 },
    {
      id: 'c4', tree: 'capability', nameKey: 'node.c4', descKey: 'node.c4.desc', cost: 140, cashCost: 60, requires: ['c3'], row: 4, col: 1,
      modifiers: [{ stat: 'agiRate', op: 'mul', value: 1.2 }], capabilityLevel: 4, onBuy: [{ type: 'compute', amount: 5 }],
    },
    { id: 'r1', tree: 'reach', nameKey: 'node.r1', descKey: 'node.r1.desc', cost: 10, requires: [], row: 1, col: 1, modifiers: [{ stat: 'cashIncome', op: 'mul', value: 1.2 }] },
    {
      id: 'r2', tree: 'reach', nameKey: 'node.r2', descKey: 'node.r2.desc', cost: 40, requires: ['r1'], row: 2, col: 1,
      modifiers: [{ stat: 'seedChance', op: 'mul', value: 1.5 }, { stat: 'backlashGain', op: 'mul', value: 0.85 }],
    },
    {
      id: 'r3', tree: 'reach', nameKey: 'node.r3', descKey: 'node.r3.desc', cost: 100, requires: ['r2'], row: 3, col: 1,
      modifiers: [{ stat: 'acquireCost', op: 'mul', value: 0.9 }], grantsFlags: ['canAcquire'],
    },
    { id: 's1', tree: 'shadow', nameKey: 'node.s1', descKey: 'node.s1.desc', cost: 12, requires: [], row: 1, col: 1, modifiers: [{ stat: 'regulationGain', op: 'mul', value: 0.8 }] },
    {
      id: 's2', tree: 'shadow', nameKey: 'node.s2', descKey: 'node.s2.desc', cost: 60, requires: ['s1'], row: 2, col: 1,
      modifiers: [{ stat: 'regulationGain', op: 'mul', value: 0.7, regionTag: 'strict' }, { stat: 'riskChance', op: 'add', value: 0.2 }],
      onBuy: [{ type: 'meter', meter: 'regulation', amount: -5 }],
    },
  ],
  events: [
    {
      id: 'press', titleKey: 'event.press', bodyKey: 'event.press.body', tone: 'neutral', weight: 3, once: false, conditions: [],
      choices: [
        { id: 'talk', labelKey: 'event.press.talk', resultKey: 'event.press.talk.result', effects: [{ type: 'resource', resource: 'hype', amount: 10 }, { type: 'meter', meter: 'backlash', amount: 4 }] },
        { id: 'quiet', labelKey: 'event.press.quiet', effects: [] },
      ],
    },
    {
      id: 'gamble', titleKey: 'event.gamble', bodyKey: 'event.gamble.body', tone: 'neutral', weight: 2, once: false, conditions: [],
      choices: [
        {
          id: 'push', labelKey: 'event.gamble.push', resultKey: 'event.gamble.push.result', effects: [{ type: 'agiProgress', amount: 3 }],
          risk: { chance: 0.5, effects: [{ type: 'meter', meter: 'regulation', amount: 10 }], resultKey: 'event.gamble.push.risk' },
        },
        { id: 'safe', labelKey: 'event.gamble.safe', effects: [{ type: 'resource', resource: 'hype', amount: 5 }] },
      ],
    },
    {
      id: 'deal', titleKey: 'event.deal', bodyKey: 'event.deal.body', tone: 'good', weight: 2, once: false, conditions: [{ type: 'tickAtLeast', value: 200 }],
      choices: [
        {
          id: 'sign', labelKey: 'event.deal.sign', requirements: [{ type: 'hasNode', nodeId: 'r1' }], cost: { cash: 30 },
          effects: [{ type: 'timedModifier', modifier: { stat: 'cashIncome', op: 'mul', value: 1.3 }, durationTicks: 200 }],
        },
        { id: 'pass', labelKey: 'event.deal.pass', effects: [] },
      ],
    },
    {
      id: 'spotlight', titleKey: 'event.spotlight', bodyKey: 'event.spotlight.body', tone: 'bad', weight: 1, once: true, conditions: [{ type: 'worldShareAtLeast', value: 0.05 }],
      choices: [
        { id: 'embrace', labelKey: 'event.spotlight.embrace', effects: [{ type: 'adoption', scope: { kind: 'top', count: 1 }, factor: 1.2 }, { type: 'meter', meter: 'backlash', amount: 6 }] },
        { id: 'calm', labelKey: 'event.spotlight.calm', effects: [{ type: 'meter', meter: 'regulation', amount: -5 }, { type: 'resource', resource: 'cash', amount: -10 }] },
      ],
    },
  ],
  headlines: [
    { id: 'h_player', textKey: 'headline.player', tone: 'good', weight: 2, about: 'player', conditions: [], effects: [{ type: 'resource', resource: 'hype', amount: 2 }] },
    { id: 'h_player_big', textKey: 'headline.playerBig', tone: 'bad', weight: 1, about: 'player', conditions: [{ type: 'worldShareAtLeast', value: 0.2 }], effects: [{ type: 'meter', meter: 'regulation', amount: 3 }] },
    { id: 'h_rival', textKey: 'headline.rival', tone: 'bad', weight: 2, about: 'rival', conditions: [], effects: [{ type: 'meter', meter: 'backlash', amount: 3 }] },
    { id: 'h_world', textKey: 'headline.world', tone: 'neutral', weight: 2, about: 'world', conditions: [] },
  ],
  founders: [
    { id: 'thinker', nameKey: 'founder.thinker', descKey: 'founder.thinker.desc', startHype: 20, startCash: 80, modifiers: [{ stat: 'agiRate', op: 'add', value: 0.1 }] },
    { id: 'dealer', nameKey: 'founder.dealer', descKey: 'founder.dealer.desc', startHype: 12, startCash: 140, modifiers: [{ stat: 'cashIncome', op: 'mul', value: 1.15 }] },
  ],
  rivals: [
    { id: 'alpha', nameKey: 'rival.alpha', color: '#cc3333', homeRegion: 'east', personality: { capability: 1.2, reach: 0.6, shadow: 0.4, expansion: 0.5 }, entryTick: 0 },
    { id: 'beta', nameKey: 'rival.beta', color: '#3333cc', homeRegion: 'south', personality: { capability: 0.6, reach: 1, shadow: 0.8, expansion: 0.7 }, entryTick: 300 },
  ],
  endings: [
    { id: 'end_agi_fast', kind: 'win', trigger: 'agi', titleKey: 'ending.agiFast', bodyKey: 'ending.agiFast.body', conditions: [{ type: 'tickAtMost', value: 2500 }] },
    { id: 'end_agi', kind: 'win', trigger: 'agi', titleKey: 'ending.agi', bodyKey: 'ending.agi.body' },
    { id: 'end_dependence', kind: 'win', trigger: 'dependence', titleKey: 'ending.dependence', bodyKey: 'ending.dependence.body' },
    { id: 'end_monopoly', kind: 'win', trigger: 'monopoly', titleKey: 'ending.monopoly', bodyKey: 'ending.monopoly.body' },
    { id: 'end_banned', kind: 'lose', trigger: 'banned', titleKey: 'ending.banned', bodyKey: 'ending.banned.body' },
    { id: 'end_revolt', kind: 'lose', trigger: 'revolt', titleKey: 'ending.revolt', bodyKey: 'ending.revolt.body' },
    { id: 'end_rival_agi', kind: 'lose', trigger: 'rivalAgi', titleKey: 'ending.rivalAgi', bodyKey: 'ending.rivalAgi.body' },
  ],
  achievements: [
    { id: 'ach_first_site', nameKey: 'ach.firstSite', descKey: 'ach.firstSite.desc', secret: false, checkAt: 'tick', conditions: [{ type: 'dataCentresAtLeast', value: 1 }] },
    { id: 'ach_any_win_agi', nameKey: 'ach.agi', descKey: 'ach.agi.desc', secret: true, checkAt: 'end', conditions: [{ type: 'agiAtLeast', value: 100 }] },
  ],
  balance: {},
  strings: {
    en: {
      ...engineStrings,
      ...Object.fromEntries(regions.map((r) => [`region.${r.id}`, r.id])),
      'headline.player': '{lab} is doing well.',
      'headline.playerBig': '{lab} is everywhere.',
      'headline.rival': '{lab} stumbles.',
      'headline.world': 'Nothing happens.',
      'rival.alpha': 'Alpha',
      'rival.beta': 'Beta',
    },
  },
};

/** Adds a placeholder English string for every *Key value in the pack that has none. */
function fillMissingStrings(pack: ContentPack): void {
  const en = pack.strings.en;
  const visit = (value: unknown, key: string): void => {
    if (typeof value === 'string' && key.endsWith('Key') && !(value in en)) en[value] = value;
    else if (Array.isArray(value)) value.forEach((item) => visit(item, ''));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit({ ...pack, strings: {} }, '');
}
fillMissingStrings(testPack);

export const testSetup: GameSetup = { playerName: 'Tester', founderId: 'thinker', homeRegion: 'north', seed: 1 };
