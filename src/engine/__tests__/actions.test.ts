import {
  canApply,
  defaultBalance,
  getAcquirePrice,
  getDataCentreCost,
  getLaunchCost,
  getNodeCost,
  getUpgradeCost,
  getUsers,
  type Action,
  type GameState,
} from '@/engine';
import { edit, editLab, failureOf, mustApply, newGame, PLAYER } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

const pack = testPack;
const rich = editLab(newGame(pack), PLAYER, (lab) => {
  lab.hype = 1000;
  lab.cash = 10_000;
});

describe('common checks', () => {
  const action: Action = { type: 'buyNode', labId: PLAYER, nodeId: 'c1' };

  it('gameEnded once the run is over', () => {
    expect(failureOf(edit(rich, (s) => (s.status = 'ended')), pack, action)).toBe('gameEnded');
  });

  it('unknownId for an unknown lab, labInactive for an inactive one', () => {
    expect(failureOf(rich, pack, { ...action, labId: 'nobody' })).toBe('unknownId');
    expect(failureOf(rich, pack, { ...action, labId: 'beta' })).toBe('labInactive');
  });

  it('eventPending blocks other actions of the lab with a pending card', () => {
    const pending = edit(rich, (s) => (s.pendingEvent = { eventId: 'press', labId: PLAYER }));
    expect(failureOf(pending, pack, action)).toBe('eventPending');
  });

  it('canApply agrees with applyAction', () => {
    expect(canApply(rich, pack, action)).toEqual({ ok: true });
    expect(canApply(newGame(pack), pack, { ...action, nodeId: 'c2' })).toEqual({ ok: false, reason: 'missingRequirement' });
  });
});

describe('buyNode', () => {
  it('pays Hype (and Cash), owns the node, counts it and runs onBuy effects', () => {
    let state = editLab(rich, PLAYER, (lab) => (lab.ownedNodes = ['c1', 'c2', 'c3']));
    state = mustApply(state, pack, { type: 'buyNode', labId: PLAYER, nodeId: 'c4' });
    const lab = state.labs[PLAYER];
    expect(lab.ownedNodes).toContain('c4');
    expect(lab.hype).toBe(1000 - 140);
    expect(lab.cash).toBe(10_000 - 60);
    expect(lab.stats.nodesBought).toBe(1);
    expect(lab.computeBonus).toBe(5);
  });

  it('the nodeCost stat scales both costs', () => {
    const cheap = { ...pack, founders: pack.founders.map((f) => ({ ...f, modifiers: [{ stat: 'nodeCost' as const, op: 'mul' as const, value: 0.5 }] })) };
    expect(getNodeCost(newGame(cheap), cheap, PLAYER, 'c4')).toEqual({ hype: 70, cash: 30 });
  });

  it.each([
    ['unknownId', 'nope', (s: GameState) => s],
    ['alreadyOwned', 'c1', (s: GameState) => editLab(s, PLAYER, (l) => (l.ownedNodes = ['c1']))],
    ['missingRequirement', 'c2', (s: GameState) => s],
    ['notEnoughHype', 'c1', (s: GameState) => editLab(s, PLAYER, (l) => (l.hype = 7))],
    ['notEnoughCash', 'c4', (s: GameState) => editLab(s, PLAYER, (l) => ((l.ownedNodes = ['c1', 'c2', 'c3']), (l.cash = 59)))],
  ])('%s', (reason, nodeId, prepare) => {
    expect(failureOf(prepare(rich), pack, { type: 'buyNode', labId: PLAYER, nodeId })).toBe(reason);
  });
});

describe('buildDataCentre', () => {
  it('pays the price and adds a level-1 data centre; the price rises with count', () => {
    const first = getDataCentreCost(rich, pack, PLAYER, 'north');
    expect(first).toBe(defaultBalance.dataCentreBaseCost);
    const state = mustApply(rich, pack, { type: 'buildDataCentre', labId: PLAYER, regionId: 'north' });
    expect(state.labs[PLAYER].dataCentres).toEqual([{ id: 'player:dc1', regionId: 'north', level: 1 }]);
    expect(state.labs[PLAYER].cash).toBe(10_000 - first);
    expect(state.labs[PLAYER].stats.dataCentresBuilt).toBe(1);
    expect(getDataCentreCost(state, pack, PLAYER, 'north')).toBeCloseTo(first * (1 + defaultBalance.dataCentreCountGrowth), 9);
  });

  it.each([
    ['unknownId', 'nowhere', (s: GameState) => s],
    ['regionBanned', 'north', (s: GameState) => editLab(s, PLAYER, (l) => (l.bans = { north: -1 }))],
    ['notAllowed', 'west', (s: GameState) => s], // not present there
    ['limitReached', 'north', (s: GameState) => editLab(s, PLAYER, (l) => (l.dataCentres = [{ id: 'a', regionId: 'north', level: 1 }, { id: 'b', regionId: 'north', level: 1 }]))],
    ['notEnoughCash', 'north', (s: GameState) => editLab(s, PLAYER, (l) => (l.cash = 49))],
  ])('%s', (reason, regionId, prepare) => {
    expect(failureOf(prepare(rich), pack, { type: 'buildDataCentre', labId: PLAYER, regionId })).toBe(reason);
  });
});

describe('upgradeDataCentre', () => {
  const withDc = editLab(rich, PLAYER, (lab) => (lab.dataCentres = [{ id: 'a', regionId: 'north', level: 2 }]));

  it('pays dataCentreUpgradeCost × level and raises the level', () => {
    expect(getUpgradeCost(withDc, pack, PLAYER, 'a')).toBe(defaultBalance.dataCentreUpgradeCost * 2);
    const state = mustApply(withDc, pack, { type: 'upgradeDataCentre', labId: PLAYER, dataCentreId: 'a' });
    expect(state.labs[PLAYER].dataCentres[0].level).toBe(3);
    expect(state.labs[PLAYER].cash).toBe(10_000 - defaultBalance.dataCentreUpgradeCost * 2);
  });

  it.each([
    ['unknownId', 'zzz', (s: GameState) => s],
    ['regionBanned', 'a', (s: GameState) => editLab(s, PLAYER, (l) => (l.bans = { north: -1 }))],
    ['limitReached', 'a', (s: GameState) => editLab(s, PLAYER, (l) => (l.dataCentres[0].level = defaultBalance.maxDataCentreLevel))],
    ['notEnoughCash', 'a', (s: GameState) => editLab(s, PLAYER, (l) => (l.cash = 1))],
  ])('%s', (reason, dataCentreId, prepare) => {
    expect(failureOf(prepare(withDc), pack, { type: 'upgradeDataCentre', labId: PLAYER, dataCentreId })).toBe(reason);
  });
});

describe('launchInRegion', () => {
  it('pays a price that grows with population and wealth, and starts at launchAdoption with news', () => {
    const west = pack.regions.find((r) => r.id === 'west')!;
    const cost = getLaunchCost(rich, pack, PLAYER, 'west');
    expect(cost).toBeCloseTo(defaultBalance.launchBaseCost + defaultBalance.launchCostPerMillion * west.population * (0.5 + west.wealth), 9);
    expect(getLaunchCost(rich, pack, PLAYER, 'east')).toBeGreaterThan(getLaunchCost(rich, pack, PLAYER, 'isle'));
    const state = mustApply(rich, pack, { type: 'launchInRegion', labId: PLAYER, regionId: 'west' });
    expect(state.labs[PLAYER].adoption.west).toBe(defaultBalance.launchAdoption);
    expect(state.labs[PLAYER].cash).toBeCloseTo(10_000 - cost, 9);
    expect(state.news.at(-1)).toMatchObject({ regionId: 'west', labId: PLAYER });
  });

  it('makes room in a full region by shrinking the other labs', () => {
    const full = editLab(rich, 'alpha', (lab) => (lab.adoption = { west: 1 }));
    const state = mustApply(full, pack, { type: 'launchInRegion', labId: PLAYER, regionId: 'west' });
    expect(state.labs[PLAYER].adoption.west).toBeCloseTo(defaultBalance.launchAdoption, 12);
    expect(state.labs.alpha.adoption.west).toBeCloseTo(1 - defaultBalance.launchAdoption, 12);
  });

  it.each([
    ['unknownId', 'nowhere', (s: GameState) => s],
    ['regionBanned', 'west', (s: GameState) => editLab(s, PLAYER, (l) => (l.bans = { west: 500 }))],
    ['alreadyPresent', 'north', (s: GameState) => s],
    ['notEnoughCash', 'west', (s: GameState) => editLab(s, PLAYER, (l) => (l.cash = 5))],
  ])('%s', (reason, regionId, prepare) => {
    expect(failureOf(prepare(rich), pack, { type: 'launchInRegion', labId: PLAYER, regionId })).toBe(reason);
  });
});

describe('resolveEvent', () => {
  const pending = (eventId: string) => edit(rich, (s) => (s.pendingEvent = { eventId, labId: PLAYER }));

  it('pays the cost, applies effects, clears the card, fills lastEventResult and schedules the next card', () => {
    const state = mustApply(editLab(pending('deal'), PLAYER, (l) => l.ownedNodes.push('r1')), pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'sign' });
    expect(state.pendingEvent).toBeNull();
    expect(state.labs[PLAYER].cash).toBe(10_000 - 30);
    expect(state.labs[PLAYER].timedModifiers).toHaveLength(1);
    expect(state.lastEventResult).toEqual({ eventId: 'deal', choiceId: 'sign' });
    expect(state.labs[PLAYER].stats.eventsResolved).toBe(1);
    expect(state.nextEventTick).toBeGreaterThanOrEqual(state.tick + defaultBalance.eventIntervalMin);
    expect(state.nextEventTick).toBeLessThanOrEqual(state.tick + defaultBalance.eventIntervalMax);
  });

  it('reports the choice result key', () => {
    const state = mustApply(pending('press'), pack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'talk' });
    expect(state.lastEventResult).toEqual({ eventId: 'press', choiceId: 'talk', resultKey: 'event.press.talk.result' });
    expect(state.labs[PLAYER].hype).toBe(1010);
  });

  it.each([
    ['noPendingEvent', 'talk', () => rich],
    ['noPendingEvent', 'talk', () => edit(rich, (s) => (s.pendingEvent = { eventId: 'press', labId: 'alpha' }))],
    ['unknownId', 'nope', () => pending('press')],
    ['missingRequirement', 'sign', () => pending('deal')],
    ['notEnoughCash', 'sign', () => editLab(pending('deal'), PLAYER, (l) => ((l.cash = 29), l.ownedNodes.push('r1')))],
  ])('%s (%s)', (reason, choiceId, prepare) => {
    expect(failureOf(prepare(), pack, { type: 'resolveEvent', labId: PLAYER, choiceId })).toBe(reason);
  });

  it('notEnoughHype for a choice costing Hype', () => {
    const hypePack = { ...pack, events: [{ ...pack.events[0], choices: [{ id: 'buy', labelKey: 'x', cost: { hype: 5 }, effects: [] }, pack.events[0].choices[1]] }] };
    const state = edit(newGame(hypePack), (s) => {
      s.pendingEvent = { eventId: 'press', labId: PLAYER };
      s.labs[PLAYER].hype = 4;
    });
    expect(failureOf(state, hypePack, { type: 'resolveEvent', labId: PLAYER, choiceId: 'buy' })).toBe('notEnoughHype');
  });
});

describe('acquireRival', () => {
  const buyer = editLab(rich, PLAYER, (lab) => (lab.ownedNodes = ['r1', 'r2', 'r3']));

  it('price grows with the target users, compute and AGI progress (× acquireCost)', () => {
    const b = defaultBalance;
    const base = getAcquirePrice(buyer, pack, PLAYER, 'alpha');
    const users = getUsers(buyer, pack, 'alpha');
    expect(base).toBeCloseTo((b.acquireBaseCost + b.acquirePerUser * users) * 0.9, 9);
    const bigger = editLab(buyer, 'alpha', (l) => {
      l.agiProgress = 10;
      l.computeBonus = 5;
    });
    expect(getAcquirePrice(bigger, pack, PLAYER, 'alpha')).toBeCloseTo(base + (b.acquirePerAgi * 10 + b.acquirePerCompute * 5) * 0.9, 9);
  });

  it('takes over acquireAdoptionShare of the target adoption and eliminates it as acquired', () => {
    const state0 = editLab(buyer, 'alpha', (l) => (l.adoption = { east: 0.5, west: 0.2 }));
    const price = getAcquirePrice(state0, pack, PLAYER, 'alpha');
    const state = mustApply(state0, pack, { type: 'acquireRival', labId: PLAYER, targetLabId: 'alpha' });
    const share = defaultBalance.acquireAdoptionShare;
    expect(state.labs[PLAYER].adoption.east).toBeCloseTo(0.5 * share, 12);
    expect(state.labs[PLAYER].adoption.west).toBeCloseTo(0.2 * share, 12);
    expect(state.labs.alpha.adoption).toEqual({});
    expect(state.labs.alpha.active).toBe(false);
    expect(state.labs.alpha.eliminated).toEqual({ reason: 'acquired', tick: 0, byLabId: PLAYER });
    expect(state.labs[PLAYER].cash).toBeCloseTo(10_000 - price, 9);
  });

  it.each([
    ['unknownId', 'nobody', (s: GameState) => s],
    ['notAllowed', PLAYER, (s: GameState) => s],
    ['labInactive', 'beta', (s: GameState) => s],
    ['missingRequirement', 'alpha', (s: GameState) => editLab(s, PLAYER, (l) => (l.ownedNodes = []))],
    ['notEnoughCash', 'alpha', (s: GameState) => editLab(s, PLAYER, (l) => (l.cash = 10))],
  ])('%s', (reason, targetLabId, prepare) => {
    expect(failureOf(prepare(buyer), pack, { type: 'acquireRival', labId: PLAYER, targetLabId })).toBe(reason);
  });

  it('an AI lab cannot buy the human player', () => {
    const state = editLab(buyer, 'alpha', (l) => {
      l.flags = ['canAcquire'];
      l.cash = 1e9;
    });
    expect(failureOf(state, pack, { type: 'acquireRival', labId: 'alpha', targetLabId: PLAYER })).toBe('notAllowed');
  });
});
