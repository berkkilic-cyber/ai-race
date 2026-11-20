import { defaultBalance, step, type ContentPack, type HeadlineDef } from '@/engine';
import { edit, newGame, PLAYER, quietPack, stepN } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

function headlinePack(headlines: HeadlineDef[], extra: Partial<ContentPack> = {}): ContentPack {
  return quietPack({ headlines, rivals: testPack.rivals, ...extra });
}

const player: HeadlineDef = { id: 'p', textKey: 'hp', tone: 'good', weight: 1, about: 'player', conditions: [], effects: [{ type: 'resource', resource: 'hype', amount: 2 }] };
const rival: HeadlineDef = { id: 'r', textKey: 'hr', tone: 'bad', weight: 1, about: 'rival', conditions: [], effects: [{ type: 'meter', meter: 'backlash', amount: 3 }] };
const world: HeadlineDef = { id: 'w', textKey: 'hw', tone: 'neutral', weight: 1, about: 'world', conditions: [] };

/** Steps until the first headline appears. */
function firstHeadline(pack: ContentPack, seed = 1) {
  let state = newGame(pack, { seed });
  const due = state.nextHeadlineTick;
  state = stepN(state, pack, due);
  return { state, due };
}

describe('headlines', () => {
  it('the first headline is due within headlineIntervalMin..Max', () => {
    const state = newGame(headlinePack([world]));
    expect(state.nextHeadlineTick).toBeGreaterThanOrEqual(defaultBalance.headlineIntervalMin);
    expect(state.nextHeadlineTick).toBeLessThanOrEqual(defaultBalance.headlineIntervalMax);
  });

  it("'player' headlines apply their effects to the player", () => {
    const { state } = firstHeadline(headlinePack([player], { balance: { hypeBase: 0, hypePerNewUser: 0 } }));
    expect(state.news.at(-1)).toMatchObject({ textKey: 'hp', tone: 'good', labId: PLAYER, params: { lab: PLAYER } });
    expect(state.labs[PLAYER].hype).toBe(newGame(testPack).labs[PLAYER].hype + 2);
  });

  it("'rival' headlines name a random active rival and apply effects to it", () => {
    const pack = headlinePack([rival], { balance: { backlashDecay: 0, backlashPerDataCentreLevel: 0, aiDecisionInterval: 100_000 } });
    const { state } = firstHeadline(pack);
    const item = state.news.at(-1)!;
    expect(item.textKey).toBe('hr');
    expect(item.labId).toBe('alpha'); // beta has not entered yet
    expect(item.params).toEqual({ lab: 'alpha' });
    expect(state.labs.alpha.backlash).toBeCloseTo(3, 6);
    expect(state.labs[PLAYER].backlash).toBe(0);
  });

  it("'rival' headlines are skipped when no rival is active", () => {
    const pack = headlinePack([rival, world], { rivals: [] });
    const { state } = firstHeadline(pack);
    expect(state.news.at(-1)?.textKey).toBe('hw');
  });

  it("'world' headlines are flavour", () => {
    const { state } = firstHeadline(headlinePack([world]));
    expect(state.news.at(-1)).toMatchObject({ textKey: 'hw', tone: 'neutral' });
  });

  it('respects conditions and keeps the interval', () => {
    const gated: HeadlineDef = { ...player, id: 'g', textKey: 'hg', conditions: [{ type: 'worldShareAtLeast', value: 0.9 }] };
    const pack = headlinePack([gated, world]);
    let state = newGame(pack);
    const ticks: number[] = [];
    for (let i = 0; i < 400; i++) {
      const before = state.news.length;
      state = step(state, pack);
      if (state.news.length > before && state.news.at(-1)?.textKey === 'hw') ticks.push(state.tick);
      expect(state.news.some((n) => n.textKey === 'hg')).toBe(false);
    }
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBeGreaterThanOrEqual(defaultBalance.headlineIntervalMin);
      expect(ticks[i] - ticks[i - 1]).toBeLessThanOrEqual(defaultBalance.headlineIntervalMax);
    }
    expect(ticks.length).toBeGreaterThan(5);
  });
});

describe('news log', () => {
  it('is capped at newsLogSize, keeping the newest items', () => {
    const pack = headlinePack([world], { balance: { newsLogSize: 3, headlineIntervalMin: 1, headlineIntervalMax: 1 } });
    const state = stepN(edit(newGame(pack), (s) => (s.nextHeadlineTick = 1)), pack, 10);
    expect(state.news).toHaveLength(3);
    expect(state.news.at(-1)?.tick).toBe(10);
  });
});
