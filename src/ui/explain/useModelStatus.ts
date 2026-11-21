import { useShallow } from 'zustand/react/shallow';
import { create } from 'zustand';

import { getCapabilityLevel, getCompute, getComputeRequired, getComputeShortfall, getOwnedCapabilityLevel } from '@/engine';

import { useGameStore, type GameStore } from '../store/game';

/** The player's model tiers and compute, rounded to what is shown. */
export interface ModelStatus {
  running: number;
  owned: number;
  /** Whole compute units. */
  compute: number;
  /** Compute needed for the highest owned tier. */
  required: number;
  /** Compute missing for the highest owned tier (rounded up). */
  shortfall: number;
}

const NONE: ModelStatus = { running: 0, owned: 0, compute: 0, required: 0, shortfall: 0 };

export function selectModelStatus(s: GameStore): ModelStatus {
  const state = s.state;
  if (!state) return NONE;
  const id = state.playerLabId;
  const owned = getOwnedCapabilityLevel(state, s.pack, id);
  return {
    running: getCapabilityLevel(state, s.pack, id),
    owned,
    compute: Math.floor(getCompute(state, s.pack, id)),
    required: owned > 0 ? getComputeRequired(s.pack, owned) : 0,
    shortfall: Math.ceil(getComputeShortfall(state, s.pack, id)),
  };
}

/** Re-renders only when one of the shown numbers changes (compute moves with data centres, not every tick). */
export function useModelStatus(): ModelStatus {
  return useGameStore(useShallow(selectModelStatus));
}

interface NudgeStore {
  /** The owned tier whose "can't run it" nudge the player dismissed (0 = none). */
  dismissedFor: number;
  dismiss(owned: number): void;
}

/** The Trees nudge stays dismissed until the player owns a different model tier. */
export const useNudgeStore = create<NudgeStore>()((set) => ({
  dismissedFor: 0,
  dismiss: (owned) => set({ dismissedFor: owned }),
}));

/** True while the player owns a better model than they can run. */
export function isStuck(status: Pick<ModelStatus, 'owned' | 'running'>): boolean {
  return status.owned > status.running;
}
