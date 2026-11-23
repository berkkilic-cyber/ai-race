import { labFixture } from '../__fixtures__/content';
import { advance, buy, createGarage, GARAGE_VERSION, offlineCapMs, prestige, prestigePreview, tap } from '../garage';
import { autoBuyPick, evenStaff, happeningPenalty, happeningReward } from '../lab';
import { collectHappening, happeningQuote, keepModel, launchTraining, moveStaff, nextStage, retireModel, scrapCandidates, setAutoBuy, setStaff, shipReveal, trainingStatus } from '../labActions';
import { lastMilestone, mechanicOn, milestoneMult, modelEffects, modelSlots, nextMilestone, staffEffects } from '../labRates';
import { generatorRate, incidentFrequency, incidentSeverityMult, tapValue, totalRate } from '../rates';
import { deserialize, serialize } from '../save';
import type { GarageContent, GarageState, ModelCandidate } from '../types';
import { validateGarage } from '../validate';

const T0 = 1_700_000_000_000;
const c = labFixture();
/** No random events at all (exact numbers). */
const calm: GarageContent = {
  ...c,
  golden: { ...c.golden, firstAfterMs: 1e15 },
  incidents: { ...c.incidents, firstAfterMs: 1e15 },
  happenings: { ...c.happenings!, firstAfterMs: 1e15 },
};

/** A save at stage `stage` and generation `generation`, quiet. */
function at(stage: number, generation = 0, extra: Partial<GarageState> = {}): GarageState {
  const s = createGarage(calm, T0, 3);
  return { ...s, stage, generation, nextHappeningAt: 1e15, nextGoldenAt: 1e15, nextIncidentAt: 1e15, ...extra };
}

const model = (uid: number, boons: [string, number][], drawback?: [string, number]): ModelCandidate => ({
  uid,
  prefix: 0,
  suffix: 0,
  version: 1,
  rarity: 'r0',
  desc: 0,
  boons: boons.map(([trait, value]) => ({ trait, value })),
  ...(drawback ? { drawback: { trait: drawback[0], value: drawback[1] } } : {}),
});

describe('lab content', () => {
  it('the lab fixture passes validation', () => {
    expect(validateGarage(c)).toEqual([]);
  });
  it('validation catches broken lab content', () => {
    const bad: GarageContent = {
      ...c,
      stages: [{ ...c.stages![0], requires: [{ type: 'allTime', tokens: 1 }] }, { ...c.stages![1], requires: [{ type: 'owned', generator: 'a', count: 3 }] }],
      happenings: { ...c.happenings!, penaltyCapShare: 0.5 },
    };
    const problems = validateGarage(bad).join('\n');
    expect(problems).toMatch(/first stage/);
    expect(problems).toMatch(/never reset/);
    expect(problems).toMatch(/penaltyCapShare/);
    expect(problems).toMatch(/staff needs a stage/);
  });
});

describe('milestones', () => {
  it('multiply a tier by each step passed, then repeat', () => {
    expect(milestoneMult(c, 9)).toBe(1);
    expect(milestoneMult(c, 10)).toBe(2);
    expect(milestoneMult(c, 25)).toBe(4);
    expect(milestoneMult(c, 49)).toBe(4);
    expect(milestoneMult(c, 50)).toBe(12);
    expect(milestoneMult(c, 75)).toBe(36);
  });
  it('always show the next one', () => {
    expect(nextMilestone(c, 0)).toEqual({ count: 10, mult: 2 });
    expect(nextMilestone(c, 10)).toEqual({ count: 25, mult: 2 });
    expect(nextMilestone(c, 25)).toEqual({ count: 50, mult: 3 });
    expect(nextMilestone(c, 60)).toEqual({ count: 75, mult: 3 });
    expect(lastMilestone(c, 60)).toBe(50);
  });
  it('apply to production', () => {
    const s9 = at(0, 0, { generators: { a: 9 } });
    const s10 = at(0, 0, { generators: { a: 10 } });
    expect(generatorRate(s10, calm, 'a') / generatorRate(s9, calm, 'a')).toBeCloseTo((10 / 9) * 2);
  });
});

describe('stages', () => {
  it('move in when progress allows, post a ticker line and give the first training run', () => {
    let s = createGarage(calm, T0, 1);
    expect(s.stage).toBe(0);
    expect(nextStage(s, calm)?.def.id).toBe('s1');
    s = { ...s, tokens: 2000 };
    s = buy(s, calm, 'a', 1, T0 + 1000).state; // any action re-checks the stage
    expect(s.stage).toBe(0); // all-time tokens, not tokens in hand
    for (let i = 0; i < 1000; i++) s = tap(s, calm, T0 + 2000 + i * 10).state;
    expect(s.stats.tokensAllTime).toBeGreaterThanOrEqual(1000);
    expect(s.stage).toBe(1);
    expect(s.news.some((n) => n.kind === 'stage' && n.key === 'st.s1.u')).toBe(true);
    expect(trainingStatus(s, calm)).toMatchObject({ unlocked: true, charges: 1, queueMax: 3, slots: 1 });
    expect(nextStage(s, calm)).toMatchObject({ index: 2, requirement: { type: 'generation', min: 1 }, progress: 0 });
  });
  it('are kept when a model ships, and later ones follow the generation', () => {
    const s = at(1, 0, { genLifetime: 20_000, tokens: 5 });
    const shipped = prestige(s, calm, T0 + 1000).state;
    expect(shipped.stage).toBe(2);
    expect(mechanicOn(shipped, calm, 'staff')).toBe(true);
    expect(modelSlots(shipped, calm)).toBe(2);
    expect(shipped.staff).toEqual(evenStaff(12));
  });
});

describe('training runs', () => {
  it('fill a small queue on a cooldown, online or away', () => {
    let s = at(1, 0, { training: { charges: 0, nextChargeAt: T0 + 120_000, candidates: null } });
    s = advance(s, calm, T0 + 50_000);
    expect(s.training.charges).toBe(0);
    s = advance(s, calm, T0 + 100_000);
    s = advance(s, calm, T0 + 121_000);
    expect(s.training.charges).toBe(1);
    expect(s.training.nextChargeAt).toBe(T0 + 240_000);
    // A long time away fills the queue to its cap and stops the clock.
    s = advance(s, calm, T0 + 10 * 3_600_000);
    expect(s.training.charges).toBe(3);
    expect(s.training.nextChargeAt).toBe(0);
    expect(trainingStatus(s, calm).readyAt).toBe(0);
  });
  it('are locked before the stage that switches them on', () => {
    const r = launchTraining(at(0), calm, T0 + 1);
    expect(r).toMatchObject({ ok: false, reason: 'locked' });
  });
  it('roll three candidates, each led by a different strength, deterministically', () => {
    const s = at(1, 0, { training: { charges: 2, nextChargeAt: T0 + 50_000, candidates: null } });
    const a = launchTraining(s, calm, T0 + 10);
    const b = launchTraining(s, calm, T0 + 10);
    expect(a.ok).toBe(true);
    expect(a.state).toEqual(b.state);
    const cands = a.state.training.candidates!;
    expect(cands).toHaveLength(3);
    const leads = cands.map((m) => calm.training!.traits.find((t) => t.id === m.boons[0].trait)!.stat);
    expect(new Set(leads).size).toBe(3);
    expect(a.state.training.charges).toBe(1);
    expect(a.state.stats.trainingRuns).toBe(1);
    // A second run waits for a pick.
    expect(launchTraining(a.state, calm, T0 + 20)).toMatchObject({ ok: false, reason: 'pending' });
  });
  it('restart the cooldown when a run is taken from a full queue', () => {
    const s = at(1, 0, { training: { charges: 3, nextChargeAt: 0, candidates: null } });
    const r = launchTraining(s, calm, T0 + 10);
    expect(r.state.training.charges).toBe(2);
    expect(r.state.training.nextChargeAt).toBe(T0 + 10 + 120_000);
  });
  it('rolled values stay in range, scaled by rarity, over many runs', () => {
    let s = at(1, 0, { training: { charges: 0, nextChargeAt: 0, candidates: null } });
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      s = { ...s, training: { charges: 1, nextChargeAt: 0, candidates: null } };
      s = launchTraining(s, calm, s.now + 1).state;
      for (const m of s.training.candidates!) {
        seen.add(m.rarity);
        const rar = calm.training!.rarities.find((r) => r.id === m.rarity)!;
        expect(m.boons.length).toBe(rar.boons);
        for (const b of m.boons) {
          const def = calm.training!.traits.find((t) => t.id === b.trait)!;
          const lo = Math.min(def.min, def.max) * rar.power - 0.51;
          const hi = Math.max(def.min, def.max) * rar.power + 0.51;
          expect(b.value).toBeGreaterThanOrEqual(lo);
          expect(b.value).toBeLessThanOrEqual(hi);
        }
        if (m.drawback) expect(calm.training!.drawbacks.some((d) => d.id === m.drawback!.trait)).toBe(true);
      }
    }
    expect(seen).toEqual(new Set(['r0', 'r1', 'r2']));
  });
  it('Research staff makes rare candidates more likely', () => {
    const rareShare = (research: number) => {
      let s = at(2, 1, { staff: { research, product: 12 - research - 0, safety: 0 }, training: { charges: 0, nextChargeAt: 0, candidates: null } });
      let rare = 0;
      for (let i = 0; i < 300; i++) {
        s = launchTraining({ ...s, training: { charges: 1, nextChargeAt: 0, candidates: null } }, calm, s.now + 1).state;
        rare += s.training.candidates!.filter((m) => m.rarity !== 'r0').length;
      }
      return rare;
    };
    expect(rareShare(12)).toBeGreaterThan(rareShare(0) * 1.5);
  });
  it('keep one candidate in a limited number of slots; replace or retire to make room', () => {
    let s = at(1, 0, { training: { charges: 3, nextChargeAt: 0, candidates: null } });
    s = launchTraining(s, calm, T0 + 1).state;
    const [first, second] = s.training.candidates!;
    expect(keepModel(s, calm, 9999, T0 + 2)).toMatchObject({ ok: false, reason: 'none' });
    s = keepModel(s, calm, first.uid, T0 + 2).state;
    expect(s.models.map((m) => m.uid)).toEqual([first.uid]);
    expect(s.training.candidates).toBeNull();
    expect(s.stats.modelsKept).toBe(1);
    s = launchTraining(s, calm, T0 + 3).state;
    const next = s.training.candidates![0];
    expect(keepModel(s, calm, next.uid, T0 + 4)).toMatchObject({ ok: false, reason: 'full' });
    const swapped = keepModel(s, calm, next.uid, T0 + 4, first.uid).state;
    expect(swapped.models.map((m) => m.uid)).toEqual([next.uid]);
    expect(scrapCandidates(s, calm, T0 + 4).state.training.candidates).toBeNull();
    expect(retireModel(swapped, calm, next.uid, T0 + 5).state.models).toEqual([]);
    expect(second.uid).not.toBe(first.uid);
  });
  it('kept models change production, taps, offline terms and ship Hype; drawbacks cost', () => {
    const plain = at(1, 0, { generators: { a: 5 }, genLifetime: 20_000 });
    const boosted = { ...plain, models: [model(50, [['tp', 0.2], ['tt', 0.5], ['toc', 2], ['th', 0.5]], ['di', 0.5])] };
    expect(totalRate(boosted, calm) / totalRate(plain, calm)).toBeCloseTo(1.2);
    expect(tapValue(boosted, calm, T0, 1) / tapValue(plain, calm, T0, 1)).toBeCloseTo(1.5);
    expect(offlineCapMs(boosted, calm) - offlineCapMs(plain, calm)).toBe(2 * 3_600_000);
    expect(prestigePreview(boosted, calm).gain).toBe(Math.floor(prestigePreview(plain, calm).gain * 1.5));
    expect(incidentFrequency(boosted, calm) / incidentFrequency(plain, calm)).toBeCloseTo(1.5);
    expect(modelEffects(boosted, calm).incident).toBe(0.5);
  });
  it('training-speed models and Research staff shorten the cooldown', () => {
    const s = at(2, 1, { models: [model(60, [['ts', 0.2]])], staff: { research: 8, product: 2, safety: 2 }, training: { charges: 0, nextChargeAt: 0, candidates: null } });
    expect(trainingStatus(s, calm).cooldownMs).toBeLessThan(120_000 / 1.2 / 1.3);
  });
});

describe('staff', () => {
  it('starts even and can only be split once the stage allows', () => {
    expect(evenStaff(12)).toEqual({ research: 4, product: 4, safety: 4 });
    expect(evenStaff(13)).toEqual({ research: 4, product: 5, safety: 4 });
    expect(setStaff(at(1), calm, { research: 6, product: 6, safety: 0 }, T0 + 1)).toMatchObject({ ok: false, reason: 'locked' });
    const s = at(2, 1);
    expect(setStaff(s, calm, { research: 6, product: 6, safety: 1 }, T0 + 1)).toMatchObject({ ok: false, reason: 'notApplicable' });
    expect(setStaff(s, calm, { research: 6.5, product: 5.5, safety: 0 }, T0 + 1).ok).toBe(false);
    const r = setStaff(s, calm, { research: 6, product: 6, safety: 0 }, T0 + 1);
    expect(r.ok).toBe(true);
    expect(moveStaff(r.state, calm, 'research', 'safety', T0 + 2).state.staff).toEqual({ research: 5, product: 6, safety: 1 });
    expect(moveStaff(r.state, calm, 'safety', 'product', T0 + 2).ok).toBe(false);
  });
  it('is neutral at a third each and before the stage', () => {
    const e = staffEffects(at(2, 1), calm);
    expect(e).toEqual({ production: 1, incidentFreq: 1, severity: 1, trust: 1, trainingSpeed: 1, luck: 0 });
    expect(staffEffects(at(1, 0, { staff: { research: 0, product: 12, safety: 0 } }), calm).production).toBe(1);
  });
  it('Product raises income; none starves it', () => {
    const base = at(2, 1, { generators: { a: 10 } });
    const allIn = { ...base, staff: { research: 0, product: 12, safety: 0 } };
    const none = { ...base, staff: { research: 6, product: 0, safety: 6 } };
    expect(totalRate(allIn, calm) / totalRate(base, calm)).toBeCloseTo(2);
    expect(totalRate(none, calm) / totalRate(base, calm)).toBeCloseTo(0.5);
  });
  it('ignoring Safety hurts: more and worse incidents, less trust on ship day', () => {
    const base = at(2, 1, { genLifetime: 200_000 });
    const reckless = { ...base, staff: { research: 6, product: 6, safety: 0 } };
    const careful = { ...base, staff: { research: 2, product: 2, safety: 8 } };
    expect(incidentFrequency(reckless, calm)).toBeCloseTo(1.45);
    expect(incidentFrequency(careful, calm)).toBeLessThan(0.6);
    expect(incidentSeverityMult(reckless, calm, 0.5)).toBeCloseTo(0.3);
    expect(incidentSeverityMult(careful, calm, 0.5)).toBeGreaterThan(0.6);
    expect(prestigePreview(reckless, calm).gain).toBeLessThan(prestigePreview(base, calm).gain);
    expect(prestigePreview(careful, calm).gain).toBeGreaterThan(prestigePreview(base, calm).gain);
  });
});

describe('ship day', () => {
  const ready = () => at(1, 0, { genLifetime: 40_000, tokens: 10 });
  it('the choice modifies the base formula, and plain shipping is unchanged', () => {
    const p = prestigePreview(ready(), calm);
    expect(p.baseGain).toBe(Math.floor(Math.pow(40_000 / 1000, 0.5)));
    expect(p.gain).toBe(p.baseGain);
    expect(p.choices.map((x) => x.id)).toEqual(['hype', 'safe', 'open']);
    expect(p.choices[0].gain).toBe(Math.floor(p.baseGain * 1.5));
    const plain = prestige(ready(), calm, T0 + 1).state;
    expect(plain.hype).toBe(p.baseGain);
    expect(plain.shipChoice).toBeNull();
  });
  it('hype it: more Hype now, more incidents through the next generation', () => {
    const s = prestige(ready(), calm, T0 + 1, { choice: 'hype' }).state;
    expect(s.hype).toBe(Math.floor(6 * 1.5));
    expect(s.shipChoice).toBe('hype');
    expect(s.lastShip?.choice).toBe('hype');
    expect(incidentFrequency(s, calm)).toBeCloseTo(2);
    // The risk lasts one generation.
    const after = prestige({ ...s, genLifetime: 200_000 }, calm, T0 + 2, { choice: 'safe' }).state;
    expect(incidentFrequency(after, calm)).toBeCloseTo(0.5);
  });
  it('open the weights: less Hype, extra training runs past the cap and Lab Rep', () => {
    const s0 = { ...ready(), training: { charges: 3, nextChargeAt: 0, candidates: null } };
    const s = prestige(s0, calm, T0 + 1, { choice: 'open' }).state;
    expect(s.training.charges).toBe(5);
    expect(s.labRep).toBe(2);
    expect(prestige(ready(), calm, T0 + 1, { choice: 'nope' })).toMatchObject({ ok: false, reason: 'unknownId' });
  });
  it('the ad bonus stacks with the choice', () => {
    const r = prestige(ready(), calm, T0 + 1, { choice: 'hype', bonus: true });
    expect(r.ok).toBe(true);
    expect(r.state.hype).toBe(Math.ceil(6 * 1.5 * 1.25));
  });
  it('the reveal ranks the model on a parody leaderboard, deterministically', () => {
    const r = shipReveal(ready(), calm)!;
    expect(r).toEqual(shipReveal(ready(), calm));
    expect(r.rows).toHaveLength(3);
    expect(r.rows.filter((x) => x.you)).toHaveLength(1);
    expect(r.rank).toBe(3);
    expect(r.rivalKey).toBe('rv.1');
    const late = shipReveal({ ...ready(), generation: 8, genLifetime: 1e12 }, calm)!;
    expect(late.rank).toBe(1);
    expect(late.rows[0].you).toBe(true);
    expect(late.benchmarkKey).toBe('be.1');
  });
});

describe('lab happenings', () => {
  it('appear every 20 to 40 seconds while the lab is open and expire on their own', () => {
    let s = createGarage({ ...c, golden: { ...c.golden, firstAfterMs: 1e15 }, incidents: { ...c.incidents, firstAfterMs: 1e15 } }, T0, 9);
    const content = { ...c, golden: { ...c.golden, firstAfterMs: 1e15 }, incidents: { ...c.incidents, firstAfterMs: 1e15 } };
    const spawns: number[] = [];
    let last = 0;
    for (let t = 1000; t <= 600_000; t += 1000) {
      s = advance(s, content, T0 + t);
      if (s.happening && s.happening.uid !== last) {
        last = s.happening.uid;
        spawns.push(s.happening.spawnedAt - T0);
        expect(s.happening.expiresAt - s.happening.spawnedAt).toBe(9000);
      }
    }
    expect(spawns[0]).toBe(20_000);
    for (let i = 1; i < spawns.length; i++) {
      expect(spawns[i] - spawns[i - 1]).toBeGreaterThanOrEqual(29_000);
      expect(spawns[i] - spawns[i - 1]).toBeLessThanOrEqual(49_000);
    }
    expect(spawns.length).toBeGreaterThanOrEqual(12);
    expect(s.stats.happeningsMissed).toBeGreaterThanOrEqual(spawns.length - 1);
  });
  it('tapping one pays a few seconds of production (at least some taps\' worth)', () => {
    const s = at(0, 0, { generators: { b: 10 }, happening: { uid: 7, id: 'pizza', spawnedAt: T0, expiresAt: T0 + 9000, x: 0.5, y: 0.5 } });
    const r = collectHappening(s, calm, T0 + 10);
    expect(r.ok).toBe(true);
    expect(r.gained).toBeCloseTo(totalRate(s, calm) * 15, 3);
    expect(r.state.happening).toBeNull();
    expect(r.state.stats.happeningsCaught).toBe(1);
    expect(collectHappening(r.state, calm, T0 + 20)).toMatchObject({ ok: false, reason: 'none' });
    const poor = at(0, 0, { happening: { uid: 7, id: 'pizza', spawnedAt: T0, expiresAt: T0 + 9000, x: 0.5, y: 0.5 } });
    expect(collectHappening(poor, calm, T0 + 10).gained).toBeCloseTo(10 * tapValue(poor, calm, T0, 1));
  });
  it('missing one costs a little, never more than a small share of the tokens in hand', () => {
    const s = at(0, 0, { tokens: 1000, generators: { b: 50 }, happening: { uid: 7, id: 'fire', spawnedAt: T0, expiresAt: T0 + 9000, x: 0.5, y: 0.5 } });
    const def = calm.happenings!.defs[1];
    expect(happeningPenalty(s, calm, def)).toBe(50);
    expect(happeningQuote(s, calm).penalty).toBe(50);
    const after = advance(s, calm, T0 + 9000);
    expect(after.happening).toBeNull();
    expect(after.stats.happeningsMissed).toBe(1);
    expect(after.news.some((n) => n.key === 'hp.f.m')).toBe(true);
    // 1000 in hand + 9 s of production, minus at most 5 %.
    expect(after.tokens).toBeGreaterThanOrEqual((1000 + totalRate(s, calm) * 9) * 0.95 - 1e-6);
  });
  it('the intern\'s question brings the next training run closer', () => {
    const s = at(1, 0, { training: { charges: 0, nextChargeAt: T0 + 100_000, candidates: null }, happening: { uid: 7, id: 'intern', spawnedAt: T0, expiresAt: T0 + 9000, x: 0.5, y: 0.5 } });
    expect(collectHappening(s, calm, T0 + 1).state.training.nextChargeAt).toBe(T0 + 70_000);
  });
  it('helpers in the automation stage handle a missed one for a share of the reward', () => {
    const s = at(3, 2, { tokens: 1000, generators: { b: 10 }, happening: { uid: 7, id: 'fire', spawnedAt: T0, expiresAt: T0 + 9000, x: 0.5, y: 0.5 } });
    const reward = happeningReward({ ...s, now: T0 + 9000 }, calm, calm.happenings!.defs[1]);
    const after = advance(s, calm, T0 + 9000);
    expect(after.stats.happeningsCaught).toBe(1);
    expect(after.tokens).toBeCloseTo(1000 + totalRate(s, calm) * 9 + reward * 0.5, 3);
  });
  it('are cleared while away (nobody is there to tap them)', () => {
    const s = at(0, 0, { happening: { uid: 7, id: 'fire', spawnedAt: T0, expiresAt: T0 + 9000, x: 0.5, y: 0.5 } });
    const away = advance(s, calm, T0 + 3_600_000);
    expect(away.happening).toBeNull();
  });
});

describe('auto-buy', () => {
  it('is locked until its stage, then buys the best value within budget while the lab is open', () => {
    expect(setAutoBuy(at(3, 2), calm, true, T0 + 1).ok).toBe(false);
    const s0 = at(4, 3, { tokens: 10_000 });
    expect(autoBuyPick(s0, calm)).toBe('a');
    let s = setAutoBuy(s0, calm, true, T0).state;
    s = advance(s, calm, T0 + 40_000);
    expect(s.stats.autoBought).toBe(10);
    const owned = (s.generators.a ?? 0) + (s.generators.b ?? 0) + (s.generators.c ?? 0);
    expect(owned).toBe(10);
    // Off: nothing more.
    const off = setAutoBuy(s, calm, false, T0 + 40_000).state;
    expect(advance(off, calm, T0 + 50_000).stats.autoBought).toBe(10);
  });
});

describe('time with the lab layer', () => {
  it('one 59-second step equals 59 one-second steps, happenings and training included', () => {
    const start = at(1, 0, { generators: { a: 12, b: 3 }, training: { charges: 0, nextChargeAt: T0 + 30_000, candidates: null }, nextHappeningAt: T0 + 5000 });
    const big = advance(start, c, T0 + 59_000);
    let small = start;
    for (let i = 1; i <= 59; i++) small = advance(small, c, T0 + i * 1000);
    expect(small.tokens).toBeCloseTo(big.tokens, 6);
    expect(small.rng).toBe(big.rng);
    expect(small.happening).toEqual(big.happening);
    expect(small.training).toEqual(big.training);
  });
  it('a clock that goes backwards keeps the training and happening timers\' remaining time', () => {
    const s = at(1, 0, { now: T0, training: { charges: 0, nextChargeAt: T0 + 60_000, candidates: null }, happening: { uid: 3, id: 'pizza', spawnedAt: T0, expiresAt: T0 + 9000, x: 0.5, y: 0.5 }, nextHappeningAt: T0 + 30_000 });
    const back = advance(s, calm, T0 - 10_000);
    expect(back.training.nextChargeAt).toBe(T0 + 50_000);
    expect(back.happening?.expiresAt).toBe(T0 - 1000);
    expect(back.nextHappeningAt).toBe(T0 + 20_000);
  });
});

describe('saves with the lab layer', () => {
  it('round-trip stage, training, models, staff and the launch choice', () => {
    let s = at(2, 1, { training: { charges: 2, nextChargeAt: T0 + 5000, candidates: null }, staff: { research: 6, product: 4, safety: 2 }, shipChoice: 'hype' });
    s = launchTraining(s, calm, T0 + 1).state;
    s = keepModel(s, calm, s.training.candidates![1].uid, T0 + 2).state;
    s = launchTraining(s, calm, T0 + 3).state;
    const back = deserialize(serialize(s), calm, T0 + 10);
    expect(back.error).toBeUndefined();
    expect(back.state).toEqual({ ...s, combo: { count: 0, lastAt: 0 } });
  });
  it('migrates a version 2 save into a sensible lab state', () => {
    const v2State = {
      version: 2,
      rng: 77,
      createdAt: T0 - 86_400_000,
      now: T0 - 1000,
      tokens: 5e4,
      genLifetime: 6e4,
      generators: { a: 30, b: 12, c: 2 },
      upgrades: ['a2', 'off'],
      generation: 2,
      hype: 40,
      labRep: 2,
      combo: { count: 0, lastAt: 0 },
      frenzy: null,
      boostUntil: 0,
      golden: null,
      nextGoldenAt: T0 + 1000,
      incident: null,
      nextIncidentAt: T0 + 1000,
      nextHeadlineAt: T0,
      news: [],
      offers: { offlineDouble: [], boost: [T0 - 5000], frenzyExtend: [], incidentFix: [], crate: [], prestigeBonus: [] },
      offline: null,
      achievements: ['tap1'],
      stats: { taps: 900, tokensAllTime: 9e5, modelsShipped: 2 },
      lastShip: { generation: 2, hypeGained: 30, at: T0 - 3_600_000 },
      uidSeq: 40,
    };
    const r = deserialize(JSON.stringify({ v: 2, state: v2State }), c, T0);
    expect(r.error).toBeUndefined();
    expect(r.migratedFrom).toBe(2);
    expect(r.state.version).toBe(GARAGE_VERSION);
    // Progress kept.
    expect(r.state.generators).toEqual({ a: 30, b: 12, c: 2 });
    expect(r.state.hype).toBe(40);
    expect(r.state.offers.boost).toEqual([T0 - 5000]);
    // The lab layer fills in from that progress: generation 2 is the automation stage.
    expect(r.state.stage).toBe(3);
    expect(r.state.training).toEqual({ charges: 1, nextChargeAt: T0 - 1000 + 120_000, candidates: null });
    expect(r.state.models).toEqual([]);
    expect(r.state.staff).toEqual({ research: 4, product: 4, safety: 4 });
    expect(r.state.shipChoice).toBeNull();
    expect(r.state.autoBuy).toBe(false);
    expect(r.state.happening).toBeNull();
    expect(r.state.stats.happeningsCaught).toBe(0);
    // And plays on.
    const next = advance(r.state, c, T0 + 30_000);
    expect(Number.isFinite(next.tokens)).toBe(true);
    expect(launchTraining(next, c, T0 + 31_000).ok).toBe(true);
  });
  it('a fresh-ish version 2 save stays in the first stage with no training', () => {
    const r = deserialize(JSON.stringify({ v: 2, state: { version: 2, tokens: 10, genLifetime: 10, generation: 0, now: T0, stats: { tokensAllTime: 10 } } }), c, T0);
    expect(r.state.stage).toBe(0);
    expect(r.state.training.charges).toBe(0);
  });
  it('repairs broken lab fields', () => {
    const s = at(1, 0);
    const raw = JSON.parse(serialize(s));
    raw.state.models = [{ rarity: 'nope', boons: [] }, { uid: 3, rarity: 'r0', boons: [{ trait: 'tp', value: 0.1 }, { trait: 'zzz', value: 1 }] }, { uid: 4, rarity: 'r1', boons: [{ trait: 'tt', value: NaN }] }];
    raw.state.staff = { research: 50, product: -1, safety: 'x' };
    raw.state.stage = 99;
    raw.state.shipChoice = 'bogus';
    raw.state.happening = { id: 'unknown' };
    const r = deserialize(JSON.stringify(raw), calm, T0);
    expect(r.state.models).toEqual([{ uid: 3, prefix: 0, suffix: 0, version: 1, rarity: 'r0', desc: 0, boons: [{ trait: 'tp', value: 0.1 }] }]);
    expect(r.state.staff).toEqual(evenStaff(12));
    expect(r.state.stage).toBe(4);
    expect(r.state.shipChoice).toBeNull();
    expect(r.state.happening).toBeNull();
    expect(r.state.uidSeq).toBeGreaterThan(3);
  });
});

describe('lab property check', () => {
  it('random play with every lab action at random times keeps every number sane', () => {
    let seed = 4242;
    const rnd = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) | 0;
      return ((seed >>> 0) % 1_000_000) / 1_000_000;
    };
    const lanes = ['research', 'product', 'safety'] as const;
    for (let game = 0; game < 8; game++) {
      let s: GarageState = { ...createGarage(c, T0, game + 1), tokens: 1e6 };
      let now = T0;
      for (let step = 0; step < 300; step++) {
        const roll = rnd();
        now += roll < 0.04 ? -rnd() * 3_600_000 : roll < 0.08 ? rnd() * 20 * 3_600_000 : rnd() * 4000;
        const pick = Math.floor(rnd() * 12);
        if (pick < 3) s = tap(s, c, now).state;
        else if (pick === 3) s = buy(s, c, c.generators[Math.floor(rnd() * 3)].id, 1 + Math.floor(rnd() * 5), now).state;
        else if (pick === 4) s = launchTraining(s, c, now).state;
        else if (pick === 5 && s.training.candidates) s = keepModel(s, c, s.training.candidates[Math.floor(rnd() * s.training.candidates.length)].uid, now, s.models[0]?.uid).state;
        else if (pick === 6) s = moveStaff(s, c, lanes[Math.floor(rnd() * 3)], lanes[Math.floor(rnd() * 3)], now).state;
        else if (pick === 7) s = collectHappening(s, c, now).state;
        else if (pick === 8) s = setAutoBuy(s, c, rnd() < 0.7, now).state;
        else if (pick === 9) s = prestige({ ...advance(s, c, now), genLifetime: Math.max(s.genLifetime, 1e6 * (s.generation + 1) ** 2) }, c, now, { choice: ['hype', 'safe', 'open'][Math.floor(rnd() * 3)] }).state;
        else s = advance(s, c, now);
        const nums: [string, number][] = [
          ['tokens', s.tokens],
          ['rate', totalRate(s, c, s.now)],
          ['tap', tapValue(s, c, s.now)],
          ['freq', incidentFrequency(s, c)],
          ['charges', s.training.charges],
          ...Object.entries(s.stats),
          ...Object.entries(s.staff),
        ];
        for (const [name, v] of nums) expect([name, Number.isFinite(v) && v >= 0]).toEqual([name, true]);
        expect(s.models.length).toBeLessThanOrEqual(modelSlots(s, c));
        expect(s.staff.research + s.staff.product + s.staff.safety).toBe(12);
      }
      const back = deserialize(serialize(s), c, now).state;
      expect(back).toEqual({ ...s, combo: { count: 0, lastAt: 0 } });
    }
  });
});
