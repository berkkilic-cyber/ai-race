import { labFixture } from '../__fixtures__/content';
import { createGarage, offlineCapMs, offlineRate, prestige, prestigePreview, shipNeeded, shipThreshold, tap } from '../garage';
import { launchTraining, nextStage, trainingStatus } from '../labActions';
import { autoShipDue, buyParadigmNode, paradigmGain, paradigmNodeBlock, paradigmShift, paradigmStatus, runAutoShip, setAutoShip } from '../paradigm';
import { paradigmEffects, paradigmMultiplier } from '../paradigmRates';
import { HOUR_MS, comboAt, totalRate } from '../rates';
import { deserialize, serialize } from '../save';
import type { GarageContent, GarageState, ModelCandidate, ParadigmEffect } from '../types';
import { validateGarage } from '../validate';

const T0 = 1_700_000_000_000;

function content(): GarageContent {
  const c = labFixture();
  const node = (id: string, effect: ParadigmEffect, cost = 1, requires: string[] = []) => {
    c.strings[`pn.${id}`] = id;
    return { id, nameKey: `pn.${id}`, descKey: `pn.${id}`, icon: 'x', cost, requires, effect };
  };
  c.strings['pn.news'] = 'shift {n}';
  return {
    ...c,
    golden: { ...c.golden, firstAfterMs: 1e15 },
    incidents: { ...c.incidents, firstAfterMs: 1e15 },
    happenings: { ...c.happenings!, firstAfterMs: 1e15 },
    paradigm: {
      minGeneration: 2,
      base: 3,
      perGeneration: 1,
      perLogHype: 1,
      productionPerPoint: 1.5,
      stageEase: 0.5,
      newsKey: 'pn.news',
      nodes: [
        node('mult', { kind: 'globalMult', mult: 3 }),
        node('stage', { kind: 'startStage', stage: 2 }),
        node('cands', { kind: 'candidates', add: 1 }, 1, ['stage']),
        node('queue', { kind: 'trainingQueue', add: 2 }),
        node('crate', { kind: 'crateMult', mult: 2 }),
        node('away', { kind: 'awayHours', hours: 2 }),
        node('rate', { kind: 'offlineRate', add: 0.15 }),
        node('auto', { kind: 'autoShip', choice: 'safe' }, 5, ['mult']),
        node('interns', { kind: 'startGenerators', generator: 'a', count: 25 }),
        node('archive', { kind: 'keepModels' }),
        node('busy', { kind: 'happeningInterval', mult: 0.5 }),
        node('combo', { kind: 'comboWindow', addMs: 400 }),
        node('bar', { kind: 'shipThreshold', mult: 0.5 }),
        node('luck', { kind: 'rarityLuck', add: 1 }),
        node('taps', { kind: 'tapMult', mult: 4 }),
      ],
    },
  };
}

const c = content();
const model = (uid: number): ModelCandidate => ({ uid, prefix: 0, suffix: 0, version: 1, rarity: 'r0', desc: 0, boons: [{ trait: 'tp', value: 0.2 }] });

/** A save at generation `gen` with some of everything. */
function late(gen = 2, extra: Partial<GarageState> = {}): GarageState {
  const s = createGarage(c, T0, 3);
  return {
    ...s,
    stage: 4,
    generation: gen,
    hype: 99,
    labRep: 4,
    tokens: 5e6,
    genLifetime: 6e6,
    generators: { a: 40, b: 10 },
    upgrades: ['off', 'glob'],
    models: [model(50)],
    training: { charges: 2, nextChargeAt: T0 + 60_000, candidates: null },
    stats: { ...s.stats, taps: 1234, modelsShipped: gen, tokensAllTime: 1e8 },
    ...extra,
  };
}

/** A save with these nodes owned. */
function owning(nodes: string[], extra: Partial<GarageState> = {}): GarageState {
  return { ...createGarage(c, T0, 3), paradigm: { count: 1, points: 0, earned: 0, nodes, autoShip: false, bestGeneration: 2 }, ...extra };
}

describe('Paradigm Shift', () => {
  it('validates, and refuses a node listed before what it needs', () => {
    expect(validateGarage(c)).toEqual([]);
    const bad = content();
    bad.paradigm = { ...bad.paradigm!, nodes: [...bad.paradigm!.nodes].reverse() };
    expect(validateGarage(bad).join('\n')).toMatch(/must be listed before it/);
  });

  it('is not available before the last named model, then pays base + generations past it + log10(Hype)', () => {
    expect(paradigmGain(late(1), c)).toBe(0);
    expect(paradigmShift(late(1), c, T0).ok).toBe(false);
    expect(paradigmStatus(late(1), c)).toMatchObject({ enabled: true, available: false });
    // 3 + 1 × (3 − 2) + log10(100) = 6.
    expect(paradigmGain(late(3), c)).toBe(6);
    expect(paradigmStatus(late(2), c)).toMatchObject({ available: true, gain: 5, multNow: 1 });
    expect(paradigmStatus(late(2), c).multAfter).toBeCloseTo(Math.pow(1.5, 5));
  });

  it('resets models shipped, Hype, tokens, generators, models and per-ship upgrades; keeps Lab Rep, stats, storage upgrades, the queue and the stage it eases', () => {
    const r = paradigmShift(late(2), c, T0);
    expect(r.ok).toBe(true);
    const s = r.state;
    expect(s).toMatchObject({ generation: 0, hype: 0, tokens: 0, genLifetime: 0, generators: {}, models: [], labRep: 4, lastShip: null });
    expect(s.upgrades).toEqual(['off']);
    expect(s.stats.taps).toBe(1234);
    expect(s.stats.modelsShipped).toBe(2);
    expect(s.training.charges).toBe(2);
    expect(s.paradigm).toEqual({ count: 1, points: 5, earned: 5, nodes: [], autoShip: false, bestGeneration: 2 });
    // The all-time stage (s1) comes back at once; generation stages wait for ships.
    expect(s.stage).toBe(1);
    expect(s.news[s.news.length - 1]).toMatchObject({ key: 'pn.news', kind: 'paradigm', params: { n: 1 } });
  });

  it('stages come back sooner after a shift: a stage needing generation 3 needs 2', () => {
    const shifted = paradigmShift(late(2), c, T0).state;
    expect(nextStage({ ...shifted, stage: 3 }, c)?.requirement).toEqual({ type: 'generation', min: 2 });
    let s: GarageState = { ...shifted, genLifetime: shipThreshold(c, 1), tokens: 0 };
    s = prestige(s, c, T0 + 1000).state;
    // Generation 1 now reaches the stages that needed 1 and 2.
    expect(s.stage).toBe(3);
    s = prestige({ ...s, genLifetime: shipThreshold(c, 2) }, c, T0 + 2000).state;
    expect(s.stage).toBe(4);
    // Before any shift the original requirement holds.
    expect(nextStage({ ...late(2), stage: 3 }, c)?.requirement).toEqual({ type: 'generation', min: 3 });
  });

  it('currency ever earned multiplies production (compounding), with the tree on top', () => {
    const plain = late(2, { incident: null, frenzy: null });
    const shifted = { ...plain, paradigm: { count: 1, points: 2, earned: 2, nodes: [], autoShip: false, bestGeneration: 2 } };
    expect(totalRate(shifted, c) / totalRate(plain, c)).toBeCloseTo(2.25);
    expect(paradigmMultiplier({ paradigm: { ...shifted.paradigm, nodes: ['mult'] } }, c)).toBeCloseTo(6.75);
    expect(paradigmMultiplier({ paradigm: { ...shifted.paradigm, earned: NaN } }, c)).toBe(1);
  });

  it('buys nodes with the currency, in order, once', () => {
    let s = paradigmShift(late(2), c, T0).state; // 5 points
    expect(paradigmNodeBlock(s, c, 'cands')).toBe('locked');
    expect(paradigmNodeBlock(s, c, 'nope')).toBe('unknownId');
    s = buyParadigmNode(s, c, 'stage', T0).state;
    expect(s.stage).toBe(2);
    s = buyParadigmNode(s, c, 'cands', T0).state;
    expect(buyParadigmNode(s, c, 'cands', T0).reason).toBe('owned');
    expect(s.paradigm!.points).toBe(3);
    expect(buyParadigmNode(s, c, 'auto', T0).reason).toBe('locked');
    s = buyParadigmNode(s, c, 'mult', T0).state;
    expect(buyParadigmNode(s, c, 'auto', T0).reason).toBe('cantAfford');
  });

  it('each node changes how the next cycle plays', () => {
    // Fourth candidate.
    expect(launchTraining(owning(['cands'], { stage: 1, training: { charges: 1, nextChargeAt: 0, candidates: null } }), c, T0).state.training.candidates).toHaveLength(4);
    // Bigger queue.
    expect(trainingStatus(owning(['queue'], { stage: 1 }), c).queueMax).toBe(5);
    // Away storage and rate.
    expect(offlineCapMs(owning(['away']), c) - offlineCapMs(owning([]), c)).toBe(2 * HOUR_MS);
    expect(offlineRate(owning(['rate']), c) - offlineRate(owning([]), c)).toBeCloseTo(0.15);
    // Lower bar.
    expect(shipNeeded(owning(['bar']), c)).toBe(shipThreshold(c, 1) / 2);
    expect(prestigePreview(owning(['bar']), c).needed).toBe(shipThreshold(c, 1) / 2);
    // Longer combo window.
    const tapped = tap(owning(['combo']), c, T0).state;
    expect(comboAt(tapped, c, T0 + 800)).toBe(1);
    expect(comboAt(tap(owning([]), c, T0).state, c, T0 + 800)).toBe(0);
    // Taps ×4.
    expect(tap(owning(['taps']), c, T0).gained).toBeCloseTo(4 * tap(owning([]), c, T0).gained);
    // Effects add up; the crate multiplier and happening interval are there for the UI and lab.
    expect(paradigmEffects(owning(['crate', 'busy', 'luck']), c)).toMatchObject({ crateMult: 2, happeningInterval: 0.5, rarityLuck: 1 });
  });

  it('start generators come with every ship and every shift; the archive keeps models through a shift', () => {
    const ready = late(2, { paradigm: { count: 1, points: 0, earned: 0, nodes: ['interns', 'archive'], autoShip: false, bestGeneration: 2 } });
    const shifted = paradigmShift(ready, c, T0).state;
    expect(shifted.generators).toEqual({ a: 25 });
    expect(shifted.models).toEqual([model(50)]);
    const shipped = prestige({ ...shifted, genLifetime: shipThreshold(c, 1) }, c, T0 + 1000).state;
    expect(shipped.generators).toEqual({ a: 25 });
  });

  it('auto-ship: needs its node and its switch, ships with its launch choice when worth it', () => {
    const base = late(0, { genLifetime: 1e6, hype: 0 });
    expect(setAutoShip(base, c, true, T0).ok).toBe(false);
    let s = buyParadigmNode({ ...base, paradigm: { count: 1, points: 9, earned: 9, nodes: ['mult'], autoShip: false, bestGeneration: 2 } }, c, 'auto', T0).state;
    expect(s.paradigm!.autoShip).toBe(true);
    expect(autoShipDue(s, c)).toBe(true);
    const r = runAutoShip(s, c, T0);
    expect(r.ok).toBe(true);
    expect(r.state.generation).toBe(1);
    expect(r.state.shipChoice).toBe('safe');
    s = setAutoShip(s, c, false, T0).state;
    expect(autoShipDue(s, c)).toBe(false);
    expect(runAutoShip(s, c, T0).ok).toBe(false);
  });
});

describe('saves (version 4)', () => {
  it('keep the Paradigm layer and drop unknown nodes', () => {
    const s = owning(['mult', 'gone', 'mult']);
    const back = deserialize(serialize(s), c, T0).state;
    expect(back.paradigm).toEqual({ count: 1, points: 0, earned: 0, nodes: ['mult'], autoShip: false, bestGeneration: 2 });
  });

  it('a version 3 save loads with no Paradigm layer, its progress and its offline report intact', () => {
    const v3 = late(2, { offline: { awayMs: 5 * HOUR_MS, creditedMs: 4 * HOUR_MS, tokens: 99, doubled: false } });
    const { paradigm: _p, ...state } = { ...v3, version: 3 };
    void _p;
    const loaded = deserialize(JSON.stringify({ v: 3, state }), c, T0);
    expect(loaded.migratedFrom).toBe(3);
    expect(loaded.error).toBeUndefined();
    expect(loaded.state.version).toBe(4);
    expect(loaded.state.paradigm).toBeUndefined();
    expect(loaded.state).toMatchObject({ generation: 2, hype: 99, labRep: 4, stage: 4 });
    expect(loaded.state.offline).toEqual({ awayMs: 5 * HOUR_MS, creditedMs: 4 * HOUR_MS, tokens: 99, doubled: false });
  });

  it('a content without the layer ignores a saved one', () => {
    const plain = labFixture();
    expect(deserialize(serialize(owning(['mult'])), plain, T0).state.paradigm).toBeUndefined();
  });
});
