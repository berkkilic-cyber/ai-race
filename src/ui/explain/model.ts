/**
 * The player's model tiers: the one running, the best one owned, and the compute each
 * needs. Read from the engine (getCapabilityLevel, getOwnedCapabilityLevel,
 * getComputeRequired, getComputeShortfall, getCompute); nothing is computed here.
 */
import {
  canApply,
  getCapabilityLevel,
  getCompute,
  getComputeRequired,
  getComputeShortfall,
  getNodeCost,
  getOwnedCapabilityLevel,
  type ContentPack,
  type GameState,
  type NodeDef,
} from '@/engine';

/** Compute a tier needs, as shown: rounded up, so "needs 42" never reads as met by 41.7. */
export function needText(compute: number): string {
  return String(Math.ceil(compute - 1e-9));
}

/** Compute the player has, as shown: rounded down. */
export function haveText(compute: number): string {
  return String(Math.floor(compute + 1e-9));
}

export interface TierRow {
  tier: number;
  nodeId: string;
  /** Compute needed to run this tier. */
  required: number;
  owned: boolean;
  /** Owned and running now (the compute allows it). */
  running: boolean;
}

export interface ModelFacts {
  /** Tier running now (after the compute cap). */
  running: number;
  /** Highest tier owned. */
  owned: number;
  compute: number;
  /** Compute needed for the highest owned tier (0 when none owned). */
  required: number;
  /** Compute still missing for the highest owned tier. */
  shortfall: number;
  /** Every model tier in the pack, lowest first. */
  tiers: TierRow[];
}

/** Model nodes of the pack, lowest tier first. */
export function modelNodes(pack: ContentPack): NodeDef[] {
  return pack.nodes.filter((n) => n.capabilityLevel !== undefined).sort((a, b) => (a.capabilityLevel ?? 0) - (b.capabilityLevel ?? 0));
}

export function modelFacts(state: GameState, pack: ContentPack, labId: string): ModelFacts {
  const lab = state.labs[labId];
  const running = getCapabilityLevel(state, pack, labId);
  const owned = getOwnedCapabilityLevel(state, pack, labId);
  const tiers = modelNodes(pack).map((node) => {
    const tier = node.capabilityLevel ?? 0;
    const has = lab.ownedNodes.includes(node.id);
    return { tier, nodeId: node.id, required: getComputeRequired(pack, tier), owned: has, running: has && tier <= running };
  });
  return {
    running,
    owned,
    compute: getCompute(state, pack, labId),
    required: owned > 0 ? getComputeRequired(pack, owned) : 0,
    shortfall: getComputeShortfall(state, pack, labId),
    tiers,
  };
}

/** True when the player owns a better model than the compute lets them run. */
export function ownsMoreThanRuns(facts: Pick<ModelFacts, 'owned' | 'running'>): boolean {
  return facts.owned > facts.running;
}

export interface ComputeSource {
  nodeId: string;
  hype: number;
  cash: number;
  /** Prerequisites owned (it can be bought once affordable). */
  open: boolean;
}

/** Unowned upgrades that add compute (a compute effect or more data-centre capacity), cheapest first. */
export function computeUpgrades(state: GameState, pack: ContentPack, labId: string): ComputeSource[] {
  const lab = state.labs[labId];
  const out: ComputeSource[] = [];
  for (const node of pack.nodes) {
    if (lab.ownedNodes.includes(node.id)) continue;
    const adds = node.modifiers.some((m) => m.stat === 'computeCapacity' && (m.op === 'mul' ? m.value > 1 : m.value > 0)) || (node.onBuy ?? []).some((e) => e.type === 'compute' && e.amount > 0);
    if (!adds) continue;
    const price = getNodeCost(state, pack, labId, node.id);
    const check = canApply(state, pack, { type: 'buyNode', labId, nodeId: node.id });
    out.push({ nodeId: node.id, hype: price.hype, cash: price.cash, open: check.ok || check.reason !== 'missingRequirement' });
  }
  return out.sort((a, b) => Number(b.open) - Number(a.open) || a.hype - b.hype);
}
