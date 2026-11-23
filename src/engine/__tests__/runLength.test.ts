import {
  applyAction,
  createGame,
  defaultBalance,
  getBalance,
  getComputeRequired,
  getFounderStart,
  getRunLength,
  getRunLengths,
  getScoreMultiplier,
  mergeBalance,
  resolveRunLength,
  runHeadless,
  step,
  summarizeRun,
  type ContentPack,
  type DifficultyDef,
  type GameState,
  type RunLengthDef,
} from '@/engine';
import { applyPace, PACE_RATE_KEYS, PACE_TICK_KEYS, paceOf, pacedTicks, pacedTickValue } from '../balance';
import { checkCondition } from '../conditions';
import { getContext } from '../context';
import { applyEffects } from '../effects';
import { cloneState } from '../clone';
import { editLab, PLAYER } from '../__fixtures__/helpers';
import { momentPack, testPack, testSetup } from '../__fixtures__/testPack';

const sprint: RunLengthDef = { id: 'sprint', nameKey: 'rl.sprint', descKey: 'rl.sprint.desc', scoreMultiplier: 0.5, balance: { pace: 2.5, dependenceShare: 0.35 } };
const full: RunLengthDef = { id: 'full', nameKey: 'rl.full', descKey: 'rl.full.desc', scoreMultiplier: 1, balance: {} };
const normal: DifficultyDef = { id: 'normal', nameKey: 'd.normal', descKey: 'd.normal.desc', scoreMultiplier: 2, balance: { dependenceShare: 0.6, aiAgiFactor: 1.4 } };

/** testPack with a pack balance, one difficulty and two run lengths (full the default). */
const pack: ContentPack = {
  ...testPack,
  balance: { dependenceShare: 0.4, firstEventTick: 77 },
  difficulties: [normal],
  defaultDifficulty: 'normal',
  runLengths: [sprint, full],
  defaultRunLength: 'full',
};

function at(runLength: string | undefined, p: ContentPack = pack): GameState {
  return createGame(p, { ...testSetup, ...(runLength !== undefined ? { runLength } : {}) });
}

describe('run length: pace helpers', () => {
  it('paceOf accepts only finite positive numbers', () => {
    expect(paceOf({ pace: 2 })).toBe(2);
    expect(paceOf({ pace: 0 })).toBe(1);
    expect(paceOf({ pace: -3 })).toBe(1);
    expect(paceOf({ pace: Number.NaN })).toBe(1);
    expect(paceOf({ pace: Number.POSITIVE_INFINITY })).toBe(1);
  });

  it('pacedTicks divides and rounds, never below 1, identity at pace 1', () => {
    expect(pacedTicks(1, 37)).toBe(37);
    expect(pacedTicks(2, 37)).toBe(19);
    expect(pacedTicks(3, 1)).toBe(1);
    expect(pacedTicks(4, 0)).toBe(1);
    expect(pacedTickValue(2, 0)).toBe(0);
    expect(pacedTickValue(2.5, 2500)).toBe(1000);
    expect(pacedTickValue(1, 7)).toBe(7);
  });

  it('applyPace multiplies rates, divides tick counts and leaves everything else', () => {
    const base = mergeBalance({}, { pace: 2 });
    const paced = applyPace(base);
    for (const key of PACE_RATE_KEYS) expect(paced[key]).toBeCloseTo(Math.min(key.endsWith('DecayRate') ? 1 : Infinity, base[key] * 2), 10);
    for (const key of PACE_TICK_KEYS) expect(paced[key]).toBe(Math.max(1, Math.round(base[key] / 2)));
    // Not paced: per-event amounts, costs, thresholds and moment timing (real time).
    expect(paced.hypePerNewUser).toBe(base.hypePerNewUser);
    expect(paced.regulationPerGrowth).toBe(base.regulationPerGrowth);
    expect(paced.dataCentreBaseCost).toBe(base.dataCentreBaseCost);
    expect(paced.momentIntervalMin).toBe(base.momentIntervalMin);
    expect(paced.momentFirstTick).toBe(base.momentFirstTick);
  });

  it('applyPace keeps per-tick fractions at most 1', () => {
    expect(applyPace(mergeBalance({ eliminatedDecayRate: 0.5 }, { pace: 3 })).eliminatedDecayRate).toBe(1);
  });

  it('applyPace returns the very same balance at pace 1', () => {
    const b = mergeBalance({});
    expect(applyPace(b)).toBe(b);
  });
});

describe('run length: resolution', () => {
  it('records the resolved id on the state', () => {
    expect(at('sprint').runLength).toBe('sprint');
    expect(at('full').runLength).toBe('full');
    expect(at(undefined).runLength).toBe('full');
    expect(at('marathon').runLength).toBe('full');
  });

  it('unknown or missing falls back to the pack default, then to none', () => {
    expect(resolveRunLength(pack, 'nope')?.id).toBe('full');
    expect(resolveRunLength(pack)?.id).toBe('full');
    expect(resolveRunLength(pack, 'sprint')?.id).toBe('sprint');
    const noDefault: ContentPack = { ...pack, defaultRunLength: undefined };
    expect(resolveRunLength(noDefault, 'nope')).toBeUndefined();
    expect(at('nope', noDefault).runLength).toBeUndefined();
    expect(resolveRunLength({ ...pack, defaultRunLength: 'gone' })).toBeUndefined();
    expect(resolveRunLength({ ...pack, runLengths: [] }, 'sprint')).toBeUndefined();
  });

  it('getRunLengths lists the presets in pack order, [] without', () => {
    expect(getRunLengths(pack).map((r) => r.id)).toEqual(['sprint', 'full']);
    expect(getRunLengths(testPack)).toEqual([]);
  });

  it('getRunLength reads the run’s preset; a removed id reads the default', () => {
    expect(getRunLength(at('sprint'), pack)?.id).toBe('sprint');
    expect(getRunLength({ ...at('sprint'), runLength: 'removed' }, pack)?.id).toBe('full');
    expect(getRunLength(createGame(testPack, testSetup), testPack)).toBeUndefined();
  });

  it('a pack without run lengths plays exactly as before, whatever the setup names', () => {
    const plain = createGame(testPack, testSetup);
    expect(plain.runLength).toBeUndefined();
    expect(createGame(testPack, { ...testSetup, runLength: 'sprint' })).toEqual(plain);
    expect(getBalance(plain, testPack)).toEqual(mergeBalance(testPack.balance));
    const a = runHeadless(testPack, { ...testSetup, seed: 9 }, { policy: 'sensible', maxTicks: 600 });
    const b = runHeadless(testPack, { ...testSetup, seed: 9, runLength: 'sprint' }, { policy: 'sensible', maxTicks: 600 });
    expect(b).toEqual(a);
  });

  it('the full preset (no overrides) plays exactly like a pack without run lengths', () => {
    const without: ContentPack = { ...pack, runLengths: undefined, defaultRunLength: undefined };
    const a = runHeadless(without, { ...testSetup, seed: 4 }, { policy: 'sensible', maxTicks: 900 });
    const b = runHeadless(pack, { ...testSetup, seed: 4, runLength: 'full' }, { policy: 'sensible', maxTicks: 900 });
    expect({ ...b, runLength: undefined }).toEqual({ ...a, runLength: undefined });
    expect(b.runLength).toBe('full');
  });
});

describe('run length: balance layers', () => {
  it('merges defaults <- pack <- difficulty <- run length, then paces', () => {
    const b = getBalance(at('sprint'), pack);
    expect(b.dependenceShare).toBe(0.35); // run length wins over difficulty (0.6) and pack (0.4)
    expect(b.aiAgiFactor).toBe(1.4); // difficulty still applies
    expect(b.pace).toBe(2.5);
    expect(b.firstEventTick).toBe(Math.round(77 / 2.5)); // pack value, paced
    expect(b.baseSpread).toBeCloseTo(defaultBalance.baseSpread * 2.5, 12);
    expect(b).toEqual(applyPace(mergeBalance(pack.balance, normal.balance, sprint.balance)));
  });

  it('getFounderStart takes the run length into account', () => {
    const rich: ContentPack = { ...pack, runLengths: [{ ...sprint, balance: { pace: 2, playerStartCashFactor: 3 } }, full] };
    const founder = testPack.founders[0];
    expect(getFounderStart(rich, founder.id, 'normal', 'sprint').cash).toBe(founder.startCash * 3);
    expect(getFounderStart(rich, founder.id, 'normal').cash).toBe(founder.startCash);
    expect(at('sprint', rich).labs[PLAYER].cash).toBe(founder.startCash * 3);
  });

  it('getComputeRequired is the same at every run length (compute curve is not paced)', () => {
    expect(getComputeRequired(pack, 3, at('sprint'))).toBe(getComputeRequired(pack, 3));
  });
});

describe('run length: pacing content', () => {
  const quiet: ContentPack = { ...pack, events: [], headlines: [] };

  it('rivals enter at entryTick ÷ pace', () => {
    const beta = testPack.rivals.find((r) => r.id === 'beta')!;
    const entry = Math.round(beta.entryTick / 2.5);
    let state = at('sprint', quiet);
    while (state.tick < entry - 1) state = step(state, quiet);
    expect(state.labs.beta.active).toBe(false);
    state = step(state, quiet);
    expect(state.labs.beta.active).toBe(true);
  });

  it('effect durations are divided by pace (timed modifier, ban, disable, timed flag)', () => {
    const run = at('sprint', quiet);
    const draft = cloneState(editLab(run, PLAYER, (l) => (l.dataCentres = [{ id: 'dc', regionId: 'north', level: 1 }])));
    const context = getContext(quiet, draft.difficulty, draft.runLength);
    applyEffects(draft, context, draft.labs[PLAYER], [
      { type: 'timedModifier', modifier: { stat: 'spreadRate', op: 'mul', value: 2 }, durationTicks: 100 },
      { type: 'ban', scope: { kind: 'region', id: 'east' }, durationTicks: 50 },
      { type: 'ban', scope: { kind: 'region', id: 'south' }, durationTicks: -1 },
      { type: 'dataCentre', action: 'disable', scope: { kind: 'home' }, durationTicks: 30 },
      { type: 'setFlag', flag: 'buzz', durationTicks: 25 },
    ]);
    const lab = draft.labs[PLAYER];
    expect(lab.timedModifiers[0].untilTick).toBe(40);
    expect(lab.bans.east).toBe(20);
    expect(lab.bans.south).toBe(-1);
    expect(lab.dataCentres[0].disabledUntilTick).toBe(12);
    expect(lab.flagTimers?.buzz).toBe(10);
  });

  it('effect durations are unchanged in a standard run', () => {
    const run = at('full', quiet);
    const draft = cloneState(run);
    const context = getContext(quiet, draft.difficulty, draft.runLength);
    applyEffects(draft, context, draft.labs[PLAYER], [{ type: 'timedModifier', modifier: { stat: 'spreadRate', op: 'mul', value: 2 }, durationTicks: 100 }]);
    expect(draft.labs[PLAYER].timedModifiers[0].untilTick).toBe(100);
  });

  it('tick conditions are divided by pace', () => {
    const context = getContext(pack, undefined, 'sprint');
    const state = { ...at('sprint'), tick: 1000 };
    const lab = state.labs[PLAYER];
    expect(checkCondition(state, context, lab, { type: 'tickAtMost', value: 2500 })).toBe(true);
    expect(checkCondition(state, context, lab, { type: 'tickAtMost', value: 2400 })).toBe(false);
    expect(checkCondition(state, context, lab, { type: 'tickAtLeast', value: 2500 })).toBe(true);
    expect(checkCondition(state, context, lab, { type: 'tickAtLeast', value: 2600 })).toBe(false);
    const fullContext = getContext(pack, undefined, 'full');
    expect(checkCondition(state, fullContext, lab, { type: 'tickAtLeast', value: 2500 })).toBe(false);
  });

  it('moment lifetimes and spawn timing stay in real ticks', () => {
    const p: ContentPack = { ...momentPack, events: [], headlines: [], runLengths: [sprint, full], defaultRunLength: 'full' };
    const firstMoment = (runLength: string) => {
      let state = createGame(p, { ...testSetup, runLength });
      while (state.moments.length === 0 && state.tick < 400) state = step(state, p);
      const m = state.moments[0];
      return { spawn: m.spawnTick, life: m.expiresTick - m.spawnTick, def: p.moments.find((d) => d.id === m.defId)! };
    };
    const a = firstMoment('full');
    const b = firstMoment('sprint');
    expect(a.life).toBe(a.def.lifetimeTicks);
    expect(b.life).toBe(b.def.lifetimeTicks);
    expect(b.spawn).toBe(a.spawn);
    expect(getBalance(createGame(p, { ...testSetup, runLength: 'sprint' }), p).momentIntervalMin).toBe(getBalance(createGame(p, testSetup), p).momentIntervalMin);
  });

  it('a sprint gets through the same growth in fewer ticks', () => {
    const p: ContentPack = { ...quiet, rivals: [] };
    const ticksTo = (runLength: string, share: number) => {
      let state = at(runLength, p);
      let n = 0;
      while (state.status === 'running' && n < 4000) {
        state = step(state, p);
        n++;
        const lab = state.labs[PLAYER];
        if (Object.values(lab.adoption).reduce((s, v) => s + v, 0) >= share) return n;
      }
      return n;
    };
    const fullTicks = ticksTo('full', 0.3);
    const sprintTicks = ticksTo('sprint', 0.3);
    expect(sprintTicks).toBeLessThan(fullTicks);
    expect(fullTicks / sprintTicks).toBeGreaterThan(2);
    expect(fullTicks / sprintTicks).toBeLessThan(3);
  });
});

describe('run length: score', () => {
  it('multiplies the final score by the difficulty and the run-length multipliers, rounded once', () => {
    const quiet: ContentPack = { ...pack, rivals: [], events: [], headlines: [] };
    const win = (runLength: string) => step(editLab(at(runLength, quiet), PLAYER, (l) => (l.agiProgress = 100)), quiet).ending!.score;
    const plainPack: ContentPack = { ...quiet, difficulties: undefined, defaultDifficulty: undefined, runLengths: undefined, defaultRunLength: undefined };
    const plain = step(editLab(createGame(plainPack, testSetup), PLAYER, (l) => (l.agiProgress = 100)), plainPack).ending!.score;
    expect(Math.abs(win('full') - plain * 2)).toBeLessThanOrEqual(1);
    // The speed bonus is paced with the run, so the raw sprint score at tick 1 is about the same.
    expect(Math.abs(win('sprint') - plain * 2 * 0.5)).toBeLessThanOrEqual(1);
    expect(getScoreMultiplier(at('sprint'), pack)).toBe(1);
    expect(getScoreMultiplier(at('full'), pack)).toBe(2);
    expect(getScoreMultiplier(createGame(testPack, testSetup), testPack)).toBe(1);
  });
});

describe('run length: determinism', () => {
  it('same seed and run length give the same run; run lengths differ', () => {
    const run = (runLength: string) => runHeadless(pack, { ...testSetup, seed: 5, runLength }, { policy: 'sensible', maxTicks: 800 });
    expect(run('sprint')).toEqual(run('sprint'));
    expect(run('sprint')).not.toEqual(run('full'));
  });

  it('the headless runLength option replaces the setup’s', () => {
    const a = runHeadless(pack, { ...testSetup, seed: 3, runLength: 'full' }, { policy: 'sensible', maxTicks: 500, runLength: 'sprint' });
    const b = runHeadless(pack, { ...testSetup, seed: 3, runLength: 'sprint' }, { policy: 'sensible', maxTicks: 500 });
    expect(a).toEqual(b);
    expect(summarizeRun(a, pack).ticks).toBe(a.tick);
  });

  it('step and applyAction never mutate a sprint state', () => {
    const state = at('sprint');
    const snapshot = JSON.stringify(state);
    step(state, pack);
    applyAction(state, pack, { type: 'buyNode', labId: PLAYER, nodeId: 'c1' });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
