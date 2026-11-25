/**
 * Paradigm Shift: the second reset layer. Once the last named model has shipped, the lab can
 * throw away its models and Hype for a permanent currency, spent in a small tree of nodes
 * that change how the next cycle plays (paradigmRates.ts reads them). Pure and deterministic.
 */
import { pushNews } from './core';
import { at, prestige, prestigePreview } from './garage';
import { updateStage } from './lab';
import { paradigmEffects, paradigmMultiplier, paradigmNode } from './paradigmRates';
import { upgradeDef } from './rates';
import type { ActionResult, GarageContent, GarageState, ParadigmState } from './types';

export function emptyParadigm(): ParadigmState {
  return { count: 0, points: 0, earned: 0, nodes: [], autoShip: false, bestGeneration: 0 };
}

/** Currency a shift now would give (0 before the shift is available). */
export function paradigmGain(state: GarageState, content: GarageContent): number {
  const cfg = content.paradigm;
  if (!cfg || state.generation < cfg.minGeneration) return 0;
  const hype = Number.isFinite(state.hype) ? Math.max(0, state.hype) : 0;
  const raw = cfg.base + cfg.perGeneration * (state.generation - cfg.minGeneration) + cfg.perLogHype * Math.log10(1 + hype);
  return Math.max(1, Math.floor(Number.isFinite(raw) ? raw : cfg.base));
}

export interface ParadigmStatus {
  /** The content has a Paradigm layer. */
  enabled: boolean;
  /** A shift can be made now. */
  available: boolean;
  /** The generation a shift needs (the save must be at it or later). */
  minGeneration: number;
  gain: number;
  count: number;
  points: number;
  earned: number;
  /** Production multiplier from the layer now and after this shift. */
  multNow: number;
  multAfter: number;
}

export function paradigmStatus(state: GarageState, content: GarageContent): ParadigmStatus {
  const cfg = content.paradigm;
  const p = state.paradigm ?? emptyParadigm();
  if (!cfg) return { enabled: false, available: false, minGeneration: 0, gain: 0, count: 0, points: 0, earned: 0, multNow: 1, multAfter: 1 };
  const gain = paradigmGain(state, content);
  const multNow = paradigmMultiplier(state, content);
  const multAfter = paradigmMultiplier({ paradigm: { ...p, earned: p.earned + gain } }, content);
  return { enabled: true, available: state.generation >= cfg.minGeneration, minGeneration: cfg.minGeneration, gain, count: p.count, points: p.points, earned: p.earned, multNow, multAfter };
}

/**
 * Shifts the paradigm: models shipped (the generation), Hype, tokens, generators, kept
 * models (unless the tree keeps them) and the upgrades that reset on shipping are gone; Lab
 * Rep, achievements, stats, training runs in the queue, staff, the storage upgrades and the
 * tree stay. The currency is added; the cycle starts in the tree's start stage and stages
 * whose generation need is eased come back sooner.
 */
export function paradigmShift(state: GarageState, content: GarageContent, now: number): ActionResult {
  const cfg = content.paradigm;
  if (!cfg) return { state, ok: false, reason: 'notApplicable' };
  const s = at(state, content, now);
  if (s.generation < cfg.minGeneration) return { state: s, ok: false, reason: 'notReady' };
  const gain = paradigmGain(s, content);
  const prev = s.paradigm ?? emptyParadigm();
  const fx = paradigmEffects(s, content);
  s.paradigm = { ...prev, count: prev.count + 1, points: prev.points + gain, earned: prev.earned + gain, bestGeneration: Math.max(prev.bestGeneration, s.generation) };
  s.generation = 0;
  s.hype = 0;
  s.tokens = 0;
  s.genLifetime = 0;
  s.generators = { ...fx.startGenerators };
  s.upgrades = s.upgrades.filter((id) => upgradeDef(content, id)?.keep);
  s.incident = null;
  s.frenzy = null;
  s.golden = null;
  s.happening = null;
  s.bonusOffer = null;
  s.combo = { count: 0, lastAt: s.combo.lastAt };
  s.shipChoice = null;
  s.lastShip = null;
  if (!fx.keepModels) s.models = [];
  s.training = { ...s.training, candidates: null };
  s.stats.genUpgrades = 0;
  s.stats.pureTaps = 0;
  const stages = content.stages?.length ?? 0;
  s.stage = stages ? Math.min(stages - 1, Math.max(0, fx.startStage)) : 0;
  updateStage(s, content);
  pushNews(s, content, cfg.newsKey, 'paradigm', s.now, { n: s.paradigm.count });
  return { state: s, ok: true };
}

/** Why a node cannot be bought now (undefined when it can). */
export function paradigmNodeBlock(state: GarageState, content: GarageContent, id: string): ActionResult['reason'] | undefined {
  const def = paradigmNode(content, id);
  if (!def) return 'unknownId';
  const p = state.paradigm ?? emptyParadigm();
  if (p.nodes.includes(id)) return 'owned';
  if (!def.requires.every((r) => p.nodes.includes(r))) return 'locked';
  if (p.points < def.cost) return 'cantAfford';
  return undefined;
}

/** Buys a Paradigm tree node with the currency. Auto-ship switches itself on when bought. */
export function buyParadigmNode(state: GarageState, content: GarageContent, id: string, now: number): ActionResult {
  const block = paradigmNodeBlock(state, content, id);
  if (block) return { state, ok: false, reason: block };
  const s = at(state, content, now);
  const def = paradigmNode(content, id)!;
  const p = s.paradigm ?? emptyParadigm();
  s.paradigm = { ...p, points: p.points - def.cost, nodes: [...p.nodes, id], autoShip: p.autoShip || def.effect.kind === 'autoShip' };
  if (def.effect.kind === 'startStage' && content.stages) s.stage = Math.max(s.stage, Math.min(content.stages.length - 1, def.effect.stage));
  updateStage(s, content);
  return { state: s, ok: true };
}

/** The auto-ship switch (needs its node). */
export function setAutoShip(state: GarageState, content: GarageContent, on: boolean, now: number): ActionResult {
  if (!paradigmEffects(state, content).autoShip) return { state, ok: false, reason: 'locked' };
  const s = at(state, content, now);
  s.paradigm = { ...(s.paradigm ?? emptyParadigm()), autoShip: on };
  return { state: s, ok: true };
}

/** True if auto-ship would ship now: the switch is on and the Hype gained adds half again to the multiplier (or it is the first). */
export function autoShipDue(state: GarageState, content: GarageContent): boolean {
  if (!state.paradigm?.autoShip || !paradigmEffects(state, content).autoShip) return false;
  const pv = prestigePreview(state, content);
  return pv.canShip && (state.hype === 0 || pv.multAfter / pv.multNow >= 1.5);
}

/** Ships by itself when auto-ship is due (the screen calls this after each advance; bots do the same). */
export function runAutoShip(state: GarageState, content: GarageContent, now: number): ActionResult {
  if (!autoShipDue(state, content)) return { state, ok: false, reason: 'notReady' };
  const choice = paradigmEffects(state, content).autoShip ?? undefined;
  const valid = choice && content.shipDay?.choices.some((c) => c.id === choice) ? choice : undefined;
  return prestige(state, content, now, { choice: valid });
}
