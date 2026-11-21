/**
 * Checks a garage content pack: unique ids, references that resolve, numbers in range,
 * and a string for every text key. Returns a list of problems (empty = valid).
 */
import { OFFER_IDS, type GarageContent, type Requirement, type UpgradeEffect } from './types';

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
  return problems;
}
