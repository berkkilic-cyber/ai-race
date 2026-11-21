import {
  createGame,
  defaultBalance,
  getBalance,
  getComputeRequired,
  getDifficulties,
  getDifficulty,
  getFounderStart,
  getWinProgress,
  mergeBalance,
  resolveDifficulty,
  runHeadless,
  step,
  type ContentPack,
  type DifficultyDef,
  type GameState,
} from '@/engine';
import { editLab, PLAYER } from '../__fixtures__/helpers';
import { momentPack, testPack, testSetup } from '../__fixtures__/testPack';

const easy: DifficultyDef = { id: 'easy', nameKey: 'd.easy', descKey: 'd.easy.desc', scoreMultiplier: 0.5, balance: { dependenceShare: 0.3, playerStartHypeFactor: 2 } };
const normal: DifficultyDef = { id: 'normal', nameKey: 'd.normal', descKey: 'd.normal.desc', scoreMultiplier: 1, balance: { dependenceShare: 0.6 } };
const hard: DifficultyDef = {
  id: 'hard',
  nameKey: 'd.hard',
  descKey: 'd.hard.desc',
  scoreMultiplier: 2,
  balance: { dependenceShare: 0.8, aiAgiFactor: 3, rivalEntryTickFactor: 0.5, aiExpansionFactor: 2, playerStartCashFactor: 0.5 },
};

/** testPack with a pack-level balance and three levels, normal the default. */
const pack: ContentPack = { ...testPack, balance: { dependenceShare: 0.4, firstEventTick: 77 }, difficulties: [easy, normal, hard], defaultDifficulty: 'normal' };

function at(difficulty: string | undefined, p: ContentPack = pack): GameState {
  return createGame(p, { ...testSetup, ...(difficulty !== undefined ? { difficulty } : {}) });
}

describe('difficulty: balance merge', () => {
  it('merges engine defaults <- pack balance <- difficulty balance', () => {
    const state = at('hard');
    const b = getBalance(state, pack);
    expect(b.dependenceShare).toBe(0.8); // difficulty wins over pack
    expect(b.firstEventTick).toBe(77); // pack wins over default
    expect(b.baseSpread).toBe(defaultBalance.baseSpread); // default
    expect(b).toEqual(mergeBalance(pack.balance, hard.balance));
  });

  it('mergeBalance applies later layers last', () => {
    expect(mergeBalance({ agiBase: 1 }, { agiBase: 2 }, { agiBase: 3 }).agiBase).toBe(3);
    expect(mergeBalance({ agiBase: 1 }).agiBase).toBe(1);
  });

  it('every engine read uses the run’s difficulty, including selectors called with only the pack and state', () => {
    const hardRun = editLab(at('hard'), PLAYER, (l) => (l.adoption = { north: 1 }));
    // Same world share, different thresholds per difficulty.
    const share = (s: GameState) => getWinProgress(s, pack, PLAYER).dependence;
    const sameEasy = editLab(at('easy'), PLAYER, (l) => (l.adoption = { north: 1 }));
    expect(share(sameEasy)).toBeGreaterThan(share(hardRun));
    expect(share(sameEasy) / share(hardRun)).toBeCloseTo(0.8 / 0.3, 5);
  });

  it('ends a dependence run at the difficulty’s threshold, not the pack’s', () => {
    const quiet: ContentPack = { ...pack, rivals: [], events: [], headlines: [] };
    const bigShare = (d: string) => editLab(at(d, quiet), PLAYER, (l) => (l.adoption = Object.fromEntries(quiet.regions.map((r) => [r.id, 0.5]))));
    // 50% everywhere = 50% world share: over easy (30%) and pack (40%), under hard (80%).
    expect(step(bigShare('easy'), quiet).ending?.trigger).toBe('dependence');
    expect(step(bigShare('hard'), quiet).ending).toBeNull();
  });

  it('getComputeRequired is the same with or without the state (compute curve is pack-only)', () => {
    expect(getComputeRequired(pack, 3)).toBe(getComputeRequired(pack, 3, at('hard')));
  });
});

describe('difficulty: fallback', () => {
  it('records the resolved id on the state', () => {
    expect(at('easy').difficulty).toBe('easy');
    expect(at(undefined).difficulty).toBe('normal');
    expect(at('nope').difficulty).toBe('normal');
  });

  it('unknown or missing falls back to the pack default, then to no override', () => {
    expect(resolveDifficulty(pack, 'nope')?.id).toBe('normal');
    expect(resolveDifficulty(pack)?.id).toBe('normal');
    const noDefault = { ...pack, defaultDifficulty: undefined };
    expect(resolveDifficulty(noDefault, 'nope')).toBeUndefined();
    expect(getBalance(at('nope', noDefault), noDefault).dependenceShare).toBe(0.4);
    const badDefault = { ...pack, defaultDifficulty: 'gone' };
    expect(resolveDifficulty(badDefault)).toBeUndefined();
  });

  it('a pack without difficulties plays exactly as before', () => {
    const plain = createGame(testPack, testSetup);
    expect(plain.difficulty).toBeUndefined();
    expect(getDifficulty(plain, testPack)).toBeUndefined();
    expect(getBalance(plain, testPack)).toEqual(mergeBalance(testPack.balance));
    const withLevelIgnored = createGame(testPack, { ...testSetup, difficulty: 'hard' });
    expect(withLevelIgnored).toEqual(plain);
  });

  it('a state whose difficulty no longer exists reads the default level', () => {
    const state = { ...at('easy'), difficulty: 'removed' };
    expect(getDifficulty(state, pack)?.id).toBe('normal');
  });
});

describe('difficulty: levers', () => {
  it('scales the player’s starting Hype and Cash', () => {
    const founder = testPack.founders[0];
    expect(at('easy').labs[PLAYER].hype).toBe(founder.startHype * 2);
    expect(at('hard').labs[PLAYER].cash).toBe(founder.startCash * 0.5);
    expect(at('normal').labs[PLAYER].hype).toBe(founder.startHype);
    expect(getFounderStart(pack, founder.id, 'easy')).toEqual({ hype: at('easy').labs[PLAYER].hype, cash: at('easy').labs[PLAYER].cash });
    expect(getFounderStart(pack, founder.id, 'hard').cash).toBe(founder.startCash * 0.5);
    expect(getFounderStart(pack, founder.id)).toEqual({ hype: founder.startHype, cash: founder.startCash });
    expect(() => getFounderStart(pack, 'ghost')).toThrow();
  });

  it('scales rival entry ticks and expansion', () => {
    const beta = testPack.rivals.find((r) => r.id === 'beta')!;
    const noEvents: ContentPack = { ...pack, events: [] };
    const hardRun = at('hard', noEvents);
    expect(hardRun.labs.beta.personality?.expansion).toBeCloseTo(beta.personality.expansion * 2);
    let state = hardRun;
    while (state.tick < beta.entryTick * 0.5 - 1) state = step(state, noEvents);
    expect(state.labs.beta.active).toBe(false);
    state = step(state, noEvents);
    expect(state.labs.beta.active).toBe(true);
  });

  it('player meter gain factors scale only human labs', () => {
    const base: ContentPack = { ...testPack, rivals: [], events: [], headlines: [], balance: { regulationDecay: 0, backlashDecay: 0 } };
    const scaled: ContentPack = {
      ...base,
      difficulties: [{ id: 'x', nameKey: 'x', descKey: 'x', scoreMultiplier: 1, balance: { playerRegulationGainFactor: 2, playerBacklashGainFactor: 3 } }],
      defaultDifficulty: 'x',
    };
    const prep = (p: ContentPack) =>
      editLab(createGame(p, testSetup), PLAYER, (l) => {
        l.adoption = Object.fromEntries(p.regions.map((r) => [r.id, 0.3]));
        l.ownedNodes = ['c1'];
        l.dataCentres = [{ id: 'dc1', regionId: 'north', level: 2 }];
      });
    const a = step(prep(base), base).labs[PLAYER];
    const b = step(prep(scaled), scaled).labs[PLAYER];
    expect(a.regulation).toBeGreaterThan(0);
    expect(a.backlash).toBeGreaterThan(0);
    expect(b.regulation).toBeCloseTo(a.regulation * 2, 6);
    expect(b.backlash).toBeCloseTo(a.backlash * 3, 6);
  });

  it('moment weight and lifetime factors change which moments appear and for how long', () => {
    const level = (balance: DifficultyDef['balance']): ContentPack => ({
      ...momentPack,
      events: [],
      headlines: [],
      difficulties: [{ id: 'x', nameKey: 'x', descKey: 'x', scoreMultiplier: 1, balance }],
      defaultDifficulty: 'x',
    });
    const spawned = (p: ContentPack) => {
      let state = createGame(p, testSetup);
      const seen = new Map<string, { kind: string; life: number }>();
      while (state.tick < 1500) {
        state = step(state, p);
        if (state.status === 'ended') break;
        for (const m of state.moments) seen.set(m.uid, { kind: p.moments.find((d) => d.id === m.defId)!.kind, life: m.expiresTick - m.spawnTick });
        state = { ...state, moments: [] };
      }
      return [...seen.values()];
    };
    const onlyThreats = spawned(level({ momentBoostWeightFactor: 0 }));
    expect(onlyThreats.length).toBeGreaterThan(0);
    expect(onlyThreats.every((m) => m.kind === 'threat')).toBe(true);
    const onlyBoosts = spawned(level({ momentThreatWeightFactor: 0, momentLifetimeFactor: 1.5 }));
    expect(onlyBoosts.every((m) => m.kind === 'boost')).toBe(true);
    expect(onlyBoosts.every((m) => m.life === 30)).toBe(true); // 20 × 1.5
  });
});

describe('difficulty: score', () => {
  it('multiplies the final score by scoreMultiplier', () => {
    const quiet: ContentPack = { ...pack, rivals: [], events: [], headlines: [] };
    const win = (d: string) => step(editLab(at(d, quiet), PLAYER, (l) => (l.agiProgress = 100)), quiet).ending!.score;
    const plainPack: ContentPack = { ...quiet, difficulties: undefined, defaultDifficulty: undefined };
    const plain = step(editLab(at(undefined, plainPack), PLAYER, (l) => (l.agiProgress = 100)), plainPack).ending!.score;
    // Same score inputs at every level (start Hype does not count), different multipliers.
    expect(win('normal')).toBe(plain);
    // The raw score is rounded once, after the multiplier.
    expect(Math.abs(win('hard') - plain * 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(win('easy') - plain * 0.5)).toBeLessThanOrEqual(0.5);
    expect(win('hard')).toBe(Math.round(win('hard')));
  });
});

describe('difficulty: determinism and selectors', () => {
  it('same seed and difficulty give the same run; difficulties differ', () => {
    const run = (difficulty: string) => runHeadless(pack, { ...testSetup, seed: 5, difficulty }, { policy: 'sensible', maxTicks: 1200 });
    expect(run('hard')).toEqual(run('hard'));
    expect(run('easy')).toEqual(run('easy'));
    expect(run('hard')).not.toEqual(run('easy'));
  });

  it('getDifficulties lists the pack’s levels; getDifficulty the run’s', () => {
    expect(getDifficulties(pack).map((d) => d.id)).toEqual(['easy', 'normal', 'hard']);
    expect(getDifficulties(testPack)).toEqual([]);
    expect(getDifficulty(at('hard'), pack)).toBe(hard);
  });
});
