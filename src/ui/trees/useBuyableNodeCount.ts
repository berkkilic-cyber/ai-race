import { useShallow } from 'zustand/react/shallow';

import type { TreeId } from '@/engine';

import { useGameStore } from '../store/game';
import { createBuyableCounter } from './status';

/** One shared counter: all subscribers see the same state, so its cache serves them all. */
const countBuyable = createBuyableCounter();

/**
 * Number of nodes (all trees) the player can buy right now, via canApply.
 * Re-renders only when the number changes; canApply runs only when Hype or Cash
 * crosses a node price or the owned nodes / run state change (see createBuyableCounter).
 */
export function useBuyableNodeCount(): number {
  return useGameStore((s) => countBuyable(s.state, s.pack).total);
}

/** Buyable nodes per tree, in the same cached way. */
export function useBuyableByTree(): Record<TreeId, number> {
  return useGameStore(useShallow((s) => countBuyable(s.state, s.pack).byTree));
}
