import { addAdoptionCapped, placeAdoption } from './adoption';
import { cloneState } from './clone';
import { checkAll } from './conditions';
import { getContext, type EngineContext } from './context';
import { acquirePrice, dataCentrePrice, launchPrice, nodePrice, upgradePrice } from './costs';
import { hasLabFlag, isBannedAt, isPresent } from './derived';
import { applyEffects } from './effects';
import { scheduleNextEvent } from './events';
import { eliminateLab } from './meters';
import { labModifierTable, statMultiplier } from './modifiers';
import { collectMoment, findMoment } from './moments';
import { ENGINE_NEWS_KEYS, pushNews } from './news';
import { random } from './rng';
import { assertNever } from './scopes';
import type { Action, ActionCheck, ActionFailure, ActionResult, ContentPack, EventChoiceDef, GameState, LabState } from './types';
import { max, min, objectKeys } from './natives';

const OK: ActionCheck = { ok: true };

function fail(reason: ActionFailure): ActionCheck {
  return { ok: false, reason };
}

function affordable(lab: LabState, hype: number, cash: number): ActionCheck {
  if (lab.hype < hype) return fail('notEnoughHype');
  if (lab.cash < cash) return fail('notEnoughCash');
  return OK;
}

/** The choice of the event pending for `labId`, or the reason it cannot be resolved. */
export function pendingChoice(state: GameState, context: EngineContext, labId: string, choiceId: string): EventChoiceDef | ActionFailure {
  if (!state.pendingEvent || state.pendingEvent.labId !== labId) return 'noPendingEvent';
  const event = context.events.get(state.pendingEvent.eventId);
  const choice = event?.choices.find((c) => c.id === choiceId);
  return choice ?? 'unknownId';
}

function checkBuyNode(state: GameState, context: EngineContext, lab: LabState, nodeId: string): ActionCheck {
  const node = context.nodes.get(nodeId);
  if (!node) return fail('unknownId');
  if (lab.ownedNodes.includes(nodeId)) return fail('alreadyOwned');
  if (!node.requires.every((req) => lab.ownedNodes.includes(req))) return fail('missingRequirement');
  const price = nodePrice(lab, context, node, state.tick);
  return affordable(lab, price.hype, price.cash);
}

function checkBuild(state: GameState, context: EngineContext, lab: LabState, regionId: string): ActionCheck {
  const region = context.regions.get(regionId);
  if (!region) return fail('unknownId');
  if (isBannedAt(lab, regionId, state.tick)) return fail('regionBanned');
  if (!isPresent(lab, regionId)) return fail('notAllowed');
  const here = lab.dataCentres.filter((dc) => dc.regionId === regionId).length;
  if (here >= context.balance.maxDataCentresPerRegion) return fail('limitReached');
  return affordable(lab, 0, dataCentrePrice(lab, context, region, state.tick));
}

function checkUpgrade(state: GameState, context: EngineContext, lab: LabState, dataCentreId: string): ActionCheck {
  const dc = lab.dataCentres.find((d) => d.id === dataCentreId);
  if (!dc) return fail('unknownId');
  if (isBannedAt(lab, dc.regionId, state.tick)) return fail('regionBanned');
  if (dc.level >= context.balance.maxDataCentreLevel) return fail('limitReached');
  return affordable(lab, 0, upgradePrice(lab, context, dc, state.tick));
}

function checkLaunch(state: GameState, context: EngineContext, lab: LabState, regionId: string): ActionCheck {
  const region = context.regions.get(regionId);
  if (!region) return fail('unknownId');
  if (isBannedAt(lab, regionId, state.tick)) return fail('regionBanned');
  if (isPresent(lab, regionId)) return fail('alreadyPresent');
  return affordable(lab, 0, launchPrice(lab, context, region, state.tick));
}

function checkResolve(state: GameState, context: EngineContext, lab: LabState, choiceId: string): ActionCheck {
  const choice = pendingChoice(state, context, lab.id, choiceId);
  if (typeof choice === 'string') return fail(choice);
  if (!checkAll(state, context, lab, choice.requirements)) return fail('missingRequirement');
  return affordable(lab, choice.cost?.hype ?? 0, choice.cost?.cash ?? 0);
}

function checkAcquire(state: GameState, context: EngineContext, lab: LabState, targetLabId: string): ActionCheck {
  const target = state.labs[targetLabId];
  if (!target) return fail('unknownId');
  if (target.id === lab.id || target.controller === 'human') return fail('notAllowed');
  if (!target.active) return fail('labInactive');
  if (!hasLabFlag(lab, context, 'canAcquire')) return fail('missingRequirement');
  return affordable(lab, 0, acquirePrice(lab, target, context, state.tick));
}

function checkCollect(state: GameState, lab: LabState, uid: string): ActionCheck {
  const moment = findMoment(state, uid);
  if (!moment) return fail('unknownId');
  if (moment.labId !== lab.id) return fail('notAllowed');
  return OK;
}

export function checkAction(state: GameState, context: EngineContext, action: Action): ActionCheck {
  if (state.status === 'ended') return fail('gameEnded');
  const lab = state.labs[action.labId];
  if (!lab) return fail('unknownId');
  if (!lab.active) return fail('labInactive');
  if (action.type !== 'resolveEvent' && state.pendingEvent?.labId === lab.id) return fail('eventPending');
  switch (action.type) {
    case 'buyNode':
      return checkBuyNode(state, context, lab, action.nodeId);
    case 'buildDataCentre':
      return checkBuild(state, context, lab, action.regionId);
    case 'upgradeDataCentre':
      return checkUpgrade(state, context, lab, action.dataCentreId);
    case 'launchInRegion':
      return checkLaunch(state, context, lab, action.regionId);
    case 'resolveEvent':
      return checkResolve(state, context, lab, action.choiceId);
    case 'acquireRival':
      return checkAcquire(state, context, lab, action.targetLabId);
    case 'collectMoment':
      return checkCollect(state, lab, action.uid);
    default:
      return assertNever(action);
  }
}

function doBuyNode(state: GameState, context: EngineContext, lab: LabState, nodeId: string): void {
  const node = context.nodes.get(nodeId);
  if (!node) return;
  const price = nodePrice(lab, context, node, state.tick);
  lab.hype -= price.hype;
  lab.cash -= price.cash;
  lab.ownedNodes.push(nodeId);
  lab.stats.nodesBought++;
  applyEffects(state, context, lab, node.onBuy);
}

function doBuild(state: GameState, context: EngineContext, lab: LabState, regionId: string): void {
  const region = context.regions.get(regionId);
  if (!region) return;
  lab.cash -= dataCentrePrice(lab, context, region, state.tick);
  lab.stats.dataCentresBuilt++;
  lab.dataCentres.push({ id: `${lab.id}:dc${lab.stats.dataCentresBuilt}`, regionId, level: 1 });
}

function doUpgrade(state: GameState, context: EngineContext, lab: LabState, dataCentreId: string): void {
  const dc = lab.dataCentres.find((d) => d.id === dataCentreId);
  if (!dc) return;
  lab.cash -= upgradePrice(lab, context, dc, state.tick);
  dc.level++;
}

function doLaunch(state: GameState, context: EngineContext, lab: LabState, regionId: string): void {
  const region = context.regions.get(regionId);
  if (!region) return;
  lab.cash -= launchPrice(lab, context, region, state.tick);
  placeAdoption(state, context, lab, regionId, context.balance.launchAdoption);
  pushNews(state, context, { textKey: ENGINE_NEWS_KEYS.launched, kind: 'other', tone: 'neutral', params: { lab: lab.id, region: regionId }, regionId, labId: lab.id });
}

function doResolve(state: GameState, context: EngineContext, lab: LabState, choiceId: string): void {
  const choice = pendingChoice(state, context, lab.id, choiceId);
  const eventId = state.pendingEvent?.eventId;
  if (typeof choice === 'string' || eventId === undefined) return;
  lab.hype -= choice.cost?.hype ?? 0;
  lab.cash -= choice.cost?.cash ?? 0;
  applyEffects(state, context, lab, choice.effects);
  let riskFired = false;
  if (choice.risk) {
    const chance = choice.risk.chance * statMultiplier(labModifierTable(lab, context, state.tick), 'riskChance');
    riskFired = random(state) < min(1, max(0, chance));
    if (riskFired) applyEffects(state, context, lab, choice.risk.effects);
  }
  const resultKey = riskFired ? choice.risk?.resultKey : choice.resultKey;
  state.lastEventResult = { eventId, choiceId, ...(resultKey !== undefined ? { resultKey } : {}), ...(choice.risk ? { riskFired } : {}) };
  lab.stats.eventsResolved++;
  state.pendingEvent = null;
  scheduleNextEvent(state, context);
}

/** The buyer takes over `acquireAdoptionShare` of the target's adoption; the rest disappears. */
function doAcquire(state: GameState, context: EngineContext, lab: LabState, targetLabId: string): void {
  const target = state.labs[targetLabId];
  lab.cash -= acquirePrice(lab, target, context, state.tick);
  const taken = { ...target.adoption };
  target.adoption = {};
  for (const regionId of objectKeys(taken)) {
    if (isBannedAt(lab, regionId, state.tick)) continue;
    addAdoptionCapped(state, context, lab, regionId, taken[regionId] * context.balance.acquireAdoptionShare);
  }
  eliminateLab(state, context, target, 'acquired', lab.id);
  pushNews(state, context, { textKey: ENGINE_NEWS_KEYS.acquired, kind: 'acquisition', tone: 'good', params: { lab: target.id, rival: lab.id }, labId: target.id });
}

/** Applies an already-checked action to a draft state in place. */
export function executeAction(state: GameState, context: EngineContext, action: Action): void {
  const lab = state.labs[action.labId];
  switch (action.type) {
    case 'buyNode':
      return doBuyNode(state, context, lab, action.nodeId);
    case 'buildDataCentre':
      return doBuild(state, context, lab, action.regionId);
    case 'upgradeDataCentre':
      return doUpgrade(state, context, lab, action.dataCentreId);
    case 'launchInRegion':
      return doLaunch(state, context, lab, action.regionId);
    case 'resolveEvent':
      return doResolve(state, context, lab, action.choiceId);
    case 'acquireRival':
      return doAcquire(state, context, lab, action.targetLabId);
    case 'collectMoment':
      return collectMoment(state, context, lab, action.uid);
    default:
      return assertNever(action);
  }
}

/** Checks then applies an action to a draft in place. Returns the check. */
export function applyActionInPlace(state: GameState, context: EngineContext, action: Action): ActionCheck {
  const check = checkAction(state, context, action);
  if (check.ok) executeAction(state, context, action);
  return check;
}

export function canApply(state: GameState, pack: ContentPack, action: Action): ActionCheck {
  return checkAction(state, getContext(pack, state.difficulty), action);
}

export function applyAction(state: GameState, pack: ContentPack, action: Action): ActionResult {
  const context = getContext(pack, state.difficulty);
  const check = checkAction(state, context, action);
  if (!check.ok) return check;
  const draft = cloneState(state);
  executeAction(draft, context, action);
  return { ok: true, state: draft };
}
