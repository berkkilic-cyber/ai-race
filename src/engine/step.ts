import { applyActionInPlace } from './actions';
import { addAdoptionCapped } from './adoption';
import { chooseActionsFor } from './ai';
import { channelSetOf } from './channels';
import { cloneState } from './clone';
import { getContext, type EngineContext } from './context';
import { cachedCapabilityCap, computeOf, ownedCapability } from './derived';
import { applyIncome } from './economy';
import { checkAchievements, checkEnding } from './endings';
import { maybeAddHeadline, maybeDrawEvent } from './events';
import { applyProgressAndMeters, applyThresholdBans, checkElimination, INTERNAL_FLAG_PREFIX } from './meters';
import { updateMoments } from './moments';
import { expireTimedModifiers, labModifierTable } from './modifiers';
import { ENGINE_NEWS_KEYS, pushNews } from './news';
import { baseAppealOf, decayEliminated, spreadLab, spreadMultipliersOf, type LabTickInfo } from './spread';
import type { ContentPack, GameState, LabState, NodeDef } from './types';
import { loadWorkspace, storeWorkspace, usersFromArrays, type Workspace } from './workspace';
import { max, min, round } from './natives';

/** Rivals whose entryTick has come join at their home region. Not-yet-entered = inactive and never eliminated. */
function enterRivals(state: GameState, context: EngineContext): void {
  for (const id of state.labOrder) {
    const lab = state.labs[id];
    if (lab.active || lab.eliminated) continue;
    const def = context.rivals.get(id);
    if (!def || state.tick < def.entryTick) continue;
    lab.active = true;
    addAdoptionCapped(state, context, lab, lab.homeRegion, context.balance.startAdoption);
    if (def.entryTick > 0) {
      pushNews(state, context, {
        textKey: ENGINE_NEWS_KEYS.rivalEntered,
        kind: 'entry',
        tone: 'neutral',
        params: { lab: id, region: lab.homeRegion },
        regionId: lab.homeRegion,
        labId: id,
      });
    }
  }
}

function expireTimers(lab: LabState, tick: number): void {
  expireTimedModifiers(lab, tick);
  for (const regionId in lab.bans) {
    const until = lab.bans[regionId];
    if (until !== -1 && until <= tick) delete lab.bans[regionId];
  }
  for (const dc of lab.dataCentres) {
    if (dc.disabledUntilTick !== undefined && dc.disabledUntilTick <= tick) delete dc.disabledUntilTick;
  }
  if (lab.flagTimers) expireFlags(lab, lab.flagTimers, tick);
}

/** Removes timed flags whose time is up. */
function expireFlags(lab: LabState, timers: Record<string, number>, tick: number): void {
  let left = 0;
  for (const flag in timers) {
    if (timers[flag] > tick) {
      left++;
      continue;
    }
    delete timers[flag];
    lab.flags = lab.flags.filter((f) => f !== flag);
  }
  if (left === 0) delete lab.flagTimers;
}

function tickInfo(lab: LabState, context: EngineContext, tick: number): LabTickInfo {
  const mods = labModifierTable(lab, context, tick);
  const compute = computeOf(lab, context, tick, mods);
  const capability = min(ownedCapability(lab, context), cachedCapabilityCap(compute, context));
  return {
    mods,
    compute,
    capability,
    baseAppeal: baseAppealOf(lab, capability, context),
    spreadMult: spreadMultipliersOf(mods, context),
    channels: channelSetOf(lab, context),
  };
}

/** Every lab's appeal × (1 + openRivalSpreadBonus) for each other active lab holding an 'open' channel. */
function applyOpenBonus(infos: Map<string, LabTickInfo>, context: EngineContext): void {
  let holders = 0;
  for (const info of infos.values()) if (info.channels.open) holders++;
  if (holders === 0) return;
  const bonus = context.balance.openRivalSpreadBonus;
  for (const info of infos.values()) {
    const others = holders - (info.channels.open ? 1 : 0);
    if (others > 0) info.baseAppeal *= 1 + bonus * others;
  }
}

const launchFlagNames: string[] = [];

/** Internal flag recording that a lab has launched model tier `tier` this run. */
export function launchFlag(tier: number): string {
  return (launchFlagNames[tier] ??= `${INTERNAL_FLAG_PREFIX}launched:${tier}`);
}

/** The owned node providing effective tier `tier`: one with exactly that level, else the lowest owned one above it. */
function nodeForTier(lab: LabState, context: EngineContext, tier: number): NodeDef | undefined {
  let best: NodeDef | undefined;
  for (const nodeId of lab.ownedNodes) {
    const node = context.nodes.get(nodeId);
    const level = node?.capabilityLevel;
    if (!node || level === undefined || level < tier) continue;
    if (!best || level < (best.capabilityLevel ?? 0)) best = node;
  }
  return best;
}

const rivalVariantCounts = new WeakMap<EngineContext, number>();

/** How many numbered variants `engine.news.launch.rival.<n>` (n = 2, 3, ...) the pack's first locale has. */
function rivalLaunchVariants(context: EngineContext): number {
  let count = rivalVariantCounts.get(context);
  if (count === undefined) {
    const table = Object.values(context.pack.strings)[0] ?? {};
    count = 0;
    while (`${ENGINE_NEWS_KEYS.launchRival}.${count + 2}` in table) count++;
    rivalVariantCounts.set(context, count);
  }
  return count;
}

/** The rival launch text: the base key or one of its numbered variants, picked by lab and tier (no randomness). */
function rivalLaunchKey(state: GameState, context: EngineContext, lab: LabState, tier: number): string {
  const variants = rivalLaunchVariants(context);
  const pick = (state.labOrder.indexOf(lab.id) + tier) % (variants + 1);
  return pick === 0 ? ENGINE_NEWS_KEYS.launchRival : `${ENGINE_NEWS_KEYS.launchRival}.${pick + 1}`;
}

/**
 * When a lab's effective capability (after the compute cap) reaches a tier it has never
 * run before, one 'launch' news item announces it. Lower tiers skipped in the same jump are
 * marked as launched without news of their own.
 */
function announceLaunch(state: GameState, context: EngineContext, lab: LabState, tier: number): void {
  if (tier <= 0 || lab.flags.includes(launchFlag(tier))) return;
  for (let level = 1; level <= tier; level++) if (!lab.flags.includes(launchFlag(level))) lab.flags.push(launchFlag(level));
  const node = nodeForTier(lab, context, tier);
  if (!node) return;
  const player = lab.id === state.playerLabId;
  pushNews(state, context, {
    textKey: player ? ENGINE_NEWS_KEYS.launchPlayer : rivalLaunchKey(state, context, lab, tier),
    kind: 'launch',
    tone: player ? 'good' : 'bad',
    params: { lab: lab.id, model: node.nameKey, tier },
    nodeId: node.id,
    tier,
    regionId: lab.homeRegion,
    labId: lab.id,
  });
}

/** Rules 3 to 9 for one active lab (compute and capability are in `info`). */
function updateLab(state: GameState, context: EngineContext, ws: Workspace, lab: LabState, infos: ReadonlyMap<string, LabTickInfo>): void {
  const info = infos.get(lab.id);
  const arrays = ws.labs.get(lab.id);
  if (!info || !arrays) return;
  // A meter pushed to 100 by an effect since the last tick eliminates before decay can save it.
  checkElimination(state, context, lab);
  if (!lab.active) return;
  announceLaunch(state, context, lab, info.capability);
  const growth = spreadLab(state, context, ws, lab, info, infos);
  lab.newUsersLastTick = growth.total;
  applyIncome(state, context, lab, arrays, info, growth);
  const share = context.worldPopulation > 0 ? usersFromArrays(arrays, context) / context.worldPopulation : 0;
  applyProgressAndMeters(context, lab, info, growth, share);
  lab.stats.peakWorldShare = max(lab.stats.peakWorldShare, share);
  applyThresholdBans(state, context, lab, arrays);
  checkElimination(state, context, lab);
}

function runAiLabs(state: GameState, context: EngineContext): void {
  const interval = max(1, round(context.balance.aiDecisionInterval));
  state.labOrder.forEach((id, index) => {
    const lab = state.labs[id];
    // Staggered by lab index so AI labs do not all act on the same tick.
    if (lab.controller !== 'ai' || !lab.active || (state.tick + index) % interval !== 0) return;
    for (const action of chooseActionsFor(state, context, id)) {
      if (state.status === 'ended') return;
      applyActionInPlace(state, context, action);
    }
  });
}

/** Advances a draft state by one tick in place. */
export function stepInPlace(state: GameState, context: EngineContext): void {
  if (state.status === 'ended' || state.pendingEvent) return;
  state.tick++;
  enterRivals(state, context);
  for (const id of state.labOrder) expireTimers(state.labs[id], state.tick);

  const infos = new Map<string, LabTickInfo>();
  for (const id of state.labOrder) {
    if (state.labs[id].active) infos.set(id, tickInfo(state.labs[id], context, state.tick));
  }
  applyOpenBonus(infos, context);
  const ws = loadWorkspace(state, context);
  for (const id of state.labOrder) {
    const lab = state.labs[id];
    if (lab.active) updateLab(state, context, ws, lab, infos);
    else if (lab.eliminated) decayEliminated(context, ws, id);
  }
  storeWorkspace(state, context, ws);

  runAiLabs(state, context);
  updateMoments(state, context);
  maybeDrawEvent(state, context);
  maybeAddHeadline(state, context);
  checkAchievements(state, context, 'tick');
  checkEnding(state, context);
}

export function step(state: GameState, pack: ContentPack): GameState {
  if (state.status === 'ended' || state.pendingEvent) return state;
  const draft = cloneState(state);
  stepInPlace(draft, getContext(pack));
  return draft;
}
