import { getModifierTotal, step } from '@/engine';
import { buildModifierTable, statMultiplier } from '../modifiers';
import { editLab, newGame, PLAYER, quietPack } from '../__fixtures__/helpers';
import type { Modifier } from '../types';

const pack = quietPack();
const strictRegion = pack.regions.find((r) => r.tags.includes('strict'))!;
const plainRegion = pack.regions.find((r) => r.tags.length === 0)!;

describe('modifiers', () => {
  it('add values sum into the base, mul values multiply: (1 + Σadd) × Πmul', () => {
    const mods: Modifier[] = [
      { stat: 'spreadRate', op: 'add', value: 0.2 },
      { stat: 'spreadRate', op: 'add', value: 0.3 },
      { stat: 'spreadRate', op: 'mul', value: 2 },
      { stat: 'spreadRate', op: 'mul', value: 0.5 },
      { stat: 'cashIncome', op: 'mul', value: 3 },
    ];
    const table = buildModifierTable(mods);
    expect(statMultiplier(table, 'spreadRate')).toBeCloseTo(1.5, 12);
    expect(statMultiplier(table, 'cashIncome')).toBe(3);
    expect(statMultiplier(table, 'agiRate')).toBe(1);
  });

  it('never returns a negative multiplier', () => {
    expect(statMultiplier(buildModifierTable([{ stat: 'nodeCost', op: 'add', value: -5 }]), 'nodeCost')).toBe(0);
  });

  it('regionTag modifiers apply only in regions with that tag', () => {
    const table = buildModifierTable([{ stat: 'launchCost', op: 'mul', value: 0.5, regionTag: 'strict' }]);
    expect(statMultiplier(table, 'launchCost', strictRegion)).toBe(0.5);
    expect(statMultiplier(table, 'launchCost', plainRegion)).toBe(1);
    expect(statMultiplier(table, 'launchCost')).toBe(1);
  });

  it('getModifierTotal combines founder, owned nodes and timed modifiers', () => {
    const state = editLab(newGame(pack, { founderId: 'thinker' }), PLAYER, (lab) => {
      lab.ownedNodes = ['c2']; // agiRate add 0.1
      lab.timedModifiers = [{ modifier: { stat: 'agiRate', op: 'mul', value: 2 }, untilTick: 10 }];
    });
    // founder add 0.1 + node add 0.1, × timed 2
    expect(getModifierTotal(state, pack, PLAYER, 'agiRate')).toBeCloseTo(2.4, 12);
    const tagged = editLab(state, PLAYER, (lab) => (lab.ownedNodes = ['s1', 's2']));
    expect(getModifierTotal(tagged, pack, PLAYER, 'regulationGain', strictRegion.id)).toBeCloseTo(0.8 * 0.7, 12);
    expect(getModifierTotal(tagged, pack, PLAYER, 'regulationGain', plainRegion.id)).toBeCloseTo(0.8, 12);
  });

  it('timed modifiers stop counting at untilTick and are removed', () => {
    let state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.timedModifiers = [{ modifier: { stat: 'hypeIncome', op: 'mul', value: 2 }, untilTick: 2 }];
    });
    state = step(state, pack);
    expect(getModifierTotal(state, pack, PLAYER, 'hypeIncome')).toBe(2);
    state = step(state, pack);
    expect(state.labs[PLAYER].timedModifiers).toEqual([]);
    expect(getModifierTotal(state, pack, PLAYER, 'hypeIncome')).toBe(1);
  });
});
