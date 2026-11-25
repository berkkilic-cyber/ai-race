/**
 * The lab layer's rules that run inside time: stages moving in, training runs coming
 * ready, lab happenings appearing and expiring, and the auto-buy helper. All of them work
 * on a private copy of the state (see garage.ts) and draw from the save's seeded PRNG.
 */
import { between, grant, pickWeighted, pushNews, random } from './core';
import { factor, mechanicOn, modelEffects, staffEffects } from './labRates';
import { amount } from './num';
import { paradigmEffects } from './paradigmRates';
import { bulkCost, generatorDef, multipliers, tapValue, totalRate, trainingSpeed, unitCost, withoutRaceBoost } from './rates';
import type { GarageContent, GarageState, HappeningDef, ModelCandidate, ModelStat, Requirement, StaffSplit, TraitDef } from './types';
import { STAFF_LANES } from './types';

/** The training queue's size after the Paradigm tree. */
export function queueMax(state: Pick<GarageState, 'paradigm'>, content: GarageContent): number {
  return (content.training?.queueMax ?? 0) + paradigmEffects(state, content).trainingQueue;
}

/**
 * A stage requirement as it applies to this save: after a first Paradigm Shift, the
 * generation a stage needs is eased (paradigm.stageEase, rounded up, at least 1).
 */
export function stageRequirement(state: Pick<GarageState, 'paradigm'>, content: GarageContent, req: Requirement): Requirement {
  const ease = content.paradigm?.stageEase;
  if (req.type !== 'generation' || !ease || !(state.paradigm && state.paradigm.count > 0)) return req;
  return { type: 'generation', min: Math.max(1, Math.ceil(req.min * ease)) };
}

/** A requirement against the save (stages use the all-time and generation kinds). */
export function labRequirementMet(state: GarageState, req: Requirement): boolean {
  switch (req.type) {
    case 'owned':
      return (state.generators[req.generator] ?? 0) >= req.count;
    case 'lifetime':
      return state.genLifetime >= req.tokens;
    case 'generation':
      return state.generation >= req.min;
    case 'taps':
      return state.stats.taps >= req.count;
    case 'upgrade':
      return state.upgrades.includes(req.id);
    case 'allTime':
      return state.stats.tokensAllTime >= req.tokens;
  }
}

/** Even split of the headcount (any remainder goes to Product, then Research). */
export function evenStaff(total: number): StaffSplit {
  const n = Math.max(0, Math.floor(total));
  const third = Math.floor(n / 3);
  const rest = n - third * 3;
  return { research: third + (rest >= 2 ? 1 : 0), product: third + (rest >= 1 ? 1 : 0), safety: third };
}

/** The real time one training run takes to come ready now. */
export function trainingCooldownMs(state: GarageState, content: GarageContent): number {
  const cfg = content.training;
  if (!cfg) return Infinity;
  return Math.max(1000, cfg.cooldownMs / trainingSpeed(state, content));
}

/** Fills the training queue up to time `t`. */
export function accrueTraining(s: GarageState, content: GarageContent, t: number): void {
  const cfg = content.training;
  if (!cfg || !mechanicOn(s, content, 'training')) return;
  const tr = s.training;
  const max = queueMax(s, content);
  if (tr.charges >= max) {
    tr.nextChargeAt = 0;
    return;
  }
  const cd = trainingCooldownMs(s, content);
  if (!(tr.nextChargeAt > 0)) tr.nextChargeAt = t + cd;
  if (t < tr.nextChargeAt) return;
  const gained = Math.min(max - tr.charges, 1 + Math.floor((t - tr.nextChargeAt) / cd));
  tr.charges += gained;
  tr.nextChargeAt = tr.charges >= max ? 0 : tr.nextChargeAt + gained * cd;
}

/** Moves into every stage whose requirements now hold (stages are never lost). */
export function updateStage(s: GarageState, content: GarageContent): void {
  const stages = content.stages;
  if (!stages) return;
  while (s.stage + 1 < stages.length && stages[s.stage + 1].requires.every((r) => labRequirementMet(s, stageRequirement(s, content, r)))) {
    s.stage += 1;
    const def = stages[s.stage];
    pushNews(s, content, def.unlockKey, 'stage', s.now, { stage: def.nameKey });
    if (def.mechanic === 'training' && content.training) {
      s.training = { ...s.training, charges: Math.max(1, s.training.charges), nextChargeAt: 0 };
      accrueTraining(s, content, s.now);
    }
    if (def.mechanic === 'staff' && content.staff) {
      const total = STAFF_LANES.reduce((sum, l) => sum + (s.staff[l] ?? 0), 0);
      if (total !== content.staff.total) s.staff = evenStaff(content.staff.total);
    }
    if (def.mechanic === 'autoBuy') s.nextAutoBuyAt = s.now + (content.automation?.buyIntervalMs ?? 0);
  }
}

// ---------------------------------------------------------------------------------------
// Happenings

export function happeningDef(content: GarageContent, id: string): HappeningDef | undefined {
  return content.happenings?.defs.find((d) => d.id === id);
}

/** Tokens tapping a happening now would give (before automation's share). */
export function happeningReward(state: GarageState, content: GarageContent, def: HappeningDef): number {
  const rate = totalRate({ ...withoutRaceBoost(state), frenzy: null, boostUntil: 0 }, content, state.now);
  const raw = Math.max(rate * def.rewardSeconds, tapValue(state, content, state.now, 1) * def.rewardMinTaps);
  return amount(raw * factor(modelEffects(state, content).happening) * multipliers(state, content).goldenMult);
}

/** Tokens a happening costs if it expires untouched (capped by a share of the tokens in hand). */
export function happeningPenalty(state: GarageState, content: GarageContent, def: HappeningDef): number {
  const cfg = content.happenings;
  if (!cfg || !def.penaltySeconds) return 0;
  const rate = totalRate({ ...withoutRaceBoost(state), frenzy: null, boostUntil: 0 }, content, state.now);
  return amount(Math.min(rate * def.penaltySeconds * staffEffects(state, content).severity, state.tokens * cfg.penaltyCapShare));
}

export function spawnHappening(s: GarageState, content: GarageContent, t: number): void {
  const cfg = content.happenings;
  if (!cfg) return;
  const interval = between(s, cfg.intervalMinMs, cfg.intervalMaxMs) * paradigmEffects(s, content).happeningInterval;
  const def = pickWeighted(s, cfg.defs.filter((d) => (d.minStage ?? 0) <= s.stage));
  if (!def) {
    s.nextHappeningAt = t + interval;
    return;
  }
  const x = 0.1 + 0.8 * random(s);
  const y = 0.2 + 0.6 * random(s);
  s.happening = { uid: s.uidSeq++, id: def.id, spawnedAt: t, expiresAt: t + cfg.lifetimeMs, x, y };
  s.nextHappeningAt = t + cfg.lifetimeMs + interval;
}

/** Grants a happening's reward and its side effect. `share` < 1 when a helper handles it. */
export function resolveHappening(s: GarageState, content: GarageContent, share: number): number {
  const h = s.happening;
  const def = h ? happeningDef(content, h.id) : undefined;
  s.happening = null;
  if (!def) return 0;
  const gained = grant(s, happeningReward(s, content, def) * share);
  if (def.trainingMs && content.training && mechanicOn(s, content, 'training') && s.training.nextChargeAt > 0) {
    s.training = { ...s.training, nextChargeAt: Math.max(s.now, s.training.nextChargeAt - def.trainingMs) };
    accrueTraining(s, content, s.now);
  }
  pushNews(s, content, def.textKey, 'happening', s.now);
  return gained;
}

export function expireHappening(s: GarageState, content: GarageContent): void {
  const h = s.happening;
  const def = h ? happeningDef(content, h.id) : undefined;
  if (!h || !def) {
    s.happening = null;
    return;
  }
  if (mechanicOn(s, content, 'autoCollect') && content.automation) {
    resolveHappening(s, content, content.automation.collectShare);
    s.stats.happeningsCaught += 1;
    return;
  }
  const lost = happeningPenalty(s, content, def);
  s.happening = null;
  s.stats.happeningsMissed += 1;
  if (lost > 0) {
    s.tokens = amount(s.tokens - lost);
    if (def.missKey) pushNews(s, content, def.missKey, 'happening', s.now);
  }
}

// ---------------------------------------------------------------------------------------
// Auto-buy

/** The generator the helper would buy: best output per token among those within budget. */
export function autoBuyPick(state: GarageState, content: GarageContent): string | null {
  const auto = content.automation;
  if (!auto) return null;
  const budget = state.tokens * auto.buyBudgetShare;
  const m = multipliers(state, content);
  let best: string | null = null;
  let bestScore = 0;
  for (const g of content.generators) {
    if (state.generation < g.unlockGeneration) continue;
    const cost = unitCost(g, state.generators[g.id] ?? 0);
    if (!(cost <= budget)) continue;
    const score = (g.baseRate * (m.generator[g.id] ?? 1)) / cost;
    if (score > bestScore) {
      bestScore = score;
      best = g.id;
    }
  }
  return best;
}

export function runAutoBuy(s: GarageState, content: GarageContent, t: number): void {
  const auto = content.automation;
  if (!auto) return;
  s.nextAutoBuyAt = t + auto.buyIntervalMs;
  const id = autoBuyPick(s, content);
  const def = id ? generatorDef(content, id) : undefined;
  if (!id || !def) return;
  const cost = bulkCost(def, s.generators[id] ?? 0, 1);
  if (s.tokens < cost) return;
  s.tokens = amount(s.tokens - cost);
  s.generators = { ...s.generators, [id]: (s.generators[id] ?? 0) + 1 };
  s.stats.generatorsBought += 1;
  s.stats.autoBought += 1;
}

export function autoBuyActive(state: GarageState, content: GarageContent): boolean {
  return state.autoBuy && !!content.automation && mechanicOn(state, content, 'autoBuy');
}

// ---------------------------------------------------------------------------------------
// Training runs

function roll(s: GarageState, def: TraitDef, power: number): number {
  const v = (def.min + (def.max - def.min) * random(s)) * power;
  return def.stat === 'offlineCap' ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100;
}

/** Rolls one run's candidates. Each candidate leads with a different strength when it can. */
export function rollCandidates(s: GarageState, content: GarageContent): ModelCandidate[] {
  const cfg = content.training;
  if (!cfg) return [];
  const pe = paradigmEffects(s, content);
  const luck = staffEffects(s, content).luck + pe.rarityLuck;
  const out: ModelCandidate[] = [];
  const leads = new Set<ModelStat>();
  for (let i = 0; i < cfg.candidates + pe.candidates; i++) {
    const rarity = pickWeighted(s, cfg.rarities, (r) => r.weight * Math.max(0.05, 1 + r.luck * luck)) ?? cfg.rarities[0];
    const boons: { trait: string; value: number }[] = [];
    const used = new Set<ModelStat>();
    for (let b = 0; b < rarity.boons; b++) {
      let pool = cfg.traits.filter((x) => !used.has(x.stat) && (b > 0 || !leads.has(x.stat)));
      if (pool.length === 0) pool = cfg.traits.filter((x) => !used.has(x.stat));
      const trait = pickWeighted(s, pool);
      if (!trait) break;
      used.add(trait.stat);
      if (b === 0) leads.add(trait.stat);
      boons.push({ trait: trait.id, value: roll(s, trait, rarity.power) });
    }
    let drawback: ModelCandidate['drawback'];
    if (random(s) < rarity.drawbackChance) {
      const pool = cfg.drawbacks.filter((x) => !used.has(x.stat));
      const d = pickWeighted(s, pool.length ? pool : cfg.drawbacks);
      if (d) drawback = { trait: d.id, value: roll(s, d, 1) };
    }
    const lead = boons[0] ? cfg.traits.find((x) => x.id === boons[0].trait)?.stat : undefined;
    const descs = lead ? (cfg.descKeys[lead] ?? []) : [];
    out.push({
      uid: s.uidSeq++,
      prefix: Math.floor(random(s) * cfg.prefixKeys.length),
      suffix: Math.floor(random(s) * cfg.suffixKeys.length),
      version: 1 + Math.floor(random(s) * 18) / 2,
      rarity: rarity.id,
      desc: Math.floor(random(s) * Math.max(1, descs.length)),
      boons,
      ...(drawback ? { drawback } : {}),
    });
  }
  return out;
}
