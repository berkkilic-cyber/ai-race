import { getCompute, getDataCentreCost, getEndingParams, getLeadRival, getNodeCost, getUpgradeCost, getWorldShare } from '@/engine';
import { edit, newGame, PLAYER } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

describe('selectors', () => {
  it('getEndingParams names the player as {lab} and a winning rival as {rival}', () => {
    const running = newGame(testPack);
    expect(getEndingParams(running)).toEqual({});
    const lost = edit(running, (s) => {
      s.status = 'ended';
      s.ending = { endingId: 'end_rival_agi', kind: 'lose', trigger: 'rivalAgi', tick: 5, score: 0, winnerLabId: 'alpha' };
    });
    expect(getEndingParams(lost)).toEqual({ lab: PLAYER, rival: 'alpha' });
    const won = edit(running, (s) => {
      s.status = 'ended';
      s.ending = { endingId: 'end_agi', kind: 'win', trigger: 'agi', tick: 5, score: 1, winnerLabId: PLAYER };
    });
    expect(getEndingParams(won)).toEqual({ lab: PLAYER });
  });

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
