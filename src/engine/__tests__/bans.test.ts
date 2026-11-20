import { defaultBalance, ENGINE_NEWS_KEYS, isBanned, step } from '@/engine';
import { editLab, failureOf, newGame, PLAYER, quietPack, withBalance } from '../__fixtures__/helpers';

const pack = withBalance(quietPack(), { seedChance: 0, regulationDecay: 0, regulationPerShare: 0, regulationPerGrowth: 0 });

function presentEverywhere() {
  return editLab(newGame(pack), PLAYER, (lab) => {
    lab.adoption = { north: 0.1, west: 0.1, east: 0.1, center: 0.1, south: 0.1, isle: 0.1 };
  });
}

describe('regulation bans', () => {
  it('crossing 25 bans the strictest region where the lab is present, for banDuration ticks, with news', () => {
    const state = step(editLab(presentEverywhere(), PLAYER, (lab) => (lab.regulation = 26)), pack);
    expect(state.labs[PLAYER].bans).toEqual({ center: state.tick + defaultBalance.banDuration });
    expect(isBanned(state, PLAYER, 'center')).toBe(true);
    const news = state.news.find((n) => n.textKey === ENGINE_NEWS_KEYS.ban);
    expect(news).toMatchObject({ regionId: 'center', labId: PLAYER, params: { region: 'center', lab: PLAYER } });
  });

  it('each threshold fires once; 50 and 75 ban 2 and 3 more of the strictest regions', () => {
    let state = step(editLab(presentEverywhere(), PLAYER, (lab) => (lab.regulation = 26)), pack);
    state = step(state, pack);
    expect(Object.keys(state.labs[PLAYER].bans)).toEqual(['center']);
    state = step(editLab(state, PLAYER, (lab) => (lab.regulation = 51)), pack);
    expect(Object.keys(state.labs[PLAYER].bans).sort()).toEqual(['center', 'isle', 'north'].sort());
    state = step(editLab(state, PLAYER, (lab) => (lab.regulation = 76)), pack);
    expect(Object.keys(state.labs[PLAYER].bans)).toHaveLength(6);
  });

  it('a threshold re-arms after regulation falls banResetMargin below it', () => {
    let state = step(editLab(presentEverywhere(), PLAYER, (lab) => (lab.regulation = 26)), pack);
    state = editLab(state, PLAYER, (lab) => {
      lab.bans = {};
      lab.regulation = 25 - defaultBalance.banResetMargin - 1;
    });
    state = step(state, pack);
    state = step(editLab(state, PLAYER, (lab) => (lab.regulation = 26)), pack);
    expect(Object.keys(state.labs[PLAYER].bans)).toEqual(['center']);
  });

  it('the banDuration stat scales ban length', () => {
    const scaled = { ...pack, founders: pack.founders.map((f) => ({ ...f, modifiers: [{ stat: 'banDuration' as const, op: 'mul' as const, value: 0.5 }] })) };
    const state = step(editLab(presentEverywhere(), PLAYER, (lab) => (lab.regulation = 26)), scaled);
    expect(state.labs[PLAYER].bans.center).toBe(state.tick + defaultBalance.banDuration / 2);
  });

  it('adoption decays while banned and bans expire', () => {
    let state = editLab(presentEverywhere(), PLAYER, (lab) => (lab.bans = { center: 3 }));
    state = step(state, pack);
    expect(state.labs[PLAYER].adoption.center).toBeCloseTo(0.1 * (1 - defaultBalance.banDecayRate), 12);
    state = step(step(state, pack), pack);
    expect(state.tick).toBe(3);
    expect(state.labs[PLAYER].bans.center).toBeUndefined();
    expect(isBanned(state, PLAYER, 'center')).toBe(false);
  });

  it('permanent bans (-1) never expire', () => {
    let state = editLab(presentEverywhere(), PLAYER, (lab) => (lab.bans = { center: -1 }));
    for (let i = 0; i < 20; i++) state = step(state, pack);
    expect(isBanned(state, PLAYER, 'center')).toBe(true);
  });

  it('launching or building in a banned region fails with regionBanned', () => {
    const state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.bans = { west: -1, north: -1 };
      lab.cash = 10_000;
    });
    expect(failureOf(state, pack, { type: 'launchInRegion', labId: PLAYER, regionId: 'west' })).toBe('regionBanned');
    expect(failureOf(state, pack, { type: 'buildDataCentre', labId: PLAYER, regionId: 'north' })).toBe('regionBanned');
  });
});
