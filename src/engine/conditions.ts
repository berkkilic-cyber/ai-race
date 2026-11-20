import type { EngineContext } from './context';
import { hasLabFlag, leadRivalOf, worldShareOf } from './derived';
import { assertNever, isPresentInScope } from './scopes';
import type { Condition, GameState, LabState, MeterId } from './types';

function meterValue(state: GameState, context: EngineContext, lab: LabState, meter: MeterId | 'rival'): number {
  if (meter === 'rival') return leadRivalOf(state, context, lab.id)?.agiProgress ?? 0;
  return lab[meter];
}

function nodesInTree(lab: LabState, context: EngineContext, tree: string): number {
  return lab.ownedNodes.filter((nodeId) => context.nodes.get(nodeId)?.tree === tree).length;
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

export function checkCondition(state: GameState, context: EngineContext, lab: LabState, condition: Condition): boolean {
  switch (condition.type) {
    case 'tickAtLeast':
      return state.tick >= condition.value;
    case 'tickAtMost':
      return state.tick <= condition.value;
    case 'hasNode':
      return lab.ownedNodes.includes(condition.nodeId);
    case 'lacksNode':
      return !lab.ownedNodes.includes(condition.nodeId);
    case 'nodesInTreeAtLeast':
      return nodesInTree(lab, context, condition.tree) >= condition.value;
    case 'meterAtLeast':
      return meterValue(state, context, lab, condition.meter) >= condition.value;
    case 'meterAtMost':
      return meterValue(state, context, lab, condition.meter) <= condition.value;
    case 'agiAtLeast':
      return lab.agiProgress >= condition.value;
    case 'worldShareAtLeast':
      return worldShareOf(lab, context) >= condition.value;
    case 'worldShareAtMost':
      return worldShareOf(lab, context) <= condition.value;
    case 'resourceAtLeast':
      return lab[condition.resource] >= condition.value;
    case 'resourceAtMost':
      return lab[condition.resource] <= condition.value;
    case 'dataCentresAtLeast':
      return lab.dataCentres.length >= condition.value;
    case 'dataCentresAtMost':
      return lab.dataCentres.length <= condition.value;
    case 'presentInRegion':
      return isPresentInScope(condition.scope, lab, context);
    case 'hasFlag':
      return hasLabFlag(lab, context, condition.flag);
    case 'lacksFlag':
      return !hasLabFlag(lab, context, condition.flag);
    case 'founderIs':
      return lab.founderId === condition.founderId;
    case 'labNameIs':
      return condition.names.some((name) => normaliseName(name) === normaliseName(lab.name));
    case 'endingIs':
      return state.ending?.endingId === condition.endingId;
    default:
      return assertNever(condition);
  }
}

/** True when every condition holds for `lab` (an empty list always holds). */
export function checkAll(state: GameState, context: EngineContext, lab: LabState, conditions: readonly Condition[] | undefined): boolean {
  if (!conditions) return true;
  for (const condition of conditions) if (!checkCondition(state, context, lab, condition)) return false;
  return true;
}
