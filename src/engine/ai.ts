import { checkAction, pendingChoice } from './actions';
import { getContext, type EngineContext } from './context';
import { acquirePrice, dataCentrePrice, launchPrice, nodePrice, upgradePrice } from './costs';
import {
  capabilityCapFor,
  computeForCapability,
  computeOf,
  freeShare,
  hasLabFlag,
  isBannedAt,
  isPresent,
  ownedCapability,
} from './derived';
import { isChoiceAvailable } from './events';
import { dataCentreUpkeepOf } from './economy';
import { choiceValue, nodeBaseValue } from './heuristics';
import { labModifierTable, statMultiplier, type ModifierTable } from './modifiers';
import { hashString, random, type RngHolder } from './rng';
import type { Action, AiPersonality, ContentPack, GameState, LabState, NodeDef, RegionDef, TreeId } from './types';
import { INFINITY, floor, imul, max, min } from './natives';

/**
 * How a bot plays: 'sensible' plans, 'random' takes random affordable actions, 'idle' only resolves events.
 * 'capability', 'reach' and 'shadow' plan like 'sensible' but favour one tree (and its win path).
 */
export type BotPolicy = 'sensible' | 'random' | 'idle' | 'capability' | 'reach' | 'shadow';

/** Personalities of the tree-focused policies; they replace the lab's own personality. */
const FOCUS_PERSONALITIES: Record<TreeId, AiPersonality> = {
  capability: { capability: 1, reach: 0.6, shadow: 0.15, expansion: 0.6 },
  reach: { capability: 0.25, reach: 1, shadow: 0.25, expansion: 1 },
  shadow: { capability: 0.3, reach: 0.35, shadow: 1, expansion: 0.5 },
};

function focusOf(policy: BotPolicy): TreeId | undefined {
  return policy === 'capability' || policy === 'reach' || policy === 'shadow' ? policy : undefined;
}

/** Personality used for a lab without one (the human seat when a bot plays it). */
export const DEFAULT_PERSONALITY: AiPersonality = { capability: 1, reach: 0.8, shadow: 0.8, expansion: 0.6 };

/** Meter level (0..100) above which a sensible bot starts playing cautiously. */
const CAUTION_START = 50;
/** Caution (0..1) above which a bot stops feeding a meter: no launches for regulation, no new compute for backlash. */
const SELF_PRESERVATION = 0.4;
/** Cash above this many times the next data centre's base price counts as spare. */
const SURPLUS_CASH_FACTOR = 3;

interface Budget {
  hype: number;
  cash: number;
}

interface Planner {
  state: GameState;
  context: EngineContext;
  lab: LabState;
  personality: AiPersonality;
  /** Tree a focused policy favours. */
  focus?: TreeId;
  mods: ModifierTable;
  budget: Budget;
  /** 0 when relaxed, rising to 1 as the worse meter fills up. */
  caution: number;
  /** The same per meter. */
  regulationCaution: number;
  backlashCaution: number;
  rng: RngHolder;
  /** Nodes whose requirements are met and that are not owned yet. */
  buyable: NodeDef[];
  /** Cash held back from other plans (the shadow policy saving for a buy-out). */
  saving: number;
}

/** A generator derived from the state without advancing it, so choosing actions stays a pure read. */
function localRng(state: GameState, labId: string): RngHolder {
  return { rng: (state.rng ^ hashString(labId) ^ imul(state.tick + 1, 0x9e3779b1)) >>> 0 };
}

// ───────────────────────────── Event choices ─────────────────────────────

/** The choice a bot picks for the event pending for `labId`, or undefined when none can be taken. */
export function chooseEventChoiceFor(state: GameState, context: EngineContext, labId: string, policy: BotPolicy): string | undefined {
  const lab = state.labs[labId];
  const event = state.pendingEvent?.labId === labId ? context.events.get(state.pendingEvent.eventId) : undefined;
  if (!lab || !event) return undefined;
  const available = event.choices.filter((choice) => isChoiceAvailable(state, context, lab, choice));
  if (available.length === 0) return undefined;
  if (policy === 'idle') return available[0].id;
  if (policy === 'random') return available[floor(random(localRng(state, labId)) * available.length)].id;
  const riskScale = statMultiplier(labModifierTable(lab, context, state.tick), 'riskChance');
  let best = available[0];
  let bestValue = choiceValue(best, lab, riskScale);
  for (const choice of available.slice(1)) {
    const value = choiceValue(choice, lab, riskScale);
    if (value > bestValue) {
      best = choice;
      bestValue = value;
    }
  }
  return best.id;
}

// ───────────────────────────── Sensible planning ─────────────────────────────

function cashReserve(p: Planner): number {
  let upkeep = 0;
  for (const dc of p.lab.dataCentres) upkeep += dataCentreUpkeepOf(dc, p.context, p.mods);
  return upkeep * p.context.balance.aiCashReserveTicks;
}

function buyableNodes(lab: LabState, context: EngineContext): NodeDef[] {
  const owned = new Set(lab.ownedNodes);
  return context.pack.nodes.filter((node) => !owned.has(node.id) && node.requires.every((r) => owned.has(r)));
}

function reduces(node: NodeDef, stat: 'regulationGain' | 'backlashGain'): boolean {
  return node.modifiers.some((m) => m.stat === stat && (m.op === 'mul' ? m.value < 1 : m.value < 0));
}

/** How urgently the lab wants this node for its meters (0 when it does not help a worrying meter). */
function meterRelief(p: Planner, node: NodeDef): number {
  return max(reduces(node, 'regulationGain') ? p.regulationCaution : 0, reduces(node, 'backlashGain') ? p.backlashCaution : 0);
}

function nodeScore(p: Planner, node: NodeDef, computeCap: number): number {
  let value = nodeBaseValue(node, p.lab);
  if (node.capabilityLevel !== undefined) {
    // The capability-focused policy races up the model tiers.
    value += (p.focus === 'capability' ? 8 : 2) * node.capabilityLevel;
    if (node.capabilityLevel > computeCap + 1) value *= 0.6;
    value *= 1 - 0.8 * p.backlashCaution;
  }
  // The shadow-focused policy heads for the buy-out tools: flags such as canAcquire and acquisition discounts.
  if (p.focus === 'shadow' && ((node.grantsFlags?.length ?? 0) > 0 || node.modifiers.some((m) => m.stat === 'acquireCost'))) value += 10;
  const relief = meterRelief(p, node);
  value += 12 * relief;
  // A node that calms a worrying meter is wanted whatever the lab's taste.
  const weight = relief > 0 ? max(p.personality[node.tree], 0.8) : p.personality[node.tree];
  const price = nodePrice(p.lab, p.context, node, p.state.tick, p.mods);
  return (weight * value) / (price.hype + price.cash * 0.3 + 1);
}

function planNode(p: Planner, computeCap: number): Action | undefined {
  const ranked = p.buyable
    .map((node) => ({ node, score: nodeScore(p, node, computeCap) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  for (const { node } of ranked) {
    const price = nodePrice(p.lab, p.context, node, p.state.tick, p.mods);
    if (price.hype <= p.budget.hype && price.cash <= p.budget.cash) {
      p.budget.hype -= price.hype;
      p.budget.cash -= price.cash;
      return { type: 'buyNode', labId: p.lab.id, nodeId: node.id };
    }
  }
  return undefined;
}

/** Capability level the lab wants compute for: what it owns, or the next tier it could buy. */
function targetCapability(p: Planner): number {
  let target = ownedCapability(p.lab, p.context);
  for (const node of p.buyable) target = max(target, node.capabilityLevel ?? 0);
  return max(1, target);
}

function bestBuildRegion(p: Planner): RegionDef | undefined {
  const limit = p.context.balance.maxDataCentresPerRegion;
  let best: RegionDef | undefined;
  for (const region of p.context.pack.regions) {
    if (!isPresent(p.lab, region.id) || isBannedAt(p.lab, region.id, p.state.tick)) continue;
    if (p.lab.dataCentres.filter((dc) => dc.regionId === region.id).length >= limit) continue;
    if (!best || region.powerCost + region.strictness * 0.5 < best.powerCost + best.strictness * 0.5) best = region;
  }
  return best;
}

/** Adds one data centre level where it is cheapest: a new build or an upgrade. */
function planCompute(p: Planner): Action | undefined {
  const tick = p.state.tick;
  const hasCompute = p.lab.dataCentres.length > 0;
  const needed = computeForCapability(targetCapability(p), p.context.balance);
  const wanted = computeOf(p.lab, p.context, tick, p.mods) < needed;
  const surplus = p.budget.cash > SURPLUS_CASH_FACTOR * p.context.balance.dataCentreBaseCost * (1 + p.lab.dataCentres.length);
  // Spare cash buys extra compute while meters allow; the capability policy keeps buying until self-preservation.
  const surplusAllowed = p.focus === 'capability' ? p.backlashCaution <= SELF_PRESERVATION : p.caution === 0;
  if (hasCompute && !wanted && !(surplus && surplusAllowed)) return undefined;
  if (hasCompute && p.backlashCaution > SELF_PRESERVATION) return undefined;
  const options: { action: Action; price: number }[] = [];
  const region = bestBuildRegion(p);
  if (region) options.push({ action: { type: 'buildDataCentre', labId: p.lab.id, regionId: region.id }, price: dataCentrePrice(p.lab, p.context, region, tick, p.mods) });
  const upgradable = p.lab.dataCentres
    .filter((dc) => dc.level < p.context.balance.maxDataCentreLevel && !isBannedAt(p.lab, dc.regionId, tick))
    .sort((a, b) => a.level - b.level)[0];
  if (upgradable) {
    options.push({ action: { type: 'upgradeDataCentre', labId: p.lab.id, dataCentreId: upgradable.id }, price: upgradePrice(p.lab, p.context, upgradable, tick, p.mods) });
  }
  const cheapest = options.sort((a, b) => a.price - b.price)[0];
  if (!cheapest || cheapest.price > p.budget.cash) return undefined;
  p.budget.cash -= cheapest.price;
  return cheapest.action;
}

function launchValue(p: Planner, region: RegionDef): number {
  const free = freeShare(p.state, region.id);
  const market = region.population * (0.3 + region.wealth) * region.openness * free;
  return (market * (1 - region.strictness * p.regulationCaution)) / launchPrice(p.lab, p.context, region, p.state.tick, p.mods);
}

function planLaunch(p: Planner): Action | undefined {
  if (p.caution > SELF_PRESERVATION) return undefined;
  if (p.focus !== 'reach' && random(p.rng) >= p.personality.expansion * 0.5) return undefined;
  let best: RegionDef | undefined;
  let bestValue = 0;
  for (const region of p.context.pack.regions) {
    if (isPresent(p.lab, region.id) || isBannedAt(p.lab, region.id, p.state.tick)) continue;
    const value = launchValue(p, region);
    if (value > bestValue) {
      best = region;
      bestValue = value;
    }
  }
  if (!best) return undefined;
  const price = launchPrice(p.lab, p.context, best, p.state.tick, p.mods);
  if (price > p.budget.cash) return undefined;
  p.budget.cash -= price;
  return { type: 'launchInRegion', labId: p.lab.id, regionId: best.id };
}

function planAcquire(p: Planner): Action | undefined {
  // AI labs never buy each other: a rival that swallows the others grows into a giant that
  // regulators then ban, handing the player a monopoly. Buying out rivals is the player's path.
  if (p.lab.controller === 'ai' || !hasLabFlag(p.lab, p.context, 'canAcquire')) return undefined;
  let best: { target: LabState; price: number } | undefined;
  for (const id of p.state.labOrder) {
    const target = p.state.labs[id];
    if (id === p.lab.id || !target.active || target.controller === 'human') continue;
    const price = acquirePrice(p.lab, target, p.context, p.state.tick, p.mods);
    if (!best || price < best.price) best = { target, price };
  }
  if (!best || best.price > p.budget.cash) return undefined;
  p.budget.cash -= best.price;
  return { type: 'acquireRival', labId: p.lab.id, targetLabId: best.target.id };
}

/** The shadow policy saves its cash for buy-outs once it can acquire: only the cheapest rival's price minus what it has is spendable. */
function saveForAcquisitions(p: Planner): void {
  if (p.focus !== 'shadow' || !hasLabFlag(p.lab, p.context, 'canAcquire')) return;
  let cheapest = INFINITY;
  for (const id of p.state.labOrder) {
    const target = p.state.labs[id];
    if (id !== p.lab.id && target.active && target.controller !== 'human') cheapest = min(cheapest, acquirePrice(p.lab, target, p.context, p.state.tick, p.mods));
  }
  if (cheapest < INFINITY) p.saving = cheapest;
}

function planSensible(p: Planner): Action[] {
  const actions: Action[] = [];
  const limit = max(1, p.context.balance.aiActionsPerDecision);
  const push = (action: Action | undefined): void => {
    if (action && actions.length < limit) actions.push(action);
  };
  push(planAcquire(p));
  saveForAcquisitions(p);
  if (p.saving > 0) {
    // Keep the savings out of the other plans' budget, then give back what is left.
    const kept = min(p.budget.cash, p.saving);
    p.budget.cash -= kept;
  }
  push(planCompute(p));
  push(planNode(p, capabilityCapFor(computeOf(p.lab, p.context, p.state.tick, p.mods), p.context.balance)));
  push(planLaunch(p));
  return actions;
}

// ───────────────────────────── Random play ─────────────────────────────

function candidateActions(state: GameState, context: EngineContext, lab: LabState): Action[] {
  const labId = lab.id;
  const actions: Action[] = [];
  for (const node of context.pack.nodes) actions.push({ type: 'buyNode', labId, nodeId: node.id });
  for (const region of context.pack.regions) {
    actions.push({ type: 'buildDataCentre', labId, regionId: region.id });
    actions.push({ type: 'launchInRegion', labId, regionId: region.id });
  }
  for (const dc of lab.dataCentres) actions.push({ type: 'upgradeDataCentre', labId, dataCentreId: dc.id });
  for (const id of state.labOrder) if (id !== labId) actions.push({ type: 'acquireRival', labId, targetLabId: id });
  return actions;
}

function planRandom(state: GameState, context: EngineContext, lab: LabState, rng: RngHolder): Action[] {
  if (random(rng) < 0.5) return [];
  const valid = candidateActions(state, context, lab).filter((action) => checkAction(state, context, action).ok);
  return valid.length > 0 ? [valid[floor(random(rng) * valid.length)]] : [];
}

// ───────────────────────────── Entry points ─────────────────────────────

/** Actions a bot with `policy` takes for `labId` now. Pure: never changes `state`. */
export function chooseActionsFor(state: GameState, context: EngineContext, labId: string, policy: BotPolicy = 'sensible'): Action[] {
  const lab = state.labs[labId];
  if (!lab || !lab.active || state.status === 'ended') return [];
  if (state.pendingEvent?.labId === labId) {
    const choiceId = chooseEventChoiceFor(state, context, labId, policy);
    return choiceId !== undefined && typeof pendingChoice(state, context, labId, choiceId) !== 'string'
      ? [{ type: 'resolveEvent', labId, choiceId }]
      : [];
  }
  if (policy === 'idle') return [];
  const rng = localRng(state, labId);
  if (policy === 'random') return planRandom(state, context, lab, rng);
  const mods = labModifierTable(lab, context, state.tick);
  const cautionOf = (meter: number): number => max(0, (meter - CAUTION_START) / (100 - CAUTION_START));
  const regulationCaution = cautionOf(lab.regulation);
  const backlashCaution = cautionOf(lab.backlash);
  const caution = max(regulationCaution, backlashCaution);
  const focus = focusOf(policy);
  const planner: Planner = {
    state,
    context,
    lab,
    personality: focus ? FOCUS_PERSONALITIES[focus] : (lab.personality ?? DEFAULT_PERSONALITY),
    focus,
    mods,
    budget: { hype: lab.hype, cash: 0 },
    caution,
    regulationCaution,
    backlashCaution,
    rng,
    buyable: buyableNodes(lab, context),
    saving: 0,
  };
  planner.budget.cash = lab.cash - cashReserve(planner);
  return planSensible(planner);
}

/** The heuristic controller used for rivals (and for a bot in the player's seat). */
export function chooseAiActions(state: GameState, pack: ContentPack, labId: string): Action[] {
  return chooseActionsFor(state, getContext(pack, state.difficulty, state.runLength), labId, 'sensible');
}

/** The choice id a bot with `policy` would pick for the event pending for `labId`. */
export function chooseEventChoice(state: GameState, pack: ContentPack, labId: string, policy: BotPolicy = 'sensible'): string | undefined {
  return chooseEventChoiceFor(state, getContext(pack, state.difficulty, state.runLength), labId, policy);
}
