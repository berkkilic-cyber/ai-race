import { defaultBalance, getUsers, step } from '@/engine';
import { editLab, newGame, PLAYER, quietPack, stepN, totalAdoptionIn, withBalance } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

describe('spread', () => {
  it('adoption grows logistically: growth = baseSpread × appeal × openness × adoption × free', () => {
    const pack = withBalance(quietPack(), { seedChance: 0 });
    const state = newGame(pack);
    const before = state.labs[PLAYER].adoption.north;
    const after = step(state, pack).labs[PLAYER].adoption.north;
    const north = pack.regions.find((r) => r.id === 'north')!;
    // capability 0, no spreadRate modifiers, no backlash: appeal = 1
    const expected = defaultBalance.baseSpread * 1 * north.openness * before * (1 - before);
    expect(after - before).toBeCloseTo(expected, 12);
  });

  it('higher capability and spreadRate modifiers raise appeal', () => {
    const pack = withBalance(quietPack(), { seedChance: 0 });
    const base = newGame(pack);
    const boosted = editLab(base, PLAYER, (lab) => {
      lab.ownedNodes.push('c1'); // capability 1 (with compute) and spreadRate ×1.1
      lab.dataCentres.push({ id: 'dc', regionId: 'north', level: 1 });
    });
    const plain = step(base, pack).labs[PLAYER].adoption.north - base.labs[PLAYER].adoption.north;
    const faster = step(boosted, pack).labs[PLAYER].adoption.north - boosted.labs[PLAYER].adoption.north;
    const ratio = (1 + defaultBalance.appealPerCapability) * 1.1;
    expect(faster / plain).toBeCloseTo(ratio, 6);
  });

  it('backlash lowers appeal by (1 − backlash / 200)', () => {
    const pack = withBalance(quietPack(), { seedChance: 0, backlashDecay: 0, backlashPerDataCentreLevel: 0 });
    const base = newGame(pack);
    const angry = editLab(base, PLAYER, (lab) => (lab.backlash = 100 - 1e-9));
    const plain = step(base, pack).labs[PLAYER].adoption.north - base.labs[PLAYER].adoption.north;
    const slower = step(angry, pack).labs[PLAYER].adoption.north - angry.labs[PLAYER].adoption.north;
    expect(slower / plain).toBeCloseTo(0.5, 6);
  });

  it('regional adoption across labs never exceeds 1 (free-share cap)', () => {
    const pack = withBalance(testPack, { baseSpread: 0.5, seedChance: 0.5, stealRate: 0.5 });
    let state = newGame(pack);
    state = editLab(state, 'alpha', (lab) => (lab.adoption.north = 0.4));
    for (let i = 0; i < 400; i++) {
      state = step(state, pack);
      if (state.pendingEvent) state = { ...state, pendingEvent: null };
      if (state.status === 'ended') break;
      for (const region of pack.regions) expect(totalAdoptionIn(state, region.id)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('a more appealing lab takes share from a less appealing one in a full region', () => {
    const pack = withBalance(quietPack({ rivals: testPack.rivals.slice(0, 1) }), { seedChance: 0, stealRate: 0.5 });
    let state = newGame(pack);
    state = editLab(state, PLAYER, (lab) => {
      lab.adoption.north = 0.5;
      lab.ownedNodes.push('c1');
      lab.dataCentres.push({ id: 'dc', regionId: 'north', level: 1 });
    });
    state = editLab(state, 'alpha', (lab) => (lab.adoption.north = 0.5));
    const next = stepN(state, pack, 5);
    expect(next.labs[PLAYER].adoption.north).toBeGreaterThan(0.5);
    expect(next.labs.alpha.adoption.north).toBeLessThan(0.5);
    expect(totalAdoptionIn(next, 'north')).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('seeds absent, unbanned neighbours once adoption reaches seedThreshold', () => {
    const pack = withBalance(quietPack(), { seedChance: 1000, seedThreshold: 0.1 });
    let state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.adoption.north = 0.2;
      lab.bans.west = -1;
    });
    state = step(state, pack);
    const adoption = state.labs[PLAYER].adoption;
    expect(adoption.east).toBeCloseTo(defaultBalance.seedAmount, 12);
    expect(adoption.center).toBeCloseTo(defaultBalance.seedAmount, 12);
    expect(adoption.west).toBeUndefined();
    expect(adoption.south).toBeUndefined(); // not a neighbour of north
  });

  it('does not seed below the threshold', () => {
    const pack = withBalance(quietPack(), { seedChance: 1000, seedThreshold: 0.5 });
    const state = step(newGame(pack), pack);
    expect(Object.keys(state.labs[PLAYER].adoption)).toEqual(['north']);
  });

  it('users are adoption × population, in millions', () => {
    const pack = quietPack();
    const state = editLab(newGame(pack), PLAYER, (lab) => (lab.adoption = { north: 0.5, west: 0.25 }));
    expect(getUsers(state, pack, PLAYER)).toBeCloseTo(0.5 * 600 + 0.25 * 400, 9);
  });
});
