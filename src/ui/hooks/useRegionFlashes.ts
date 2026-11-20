import { useEffect, useState } from 'react';

import type { GameState, NewsItem, RegionId } from '@/engine';

import { useGameStore } from '../store/game';

export type FlashTone = 'good' | 'bad';
export const FLASH_MS = 1500;

/** Flash tone for a news item, or null when it should not flash. */
export function flashTone(item: NewsItem, playerId: string): FlashTone | null {
  if (!item.regionId) return null;
  if (item.tone === 'bad') return 'bad';
  if (item.tone === 'good' || item.labId === playerId) return 'good';
  return null;
}

/** News items in `next` that were not in `prev` (items are shared between states, so identity works). */
export function freshNews(prev: GameState | null, next: GameState | null): NewsItem[] {
  if (!next || next.news.length === 0 || prev?.news === next.news) return [];
  if (!prev || prev.seed !== next.seed) return [];
  const last = prev.news[prev.news.length - 1];
  const start = last ? next.news.lastIndexOf(last) + 1 : 0;
  return next.news.slice(start);
}

/**
 * Regions currently flashing because a news item with a regionId arrived:
 * bad news red, good news green, neutral news green only when it is about the player.
 */
export function useRegionFlashes(): Record<RegionId, FlashTone> {
  const [flashes, setFlashes] = useState<Record<RegionId, FlashTone>>({});

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.state === prev.state) return;
      const fresh: Record<RegionId, FlashTone> = {};
      for (const item of freshNews(prev.state, s.state)) {
        const tone = s.state ? flashTone(item, s.state.playerLabId) : null;
        if (tone && item.regionId) fresh[item.regionId] = tone;
      }
      const ids = Object.keys(fresh);
      if (ids.length === 0) return;
      setFlashes((current) => ({ ...current, ...fresh }));
      const timer = setTimeout(() => {
        timers.delete(timer);
        setFlashes((current) => {
          const next = { ...current };
          for (const id of ids) if (next[id] === fresh[id]) delete next[id];
          return next;
        });
      }, FLASH_MS);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);

  return flashes;
}
