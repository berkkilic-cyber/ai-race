import { useShallow } from 'zustand/react/shallow';

import {
  getCapabilityLevel,
  getCompute,
  getIncome,
  getMeters,
  getUsers,
  getWorldShare,
  type ContentPack,
  type GameState,
  type LabState,
  type Meters,
} from '@/engine';

import { getPackEntry, type PackEntry } from '../packs';
import { useGameStore } from '../store/game';

export function useGameState(): GameState | null {
  return useGameStore((s) => s.state);
}

export function usePack(): ContentPack {
  return useGameStore((s) => s.pack);
}

/** The current pack with its map geometry. */
export function usePackEntry(): PackEntry {
  const packId = useGameStore((s) => s.packId);
  return getPackEntry(packId);
}

export function useDispatch() {
  return useGameStore((s) => s.dispatch);
}

/** The player's lab, or null before a run. Re-renders every tick. */
export function usePlayer(): LabState | null {
  return useGameStore((s) => (s.state ? s.state.labs[s.state.playerLabId] : null));
}

export function useTick(): number {
  return useGameStore((s) => s.state?.tick ?? 0);
}

export function useMeters(): Meters {
  return useGameStore(
    useShallow((s) => (s.state ? getMeters(s.state, s.state.playerLabId) : { regulation: 0, backlash: 0, rival: 0 })),
  );
}

export interface PlayerResources {
  hype: number;
  cash: number;
  /** Net cash per tick (a tick is a day). */
  cashPerDay: number;
  hypePerDay: number;
  compute: number;
  /** Effective model tier. */
  tier: number;
  /** Millions. */
  users: number;
  worldShare: number;
}

const NO_RESOURCES: PlayerResources = { hype: 0, cash: 0, cashPerDay: 0, hypePerDay: 0, compute: 0, tier: 0, users: 0, worldShare: 0 };

export function useResources(): PlayerResources {
  return useGameStore(
    useShallow((s) => {
      const state = s.state;
      if (!state) return NO_RESOURCES;
      const id = state.playerLabId;
      const lab = state.labs[id];
      const income = getIncome(state, s.pack, id);
      return {
        hype: lab.hype,
        cash: lab.cash,
        cashPerDay: income.cash,
        hypePerDay: income.hype,
        compute: getCompute(state, s.pack, id),
        tier: getCapabilityLevel(state, s.pack, id),
        users: getUsers(state, s.pack, id),
        worldShare: getWorldShare(state, s.pack, id),
      };
    }),
  );
}
