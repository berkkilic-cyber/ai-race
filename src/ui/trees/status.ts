/** Display state of tree nodes, read from the engine (canApply, getNodeCost). No rules are computed here. */
import { canApply, getNodeCost, type ContentPack, type GameState, type NodeDef, type TreeId } from '@/engine';

/**
 * owned: bought. buyable: canApply says yes. expensive: requirements met but not enough Hype or Cash.
 * locked: prerequisites missing. available: requirements met but blocked for another reason (e.g. an event is pending).
 */
export type NodeStatus = 'owned' | 'buyable' | 'expensive' | 'locked' | 'available';

export const TREES: readonly TreeId[] = ['capability', 'reach', 'shadow'];

export function nodeStatus(state: GameState, pack: ContentPack, node: NodeDef): NodeStatus {
  const labId = state.playerLabId;
  const lab = state.labs[labId];
  if (lab.ownedNodes.includes(node.id)) return 'owned';
  const check = canApply(state, pack, { type: 'buyNode', labId, nodeId: node.id });
  if (check.ok) return 'buyable';
  if (check.reason === 'missingRequirement') return 'locked';
  if (check.reason === 'notEnoughHype' || check.reason === 'notEnoughCash') return 'expensive';
  return node.requires.every((r) => lab.ownedNodes.includes(r)) ? 'available' : 'locked';
}

/** Nodes of one tree, top to bottom, left to right. */
export function treeNodes(pack: ContentPack, tree: TreeId): NodeDef[] {
  return pack.nodes.filter((n) => n.tree === tree).sort((a, b) => a.row - b.row || a.col - b.col);
}

export interface BuyableCounts {
  total: number;
  byTree: Record<TreeId, number>;
}

interface Candidate {
  node: NodeDef;
  hype: number;
  cash: number;
}

interface Structure {
  pack: ContentPack;
  /** Everything besides Hype and Cash that canApply or the prices can depend on. */
  key: string;
  /** Earliest tick at which a timed modifier (which may change node prices) runs out. */
  expiresAt: number;
  candidates: Candidate[];
}

/** The engine copies the state every tick, so compare contents, not references. */
function structureKey(state: GameState): string {
  const lab = state.labs[state.playerLabId];
  const timed = lab.timedModifiers.map((m) => `${m.modifier.stat}:${m.modifier.op}:${m.modifier.value}:${m.untilTick}`).join(',');
  const pending = state.pendingEvent ? `${state.pendingEvent.labId}:${state.pendingEvent.eventId}` : '';
  return `${state.status}|${lab.active ? 1 : 0}|${pending}|${lab.ownedNodes.join(',')}|${timed}`;
}

const ZERO: BuyableCounts = { total: 0, byTree: { capability: 0, reach: 0, shadow: 0 } };

/**
 * Counts nodes the player can buy right now, without calling canApply for every
 * node on every tick. The set of unowned nodes and their engine prices only
 * change when nodes are bought, timed modifiers change or the run state changes;
 * between those, canApply is re-run only when Hype or Cash crosses one of those
 * prices. canApply always has the final word.
 */
export function createBuyableCounter(): (state: GameState | null, pack: ContentPack) => BuyableCounts {
  let structure: Structure | null = null;
  let signature = '';
  let result: BuyableCounts = ZERO;

  return (state, pack) => {
    if (!state) return ZERO;
    const lab = state.labs[state.playerLabId];
    const key = structureKey(state);
    const stale = !structure || structure.pack !== pack || structure.key !== key || state.tick >= structure.expiresAt;
    if (stale) {
      const candidates: Candidate[] = [];
      for (const node of pack.nodes) {
        if (lab.ownedNodes.includes(node.id)) continue;
        const price = getNodeCost(state, pack, state.playerLabId, node.id);
        candidates.push({ node, hype: price.hype, cash: price.cash });
      }
      let expiresAt = Infinity;
      for (const timed of lab.timedModifiers) if (timed.untilTick > state.tick) expiresAt = Math.min(expiresAt, timed.untilTick);
      structure = { pack, key, expiresAt, candidates };
      signature = '';
    }
    const s = structure as Structure;
    let next = '';
    for (const c of s.candidates) next += lab.hype >= c.hype && lab.cash >= c.cash ? '1' : '0';
    if (next === signature) return result;
    signature = next;
    const byTree: Record<TreeId, number> = { capability: 0, reach: 0, shadow: 0 };
    let total = 0;
    for (const c of s.candidates) {
      if (canApply(state, pack, { type: 'buyNode', labId: state.playerLabId, nodeId: c.node.id }).ok) {
        byTree[c.node.tree]++;
        total++;
      }
    }
    result = { total, byTree };
    return result;
  };
}
