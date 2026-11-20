import { getCompute, getDataCentreCost, getLeadRival, getNodeCost, getUpgradeCost, getWorldShare } from '@/engine';
import { edit, newGame, PLAYER } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

describe('selectors', () => {
  it('getLeadRival returns the other active lab with the most AGI progress', () => {
    const state = edit(newGame(testPack), (s) => {
      s.labs.beta.active = true;
      s.labs.beta.agiProgress = 5;
      s.labs.alpha.agiProgress = 2;
    });
    expect(getLeadRival(state, testPack, PLAYER)).toBe('beta');
    expect(getLeadRival(state, testPack, 'beta')).toBe('alpha');
  });

  it('world share is users over world population', () => {
    const state = edit(newGame(testPack), (s) => (s.labs[PLAYER].adoption = { north: 1 }));
    expect(getWorldShare(state, testPack, PLAYER)).toBeCloseTo(600 / 2700, 12);
  });

  it('throws on unknown ids', () => {
    const state = newGame(testPack);
    expect(() => getCompute(state, testPack, 'ghost')).toThrow();
    expect(() => getNodeCost(state, testPack, PLAYER, 'ghost')).toThrow();
    expect(() => getDataCentreCost(state, testPack, PLAYER, 'ghost')).toThrow();
    expect(() => getUpgradeCost(state, testPack, PLAYER, 'ghost')).toThrow();
  });
});
