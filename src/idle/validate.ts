/**
 * Checks a garage content pack: unique ids, references that resolve, numbers in range,
 * and a string for every text key. Returns a list of problems (empty = valid).
 */
import { MODEL_STATS, OFFER_IDS, STAFF_LANES, type GarageContent, type Requirement, type TraitDef, type UpgradeEffect } from './types';

export function validateGarage(c: GarageContent): string[] {
  const problems: string[] = [];
  const err = (m: string) => problems.push(m);
  const pos = (v: number, what: string) => {
    if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) err(`${what} must be a positive number (got ${v})`);
  };
  const nonNeg = (v: number, what: string) => {
    if (!(typeof v === 'number' && Number.isFinite(v) && v >= 0)) err(`${what} must be a non-negative number (got ${v})`);
  };
  const keys = new Set<string>();
  const key = (k: string, what: string) => {
    keys.add(k);
    if (typeof c.strings[k] !== 'string' || !c.strings[k].trim()) err(`${what}: missing string "${k}"`);
  };
  const unique = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(`${what}: duplicate id "${id}"`);
      seen.add(id);
    }
  };
  const genIds = new Set(c.generators.map((g) => g.id));
  const upIds = new Set(c.upgrades.map((u) => u.id));

  unique(c.generators.map((g) => g.id), 'generators');
  let prevCost = 0;
  for (const g of c.generators) {
    pos(g.baseCost, `generator ${g.id} baseCost`);
    pos(g.baseRate, `generator ${g.id} baseRate`);
    if (!(g.costGrowth > 1 && g.costGrowth < 3)) err(`generator ${g.id} costGrowth must be in (1, 3)`);
    nonNeg(g.unlockGeneration, `generator ${g.id} unlockGeneration`);
    if (g.baseCost <= prevCost) err(`generator ${g.id} must cost more than the tier before it`);
    prevCost = g.baseCost;
    key(g.nameKey, `generator ${g.id}`);
    key(g.descKey, `generator ${g.id}`);
  }
  if (!c.generators.some((g) => g.unlockGeneration === 0)) err('at least one generator must be available at generation 0');

  const effect = (e: UpgradeEffect, what: string) => {
    if (e.kind === 'generatorMult' && !genIds.has(e.generator)) err(`${what}: unknown generator "${e.generator}"`);
    const v = 'mult' in e ? e.mult : 'share' in e ? e.share : 'hours' in e ? e.hours : e.add;
    pos(v, `${what} ${e.kind}`);
  };
  const requirement = (r: Requirement, what: string) => {
    if (r.type === 'owned' && !genIds.has(r.generator)) err(`${what}: unknown generator "${r.generator}"`);
    if (r.type === 'upgrade' && !upIds.has(r.id)) err(`${what}: unknown upgrade "${r.id}"`);
  };
  unique(c.upgrades.map((u) => u.id), 'upgrades');
  for (const u of c.upgrades) {
    pos(u.cost, `upgrade ${u.id} cost`);
    if (u.effects.length === 0) err(`upgrade ${u.id} has no effect`);
    u.effects.forEach((e) => effect(e, `upgrade ${u.id}`));
    u.requires.forEach((r) => requirement(r, `upgrade ${u.id}`));
    key(u.nameKey, `upgrade ${u.id}`);
    key(u.descKey, `upgrade ${u.id}`);
  }

  if (c.generations.length < 2) err('at least two generations');
  unique(c.generations.map((g) => g.id), 'generations');
  c.generations.forEach((g, i) => {
    if (i === 0 && g.shipAt !== 0) err('generation 0 shipAt must be 0');
    if (i > 0 && !(g.shipAt > c.generations[i - 1].shipAt)) err(`generation ${g.id} shipAt must rise`);
    g.perks.forEach((e) => effect(e, `generation ${g.id}`));
    key(g.nameKey, `generation ${g.id}`);
    key(g.headlineKey, `generation ${g.id}`);
    key(g.unlockKey, `generation ${g.id}`);
  });
  key(c.endlessNameKey, 'endless generation');
  key(c.endlessHeadlineKey, 'endless generation');
  if (c.generations[1] && c.prestige.scale > c.generations[1].shipAt) err('prestige.scale must not exceed the first ship threshold (the first ship would give no Hype)');
  pos(c.prestige.scale, 'prestige.scale');
  if (!(c.prestige.exponent > 0 && c.prestige.exponent <= 1)) err('prestige.exponent must be in (0, 1]');
  pos(c.prestige.hypePerPoint, 'prestige.hypePerPoint');
  if (!(c.prestige.endlessGrowth > 1)) err('prestige.endlessGrowth must exceed 1');

  pos(c.tap.base, 'tap.base');
  pos(c.tap.comboWindowMs, 'tap.comboWindowMs');
  pos(c.tap.comboStep, 'tap.comboStep');
  nonNeg(c.tap.comboMaxStacks, 'tap.comboMaxStacks');
  nonNeg(c.tap.comboStackBonus, 'tap.comboStackBonus');

  const g = c.golden;
  pos(g.lifetimeMs, 'golden.lifetimeMs');
  if (!(g.intervalMinMs > 0 && g.intervalMaxMs >= g.intervalMinMs)) err('golden interval must be positive and min <= max');
  unique(g.defs.map((d) => d.id), 'golden');
  for (const d of g.defs) {
    pos(d.weight, `golden ${d.id} weight`);
    const r = d.reward;
    if (r.kind === 'burst') {
      pos(r.seconds, `golden ${d.id} seconds`);
      nonNeg(r.minTaps, `golden ${d.id} minTaps`);
    } else {
      pos(r.mult, `golden ${d.id} mult`);
      pos(r.seconds, `golden ${d.id} seconds`);
    }
    key(d.textKey, `golden ${d.id}`);
    key(d.labelKey, `golden ${d.id}`);
  }

  const inc = c.incidents;
  if (!(inc.intervalMinMs > 0 && inc.intervalMaxMs >= inc.intervalMinMs)) err('incident interval must be positive and min <= max');
  unique(inc.defs.map((d) => d.id), 'incidents');
  for (const d of inc.defs) {
    if (!(d.mult > 0 && d.mult < 1)) err(`incident ${d.id} mult must be in (0, 1)`);
    pos(d.durationMs, `incident ${d.id} durationMs`);
    pos(d.tapsToFix, `incident ${d.id} tapsToFix`);
    pos(d.weight, `incident ${d.id} weight`);
    key(d.textKey, `incident ${d.id}`);
    key(d.fixKey, `incident ${d.id}`);
  }

  const o = c.offline;
  if (!(o.rate > 0 && o.rate <= 1)) err('offline.rate must be in (0, 1]');
  pos(o.capHours, 'offline.capHours');
  pos(o.thresholdMs, 'offline.thresholdMs');

  for (const id of OFFER_IDS) {
    const def = c.offers.find((x) => x.id === id);
    if (!def) {
      err(`offer ${id} is missing`);
      continue;
    }
    nonNeg(def.cooldownMs, `offer ${id} cooldownMs`);
    if (!(Number.isInteger(def.dailyCap) && def.dailyCap >= 1)) err(`offer ${id} dailyCap must be a positive integer`);
  }
  const need = (id: (typeof OFFER_IDS)[number], field: string) => {
    const def = c.offers.find((x) => x.id === id) as Record<string, unknown> | undefined;
    if (def) pos(def[field] as number, `offer ${id} ${field}`);
  };
  need('offlineDouble', 'offlineMult');
  need('boost', 'boostMult');
  need('boost', 'boostMs');
  need('boost', 'boostCapMs');
  need('frenzyExtend', 'extendMs');
  need('crate', 'crateSeconds');
  need('prestigeBonus', 'prestigeBonus');
  need('bonusMultiply', 'multiplyWindowMs');
  const bm = c.offers.find((x) => x.id === 'bonusMultiply');
  if (bm) {
    if (!((bm.multiplyMult ?? 0) > 1)) err('offer bonusMultiply multiplyMult must exceed 1');
    if (!((bm.multiplyChance ?? -1) >= 0 && (bm.multiplyChance ?? 2) <= 1)) err('offer bonusMultiply multiplyChance must be in [0, 1]');
    nonNeg(bm.multiplyAfterMs ?? -1, 'offer bonusMultiply multiplyAfterMs');
  }

  unique(c.achievements.map((a) => a.id), 'achievements');
  for (const a of c.achievements) {
    if ((a.rule.type === 'owned') && !genIds.has(a.rule.generator)) err(`achievement ${a.id}: unknown generator`);
    key(a.nameKey, `achievement ${a.id}`);
    key(a.descKey, `achievement ${a.id}`);
  }

  unique(c.labRep.perks.map((p) => p.id), 'lab perks');
  for (const p of c.labRep.perks) {
    pos(p.rep, `lab perk ${p.id} rep`);
    pos(p.effect.amount, `lab perk ${p.id} amount`);
    key(p.textKey, `lab perk ${p.id}`);
  }

  if (c.news.headlines.length < 5) err('at least five headlines');
  for (const h of c.news.headlines) key(h.key, 'headline');
  key(c.news.achievementKey, 'news');
  pos(c.news.keep, 'news.keep');
  validateLab(c, { err, pos, nonNeg, key, unique, requirement });
  return problems;
}

interface Checks {
  err(m: string): void;
  pos(v: number, what: string): void;
  nonNeg(v: number, what: string): void;
  key(k: string, what: string): void;
  unique(ids: string[], what: string): void;
  requirement(r: Requirement, what: string): void;
}

/** The lab layer: stages, milestones, training, staff, ship day, happenings, automation. */
function validateLab(c: GarageContent, { err, pos, nonNeg, key, unique, requirement }: Checks): void {
  const stages = c.stages ?? [];
  unique(stages.map((s) => s.id), 'stages');
  stages.forEach((s, i) => {
    key(s.nameKey, `stage ${s.id}`);
    key(s.descKey, `stage ${s.id}`);
    key(s.unlockKey, `stage ${s.id}`);
    if (i === 0 && s.requires.length > 0) err('the first stage must have no requirements');
    if (i > 0 && s.requires.length === 0) err(`stage ${s.id} needs a requirement`);
    s.requires.forEach((r) => requirement(r, `stage ${s.id}`));
    if (s.requires.some((r) => r.type === 'owned' || r.type === 'lifetime' || r.type === 'upgrade')) err(`stage ${s.id}: use requirements that never reset (allTime, generation, taps)`);
    nonNeg(s.modelSlots, `stage ${s.id} modelSlots`);
    if (i > 0 && s.modelSlots < stages[i - 1].modelSlots) err(`stage ${s.id} modelSlots must not shrink`);
  });
  const mech = (m: string) => stages.some((s) => s.mechanic === m);
  if (c.training && !mech('training')) err('training needs a stage that switches it on');
  if (c.staff && !mech('staff')) err('staff needs a stage that switches it on');
  if (mech('training') && !c.training) err('a stage switches training on but there is no training config');
  if (mech('staff') && !c.staff) err('a stage switches staff on but there is no staff config');
  if ((mech('autoCollect') || mech('autoBuy')) && !c.automation) err('an automation stage needs an automation config');
  const trainingStage = stages.findIndex((s) => s.mechanic === 'training');
  if (trainingStage >= 0 && !(stages[trainingStage].modelSlots >= 1)) err('the training stage must give at least one model slot');

  const m = c.milestones;
  if (m) {
    if (m.steps.length === 0) err('milestones need steps');
    m.steps.forEach((s, i) => {
      pos(s.count, `milestone ${i} count`);
      if (!(s.mult >= 1)) err(`milestone ${i} mult must be at least 1`);
      if (i > 0 && !(s.count > m.steps[i - 1].count)) err('milestone counts must rise');
    });
    nonNeg(m.repeatEvery, 'milestones.repeatEvery');
    if (!(m.repeatMult >= 1)) err('milestones.repeatMult must be at least 1');
  }

  const t = c.training;
  if (t) {
    pos(t.cooldownMs, 'training.cooldownMs');
    if (!(Number.isInteger(t.queueMax) && t.queueMax >= 1)) err('training.queueMax must be a positive integer');
    if (!(Number.isInteger(t.candidates) && t.candidates >= 2)) err('training.candidates must be at least 2');
    if (t.rarities.length < 2) err('training needs at least two rarities');
    unique(t.rarities.map((r) => r.id), 'rarities');
    for (const r of t.rarities) {
      key(r.nameKey, `rarity ${r.id}`);
      pos(r.weight, `rarity ${r.id} weight`);
      if (!(Number.isInteger(r.boons) && r.boons >= 1)) err(`rarity ${r.id} boons must be a positive integer`);
      pos(r.power, `rarity ${r.id} power`);
      if (!(r.drawbackChance >= 0 && r.drawbackChance <= 1)) err(`rarity ${r.id} drawbackChance must be in [0, 1]`);
      nonNeg(r.luck, `rarity ${r.id} luck`);
    }
    unique([...t.traits, ...t.drawbacks].map((x) => x.id), 'traits');
    const trait = (x: TraitDef, what: string) => {
      if (!MODEL_STATS.includes(x.stat)) err(`${what} ${x.id}: unknown stat "${x.stat}"`);
      if (!(Number.isFinite(x.min) && Number.isFinite(x.max) && x.min <= x.max)) err(`${what} ${x.id}: min must not exceed max`);
      pos(x.weight, `${what} ${x.id} weight`);
      key(x.labelKey, `${what} ${x.id}`);
    };
    t.traits.forEach((x) => trait(x, 'trait'));
    t.drawbacks.forEach((x) => trait(x, 'drawback'));
    const leads = new Set(t.traits.map((x) => x.stat));
    if (leads.size < t.candidates) err('training needs at least as many trait stats as candidates (so each can lead with a different one)');
    const maxBoons = Math.max(...t.rarities.map((r) => r.boons));
    if (leads.size < maxBoons) err('a rarity rolls more strengths than there are trait stats');
    if (t.prefixKeys.length < 4 || t.suffixKeys.length < 4) err('training needs at least four name prefixes and suffixes');
    t.prefixKeys.forEach((k) => key(k, 'model name prefix'));
    t.suffixKeys.forEach((k) => key(k, 'model name suffix'));
    for (const stat of leads) {
      const list = t.descKeys[stat] ?? [];
      if (list.length === 0) err(`training has no description for models led by ${stat}`);
      list.forEach((k) => key(k, `model description (${stat})`));
    }
  }

  const st = c.staff;
  if (st) {
    if (!(Number.isInteger(st.total) && st.total >= 3)) err('staff.total must be an integer of at least 3');
    for (const f of ['productSwing', 'safetySwing', 'severitySwing', 'trustSwing', 'researchSwing'] as const) {
      pos(st[f], `staff.${f}`);
      if (st[f] > 1) err(`staff.${f} must not exceed 1`);
    }
    if (STAFF_LANES.length !== 3) err('three staff lanes');
  }

  const sd = c.shipDay;
  if (sd) {
    if (sd.choices.length < 2) err('ship day needs at least two choices');
    unique(sd.choices.map((x) => x.id), 'ship choices');
    for (const ch of sd.choices) {
      key(ch.labelKey, `ship choice ${ch.id}`);
      key(ch.descKey, `ship choice ${ch.id}`);
      pos(ch.hypeMult, `ship choice ${ch.id} hypeMult`);
      pos(ch.incidentMult, `ship choice ${ch.id} incidentMult`);
      if (ch.trainingRuns !== undefined) nonNeg(ch.trainingRuns, `ship choice ${ch.id} trainingRuns`);
      if (ch.labRep !== undefined) nonNeg(ch.labRep, `ship choice ${ch.id} labRep`);
    }
    if (sd.rivals.length < 2) err('ship day needs at least two rivals');
    unique(sd.rivals.map((x) => x.id), 'ship rivals');
    for (const r of sd.rivals) {
      key(r.nameKey, `ship rival ${r.id}`);
      nonNeg(r.base, `ship rival ${r.id} base`);
      nonNeg(r.growth, `ship rival ${r.id} growth`);
    }
    if (sd.reactionKeys.length === 0 || sd.benchmarkKeys.length === 0) err('ship day needs reactions and benchmarks');
    sd.reactionKeys.forEach((k) => key(k, 'ship reaction'));
    sd.benchmarkKeys.forEach((k) => key(k, 'ship benchmark'));
    nonNeg(sd.scoreBase, 'shipDay.scoreBase');
    nonNeg(sd.scorePerGeneration, 'shipDay.scorePerGeneration');
    nonNeg(sd.scorePerHype, 'shipDay.scorePerHype');
  }

  const h = c.happenings;
  if (h) {
    pos(h.lifetimeMs, 'happenings.lifetimeMs');
    if (!(h.intervalMinMs > 0 && h.intervalMaxMs >= h.intervalMinMs)) err('happening interval must be positive and min <= max');
    if (!(h.penaltyCapShare >= 0 && h.penaltyCapShare <= 0.25)) err('happenings.penaltyCapShare must be in [0, 0.25] (never harsh)');
    unique(h.defs.map((d) => d.id), 'happenings');
    if (!h.defs.some((d) => (d.minStage ?? 0) === 0)) err('at least one happening must appear from the first stage');
    for (const d of h.defs) {
      key(d.labelKey, `happening ${d.id}`);
      key(d.textKey, `happening ${d.id}`);
      if (d.missKey) key(d.missKey, `happening ${d.id}`);
      if (d.penaltySeconds && !d.missKey) err(`happening ${d.id}: a penalty needs a missKey line`);
      pos(d.weight, `happening ${d.id} weight`);
      pos(d.rewardSeconds, `happening ${d.id} rewardSeconds`);
      nonNeg(d.rewardMinTaps, `happening ${d.id} rewardMinTaps`);
      if (d.penaltySeconds !== undefined) nonNeg(d.penaltySeconds, `happening ${d.id} penaltySeconds`);
      if (d.trainingMs !== undefined) nonNeg(d.trainingMs, `happening ${d.id} trainingMs`);
      if (d.minStage !== undefined && !(d.minStage >= 0 && d.minStage < Math.max(1, stages.length))) err(`happening ${d.id} minStage out of range`);
    }
  }

  const a = c.automation;
  if (a) {
    if (!(a.collectShare > 0 && a.collectShare <= 1)) err('automation.collectShare must be in (0, 1]');
    pos(a.buyIntervalMs, 'automation.buyIntervalMs');
    if (!(a.buyBudgetShare > 0 && a.buyBudgetShare <= 1)) err('automation.buyBudgetShare must be in (0, 1]');
  }
}
