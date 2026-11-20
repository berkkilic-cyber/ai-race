/** Rules added for the balance pass: each defaults to the old behaviour and is tuned by a pack. */
import { chooseAiActions, defaultBalance, getNodeCost, getUpgradeCost, getUsers, runHeadless, step, type ContentPack, type GameState } from '@/engine';
import { editLab, mustApply, newGame, PLAYER, quietPack, withBalance } from '../__fixtures__/helpers';
import { testPack, testSetup } from '../__fixtures__/testPack';

function mustApplyLaunch(state: GameState, pack: ContentPack, regionId: string): GameState {
  return mustApply(editLab(state, PLAYER, (l) => (l.cash = 1e4)), pack, { type: 'launchInRegion', labId: PLAYER, regionId });
}

/** No spread, no seeding: only the rule under test moves the numbers. */
const still = withBalance(quietPack({ rivals: testPack.rivals }), { seedChance: 0, baseSpread: 0 });

describe('defaults', () => {
  it('scaling rules are neutral by default; AI labs get some meter relief by default', () => {
    expect(defaultBalance).toMatchObject({
      agiComputeExponent: 1,
      aiAgiFactor: 1,
      cashBase: 0,
      aiRegulationDecay: 0,
      dataCentreUpgradeGrowth: 0,
      nodeCostGrowth: 0,
    });
    // Without relief AI labs (no event cards) always revolted and an idle player won by monopoly.
    expect(defaultBalance.aiMeterGainFactor).toBeLessThan(1);
    expect(defaultBalance.aiBacklashDecay).toBeGreaterThan(0);
  });

  it('with the default rules an idle player no longer wins by the rivals destroying themselves', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = runHeadless(testPack, { ...testSetup, seed }, { policy: 'idle', maxTicks: 6000 });
      expect(state.ending?.kind).toBe('lose');
    }
  });
});

describe('AGI and compute', () => {
  const agiPack = withBalance(still, { agiBase: 0.01, agiExponent: 1, agiComputeFactor: 0.1, agiComputeExponent: 0.5 });
  const withCompute = (pack: ContentPack, lab = PLAYER) =>
    editLab(newGame(pack), lab, (l) => {
      l.ownedNodes = ['c1'];
      l.computeBonus = 16;
      l.agiProgress = 0;
    });

  it('agiComputeExponent gives diminishing returns: (1 + factor × compute^exponent)', () => {
    const next = step(withCompute(agiPack), agiPack);
    // capability 1, compute 16 → 0.01 × 1 × (1 + 0.1 × 4) × agiRate (thinker founder: add 0.1, c1 none)
    expect(next.labs[PLAYER].agiProgress).toBeCloseTo(0.01 * (1 + 0.1 * 4) * 1.1, 9);
  });

  it('aiAgiFactor scales AI labs only', () => {
    const slowAi = withBalance(agiPack, { aiAgiFactor: 0.5 });
    const human = step(withCompute(slowAi), slowAi).labs[PLAYER].agiProgress;
    expect(human).toBeCloseTo(step(withCompute(agiPack), agiPack).labs[PLAYER].agiProgress, 9);
    const ai = (pack: ContentPack) => step(withCompute(pack, 'alpha'), pack).labs.alpha.agiProgress;
    expect(ai(slowAi)).toBeCloseTo(ai(agiPack) * 0.5, 9);
  });
});

describe('AI meter relief', () => {
  const meterPack = withBalance(still, { aiMeterGainFactor: 1, aiBacklashDecay: 0, regulationPerShare: 1, regulationDecay: 0, backlashDecay: 0, backlashPerCapability: 0, backlashPerDataCentreLevel: 0.5 });
  const loaded = (pack: ContentPack, lab: string) =>
    editLab(newGame(pack), lab, (l) => {
      l.adoption = { [l.homeRegion]: 0.5 };
      l.dataCentres = [{ id: 'x', regionId: l.homeRegion, level: 2 }];
      l.regulation = 50;
      l.backlash = 50;
    });

  it('aiMeterGainFactor scales AI labs’ per-tick meter gains, not the player’s', () => {
    const relieved = withBalance(meterPack, { aiMeterGainFactor: 0.5 });
    const gain = (pack: ContentPack, lab: string, meter: 'regulation' | 'backlash') => step(loaded(pack, lab), pack).labs[lab][meter] - 50;
    for (const meter of ['regulation', 'backlash'] as const) {
      expect(gain(relieved, 'alpha', meter)).toBeCloseTo(gain(meterPack, 'alpha', meter) * 0.5, 9);
      expect(gain(relieved, PLAYER, meter)).toBeCloseTo(gain(meterPack, PLAYER, meter), 9);
    }
  });

  it('aiRegulationDecay and aiBacklashDecay are extra decay for AI labs only', () => {
    const decaying = withBalance(still, { aiRegulationDecay: 0.3, aiBacklashDecay: 0.2, aiMeterGainFactor: 1 });
    const calm = (lab: string) => editLab(newGame(decaying), lab, (l) => ((l.adoption = {}), (l.regulation = 10), (l.backlash = 10)));
    const ai = step(calm('alpha'), decaying).labs.alpha;
    expect(ai.regulation).toBeCloseTo(10 - defaultBalance.regulationDecay - 0.3, 9);
    expect(ai.backlash).toBeCloseTo(10 - defaultBalance.backlashDecay - 0.2, 9);
    const human = step(calm(PLAYER), decaying).labs[PLAYER];
    expect(human.regulation).toBeCloseTo(10 - defaultBalance.regulationDecay, 9);
  });
});

describe('economy scaling', () => {
  it('cashBase is earned every tick without users, times the cashIncome stat', () => {
    const based = withBalance(still, { cashBase: 2 });
    const state = editLab(newGame(based), PLAYER, (l) => ((l.adoption = {}), (l.cash = 0), (l.founderId = 'dealer')));
    expect(step(state, based).labs[PLAYER].cash).toBeCloseTo(2 * 1.15, 9); // dealer: cashIncome ×1.15
  });

  it('nodeCostGrowth raises node prices with every node owned', () => {
    const growing = withBalance(still, { nodeCostGrowth: 0.1 });
    const base = getNodeCost(newGame(growing), growing, PLAYER, 'c2').hype;
    const owning = editLab(newGame(growing), PLAYER, (l) => (l.ownedNodes = ['c1', 'r1', 's1']));
    expect(getNodeCost(owning, growing, PLAYER, 'c2').hype).toBeCloseTo(base * 1.3, 9);
  });

  it('dataCentreUpgradeGrowth raises upgrade prices with total levels owned', () => {
    const growing = withBalance(still, { dataCentreUpgradeGrowth: 0.1 });
    const state = editLab(newGame(growing), PLAYER, (l) => {
      l.dataCentres = [
        { id: 'a', regionId: 'north', level: 2 },
        { id: 'b', regionId: 'north', level: 3 },
      ];
    });
    expect(getUpgradeCost(state, growing, PLAYER, 'a')).toBeCloseTo(defaultBalance.dataCentreUpgradeCost * 2 * (1 + 0.1 * 5), 9);
  });

  it('user counts follow adoption changed by actions between ticks', () => {
    const state = step(newGame(still), still);
    const before = getUsers(state, still, PLAYER);
    const after = mustApplyLaunch(state, still, 'south');
    expect(getUsers(after, still, PLAYER)).toBeCloseTo(before + defaultBalance.launchAdoption * 500, 6);
  });
});

describe('AI controller rules', () => {
  const pack = quietPack({ rivals: testPack.rivals });

  it('AI labs never buy other labs, even when they could', () => {
    const state = editLab(newGame(pack), 'alpha', (l) => ((l.ownedNodes = ['r1', 'r2', 'r3']), (l.cash = 1e6)));
    expect(chooseAiActions(state, pack, 'alpha').some((a) => a.type === 'acquireRival')).toBe(false);
  });

  it('a lab whose meters run high stops launching and stops adding compute', () => {
    const rich = (meters: number) =>
      editLab(newGame(pack), 'alpha', (l) => {
        l.cash = 1e5;
        l.hype = 0;
        l.dataCentres = [{ id: 'd', regionId: 'east', level: 1 }];
        l.regulation = meters;
        l.backlash = meters;
      });
    const kinds = (meters: number) => new Set(chooseAiActions(rich(meters), pack, 'alpha').map((a) => a.type));
    // Over many ticks a relaxed lab launches (launches are a random draw) and builds; a worried one never does.
    const relaxed = new Set<string>();
    const worried = new Set<string>();
    for (let tick = 0; tick < 40; tick++) {
      const at = (meters: number) => ({ ...rich(meters), tick });
      for (const a of chooseAiActions(at(0), pack, 'alpha')) relaxed.add(a.type);
      for (const a of chooseAiActions(at(90), pack, 'alpha')) worried.add(a.type);
    }
    expect(relaxed.has('launchInRegion')).toBe(true);
    expect(kinds(0).has('buildDataCentre') || kinds(0).has('upgradeDataCentre')).toBe(true);
    expect(worried.has('launchInRegion')).toBe(false);
    expect(worried.has('buildDataCentre') || worried.has('upgradeDataCentre')).toBe(false);
  });

  it('a lab worried about regulation buys the node that lowers it', () => {
    const state = editLab(newGame(pack), 'alpha', (l) => {
      l.hype = 13;
      l.cash = 0;
      l.regulation = 90;
      l.personality = { capability: 1, reach: 1, shadow: 0.05, expansion: 0 };
    });
    expect(chooseAiActions(state, pack, 'alpha')).toContainEqual({ type: 'buyNode', labId: 'alpha', nodeId: 's1' });
  });
});
