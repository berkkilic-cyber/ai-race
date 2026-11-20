import { defaultBalance, ENGINE_NEWS_KEYS, getCompute, getModifierTotal, type Effect, type GameState } from '@/engine';
import { getContext } from '../context';
import { applyEffects } from '../effects';
import { clone, edit, newGame, PLAYER } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

/** Applies effects triggered by `source` to a copy of the state. */
function apply(state: GameState, effects: Effect[], source = PLAYER): GameState {
  const draft = clone(state);
  applyEffects(draft, getContext(testPack), draft.labs[source], effects);
  return draft;
}

// Both rivals active; alpha leads on AGI progress.
const state = edit(newGame(testPack), (s) => {
  s.tick = 10;
  s.labs.beta.active = true;
  s.labs.beta.adoption = { south: 0.1 };
  s.labs.alpha.agiProgress = 30;
  s.labs.beta.agiProgress = 10;
  const p = s.labs[PLAYER];
  p.hype = 50;
  p.cash = 100;
  p.regulation = 20;
  p.adoption = { north: 0.4, west: 0.2, center: 0.1 };
  p.dataCentres = [{ id: 'n', regionId: 'north', level: 1 }, { id: 'w', regionId: 'west', level: 2 }];
});

describe('effects', () => {
  it('resource adds and never goes below zero', () => {
    const next = apply(state, [{ type: 'resource', resource: 'hype', amount: 5 }, { type: 'resource', resource: 'cash', amount: -500 }]);
    expect(next.labs[PLAYER].hype).toBe(55);
    expect(next.labs[PLAYER].cash).toBe(0);
  });

  it('resourcePercent adds a percentage of the current amount', () => {
    const next = apply(state, [{ type: 'resourcePercent', resource: 'cash', percent: -25 }, { type: 'resourcePercent', resource: 'hype', percent: 10 }]);
    expect(next.labs[PLAYER].cash).toBe(75);
    expect(next.labs[PLAYER].hype).toBeCloseTo(55, 12);
  });

  it('meter and agiProgress clamp to 0..100', () => {
    const next = apply(state, [
      { type: 'meter', meter: 'regulation', amount: -50 },
      { type: 'meter', meter: 'backlash', amount: 7 },
      { type: 'agiProgress', amount: 150 },
    ]);
    expect(next.labs[PLAYER].regulation).toBe(0);
    expect(next.labs[PLAYER].backlash).toBe(7);
    expect(next.labs[PLAYER].agiProgress).toBe(100);
  });

  it('adoption multiplies adoption in the scoped regions, never past the free share', () => {
    const next = apply(state, [{ type: 'adoption', scope: { kind: 'top', count: 1 }, factor: 1.5 }, { type: 'adoption', scope: { kind: 'region', id: 'west' }, factor: 0.5 }]);
    expect(next.labs[PLAYER].adoption.north).toBeCloseTo(0.6, 12);
    expect(next.labs[PLAYER].adoption.west).toBeCloseTo(0.1, 12);
    const capped = apply(state, [{ type: 'adoption', scope: { kind: 'home' }, factor: 10 }]);
    expect(capped.labs[PLAYER].adoption.north + (capped.labs.alpha.adoption.north ?? 0)).toBeCloseTo(1, 12);
  });

  it('ban bans scoped regions for a duration (or permanently) with news; unban lifts it', () => {
    const banned = apply(state, [{ type: 'ban', scope: { kind: 'tag', tag: 'coastal' }, durationTicks: 50 }, { type: 'ban', scope: { kind: 'region', id: 'center' }, durationTicks: -1 }]);
    expect(banned.labs[PLAYER].bans).toEqual({ north: 60, west: 60, isle: 60, center: -1 });
    expect(banned.news.filter((n) => n.textKey === ENGINE_NEWS_KEYS.ban)).toHaveLength(4);
    const lifted = apply(banned, [{ type: 'unban', scope: { kind: 'all' } }]);
    expect(lifted.labs[PLAYER].bans).toEqual({});
  });

  it('a shorter ban does not shorten a longer one', () => {
    const banned = apply(state, [{ type: 'ban', scope: { kind: 'home' }, durationTicks: 100 }, { type: 'ban', scope: { kind: 'home' }, durationTicks: 5 }]);
    expect(banned.labs[PLAYER].bans.north).toBe(110);
  });

  it('timedModifier adds a modifier until tick + duration', () => {
    const next = apply(state, [{ type: 'timedModifier', modifier: { stat: 'spreadRate', op: 'mul', value: 1.3 }, durationTicks: 60 }]);
    expect(next.labs[PLAYER].timedModifiers).toEqual([{ modifier: { stat: 'spreadRate', op: 'mul', value: 1.3 }, untilTick: 70 }]);
    expect(getModifierTotal(next, testPack, PLAYER, 'spreadRate')).toBeCloseTo(1.3, 12);
  });

  it('dataCentre disable takes scoped data centres offline; destroy removes them', () => {
    const disabled = apply(state, [{ type: 'dataCentre', action: 'disable', scope: { kind: 'region', id: 'west' }, durationTicks: 30 }]);
    expect(disabled.labs[PLAYER].dataCentres.find((d) => d.id === 'w')?.disabledUntilTick).toBe(40);
    expect(getCompute(disabled, testPack, PLAYER)).toBe(defaultBalance.computePerLevel);
    const defaulted = apply(state, [{ type: 'dataCentre', action: 'disable', scope: { kind: 'home' } }]);
    expect(defaulted.labs[PLAYER].dataCentres.find((d) => d.id === 'n')?.disabledUntilTick).toBe(10 + defaultBalance.defaultDisableTicks);
    const destroyed = apply(state, [{ type: 'dataCentre', action: 'destroy', scope: { kind: 'all' } }]);
    expect(destroyed.labs[PLAYER].dataCentres).toEqual([]);
  });

  it('compute adds permanent bonus compute (can be negative)', () => {
    const next = apply(state, [{ type: 'compute', amount: 7 }, { type: 'compute', amount: -2 }]);
    expect(next.labs[PLAYER].computeBonus).toBe(5);
  });

  it('setFlag sets a flag on the source once', () => {
    const next = apply(state, [{ type: 'setFlag', flag: 'x' }, { type: 'setFlag', flag: 'x' }]);
    expect(next.labs[PLAYER].flags).toEqual(['x']);
  });

  it('news pushes a news item about the source', () => {
    const next = apply(state, [{ type: 'news', textKey: 'k', tone: 'good' }, { type: 'news', textKey: 'k2' }]);
    expect(next.news.slice(-2)).toEqual([
      { tick: 10, textKey: 'k', tone: 'good', params: { lab: PLAYER }, labId: PLAYER },
      { tick: 10, textKey: 'k2', tone: 'neutral', params: { lab: PLAYER }, labId: PLAYER },
    ]);
  });

  it('random scope picks distinct present regions', () => {
    const next = apply(state, [{ type: 'ban', scope: { kind: 'random', count: 2 }, durationTicks: 10 }]);
    const banned = Object.keys(next.labs[PLAYER].bans);
    expect(banned).toHaveLength(2);
    for (const id of banned) expect(['north', 'west', 'center']).toContain(id);
  });
});

describe('effect targets', () => {
  const hit: Effect = { type: 'meter', meter: 'backlash', amount: 5 };

  it("'self' (default) hits the source", () => {
    expect(apply(state, [hit]).labs[PLAYER].backlash).toBe(5);
    expect(apply(state, [{ ...hit, target: 'self' }]).labs[PLAYER].backlash).toBe(5);
  });

  it("'rivals' hits every other active lab", () => {
    const next = apply(state, [{ ...hit, target: 'rivals' }]);
    expect([next.labs[PLAYER].backlash, next.labs.alpha.backlash, next.labs.beta.backlash]).toEqual([0, 5, 5]);
  });

  it("'leadRival' hits the other active lab with the most AGI progress", () => {
    const next = apply(state, [{ ...hit, target: 'leadRival' }]);
    expect([next.labs.alpha.backlash, next.labs.beta.backlash]).toEqual([5, 0]);
  });

  it("'randomRival' hits exactly one other active lab", () => {
    const next = apply(state, [{ ...hit, target: 'randomRival' }]);
    expect(next.labs[PLAYER].backlash).toBe(0);
    expect(next.labs.alpha.backlash + next.labs.beta.backlash).toBe(5);
  });

  it('targets are relative to the source: a rival hitting rivals hits the player', () => {
    const next = apply(state, [{ ...hit, target: 'rivals' }], 'alpha');
    expect([next.labs[PLAYER].backlash, next.labs.alpha.backlash, next.labs.beta.backlash]).toEqual([5, 0, 5]);
  });

  it('rival targets do nothing without active rivals', () => {
    const alone = edit(state, (s) => {
      s.labs.alpha.active = false;
      s.labs.beta.active = false;
    });
    for (const target of ['rivals', 'leadRival', 'randomRival'] as const) {
      expect(apply(alone, [{ ...hit, target }])).toEqual(apply(alone, []));
    }
  });
});
