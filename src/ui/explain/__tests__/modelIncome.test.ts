import { createGame, getCompute, getComputeRequired, getIncomeBreakdown, step, type GameState } from '@/engine';

import { setI18nContext } from '../../i18n';
import { getPackEntry } from '../../packs';
import { bestLaunch, explainIncome, fmtIncome } from '../income';
import { computeUpgrades, haveText, modelFacts, modelNodes, needText, ownsMoreThanRuns } from '../model';

const pack = getPackEntry().pack;

function game(ticks = 0): GameState {
  let state = createGame(pack, { playerName: 'Test Lab', founderId: pack.founders[0].id, homeRegion: 'usa', seed: 9 });
  for (let i = 0; i < ticks; i++) state = step(state, pack);
  return state;
}

function withPlayer(state: GameState, patch: Partial<GameState['labs'][string]>): GameState {
  const me = { ...state.labs[state.playerLabId], ...patch };
  return { ...state, labs: { ...state.labs, [me.id]: me } };
}

beforeAll(() => setI18nContext(pack, null));

describe('modelFacts', () => {
  it('lists every model tier with the compute the engine says it needs', () => {
    const facts = modelFacts(game(), pack, 'player');
    expect(facts.tiers.map((r) => r.tier)).toEqual(modelNodes(pack).map((n) => n.capabilityLevel));
    for (const row of facts.tiers) expect(row.required).toBe(getComputeRequired(pack, row.tier));
  });

  it('spots owning a better model than the compute can run', () => {
    const state = withPlayer(game(), { ownedNodes: ['cap-model-1', 'cap-model-2', 'cap-model-3', 'cap-model-4', 'cap-model-5'], dataCentres: [], computeBonus: 0 });
    const facts = modelFacts(state, pack, state.playerLabId);
    expect(facts.owned).toBe(5);
    expect(facts.running).toBeLessThan(5);
    expect(ownsMoreThanRuns(facts)).toBe(true);
    expect(facts.shortfall).toBeCloseTo(getComputeRequired(pack, 5) - getCompute(state, pack, state.playerLabId));
    expect(facts.tiers.filter((r) => r.owned && !r.running).length).toBeGreaterThan(0);
  });

  it('rounds what is shown: needs up, has down', () => {
    expect(needText(41.71)).toBe('42');
    expect(needText(42)).toBe('42');
    expect(haveText(12.9)).toBe('12');
  });

  it('finds upgrades that add compute', () => {
    const ids = computeUpgrades(game(), pack, 'player').map((c) => c.nodeId);
    expect(ids).toContain('cap-gpu-lease');
    expect(ids).not.toContain('cap-model-1');
  });
});

describe('explainIncome', () => {
  it('lines add up to the engine total (upkeep folded in)', () => {
    const state = game(120);
    for (const kind of ['hype', 'cash'] as const) {
      const e = explainIncome(state, pack, state.playerLabId, kind);
      const sum = e.rows.reduce((s, r) => s + r.amount, 0);
      expect(sum).toBeCloseTo(getIncomeBreakdown(state, pack, state.playerLabId)[kind].total, 6);
      expect(e.total).toBeCloseTo(sum, 6);
      for (const r of e.rows) expect(r.text).not.toMatch(/[{}]/);
    }
  });

  it('names the biggest cost', () => {
    const state = withPlayer(game(10), { dataCentres: [{ id: 'a', regionId: 'usa', level: 3 }] });
    const e = explainIncome(state, pack, state.playerLabId, 'cash');
    expect(e.biggestCost?.amount).toBeLessThan(0);
    expect(e.biggestCost?.text).toContain(pack.strings.en['region.usa.name']);
  });

  it('gives two or three concrete tips without placeholders', () => {
    const state = game(60);
    for (const kind of ['hype', 'cash'] as const) {
      const e = explainIncome(state, pack, state.playerLabId, kind);
      expect(e.tips.length).toBeGreaterThanOrEqual(2);
      expect(e.tips.length).toBeLessThanOrEqual(3);
      for (const tip of e.tips) expect(tip.text).not.toMatch(/[{}]/);
    }
  });

  it('puts "you own a model you cannot run" first for Hype', () => {
    const state = withPlayer(game(), { ownedNodes: ['cap-model-1', 'cap-model-2', 'cap-model-3'], dataCentres: [], computeBonus: 0 });
    expect(explainIncome(state, pack, state.playerLabId, 'hype').tips[0].key).toBe('model-stuck');
  });

  it('suggests a region the player is not in and can launch in', () => {
    const state = withPlayer(game(), { cash: 1e6 });
    const pick = bestLaunch(state, pack, state.playerLabId, 'hype');
    expect(pick).not.toBeNull();
    expect(pick?.affordable).toBe(true);
    expect(state.labs[state.playerLabId].adoption[pick?.regionId ?? '']).toBeUndefined();
  });

  it('formats signed amounts', () => {
    expect(fmtIncome('cash', -1.25)).toBe('−$1.3M');
    expect(fmtIncome('hype', 0.5)).toBe('+0.5');
  });
});
