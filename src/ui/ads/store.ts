import { create } from 'zustand';

import { readValue, writeValue } from '../tutorial/storage';
import { PLACEMENTS, type AdResult, type PlacementId, type PlacementStats } from './types';

const KEY = 'garage.ads.v1';

export interface MockAdRequest {
  id: number;
  placement: PlacementId;
  reward: string;
  /** When the test ad opened (ms). */
  startedAt: number;
  resolve: (result: AdResult) => void;
}

export interface AdStore {
  /** Ads removed (the future purchase; a test switch for now): rewards are granted without an ad. */
  adsRemoved: boolean;
  /** Local counters per placement, so the owner can see how often each comes up. */
  stats: Record<PlacementId, PlacementStats>;
  /** The test ad on screen, if any (the mock provider's host shows it). */
  mock: MockAdRequest | null;
  loaded: boolean;
  load(): Promise<void>;
  setAdsRemoved(on: boolean): void;
  count(placement: PlacementId, field: keyof PlacementStats): void;
}

export function emptyPlacementStats(): Record<PlacementId, PlacementStats> {
  const out = {} as Record<PlacementId, PlacementStats>;
  for (const p of PLACEMENTS) out[p] = { requested: 0, shown: 0, rewarded: 0, dismissed: 0, unavailable: 0, granted: 0 };
  return out;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist(s: Pick<AdStore, 'adsRemoved' | 'stats'>): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void writeValue(KEY, JSON.stringify({ adsRemoved: s.adsRemoved, stats: s.stats }));
  }, 400);
}

export const useAdStore = create<AdStore>()((set, get) => ({
  adsRemoved: false,
  stats: emptyPlacementStats(),
  mock: null,
  loaded: false,
  async load() {
    if (get().loaded) return;
    const text = await readValue(KEY);
    const stats = emptyPlacementStats();
    let adsRemoved = false;
    try {
      const raw = text ? (JSON.parse(text) as { adsRemoved?: unknown; stats?: Record<string, Partial<PlacementStats>> }) : null;
      adsRemoved = raw?.adsRemoved === true;
      for (const p of PLACEMENTS) {
        const r = raw?.stats?.[p];
        if (r) for (const k of Object.keys(stats[p]) as (keyof PlacementStats)[]) stats[p][k] = Number.isFinite(r[k]) ? Number(r[k]) : 0;
      }
    } catch {
      // unreadable: start counting again
    }
    set({ adsRemoved, stats, loaded: true });
  },
  setAdsRemoved(on) {
    set({ adsRemoved: on });
    persist(get());
  },
  count(placement, field) {
    const stats = { ...get().stats, [placement]: { ...get().stats[placement], [field]: get().stats[placement][field] + 1 } };
    set({ stats });
    persist(get());
  },
}));
