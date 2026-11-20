import { applyAction, chooseAiActions, ENGINE_NEWS_KEYS, step } from '@/engine';
import { edit, newGame, PLAYER, quietPack, stepN } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

const pack = quietPack({ rivals: testPack.rivals });

describe('rivals', () => {
  it('rivals with entryTick 0 start active at home; later ones start inactive and empty', () => {
    const state = newGame(pack);
    expect(state.labOrder).toEqual([PLAYER, 'alpha', 'beta']);
    expect(state.labs.alpha).toMatchObject({ active: true, controller: 'ai', color: '#cc3333', adoption: { east: 0.01 } });
    expect(state.labs.beta).toMatchObject({ active: false, adoption: {} });
  });

  it('a rival enters at its entryTick in its home region, with news', () => {
    let state = stepN(newGame(pack), pack, 299);
    expect(state.labs.beta.active).toBe(false);
    state = step(state, pack);
    expect(state.tick).toBe(300);
    expect(state.labs.beta.active).toBe(true);
    expect(state.labs.beta.adoption.south).toBeGreaterThan(0);
    expect(state.news.some((n) => n.textKey === ENGINE_NEWS_KEYS.rivalEntered && n.labId === 'beta' && n.regionId === 'south')).toBe(true);
  });

  it('setup.rivalIds selects which rivals take part', () => {
    const state = newGame(pack, { rivalIds: ['beta'] });
    expect(state.labOrder).toEqual([PLAYER, 'beta']);
    expect(() => newGame(pack, { rivalIds: ['ghost'] })).toThrow();
  });

  it('createGame rejects an unknown founder or region', () => {
    expect(() => newGame(pack, { founderId: 'ghost' })).toThrow();
    expect(() => newGame(pack, { homeRegion: 'ghost' })).toThrow();
  });

  it('AI labs act on their own every aiDecisionInterval ticks with the same actions as the player', () => {
    const state = stepN(newGame(pack), pack, 400);
    const alpha = state.labs.alpha;
    expect(alpha.stats.nodesBought + alpha.dataCentres.length).toBeGreaterThan(0);
  });

  it('chooseAiActions returns only actions that are valid in sequence', () => {
    let state = edit(newGame(pack), (s) => {
      s.labs.alpha.hype = 500;
      s.labs.alpha.cash = 5000;
    });
    const actions = chooseAiActions(state, pack, 'alpha');
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.labId).toBe('alpha');
      const result = applyAction(state, pack, action);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
  });
});
