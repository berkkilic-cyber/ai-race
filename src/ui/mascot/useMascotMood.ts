import { useEffect, useState } from 'react';

import { getWorldShare } from '@/engine';

import { useComposure } from '../composure';
import { freshNews } from '../hooks/useRegionFlashes';
import { useGameStore } from '../store/game';
import { mascotMood, MOOD_MEMORY_MS, type MascotMood } from './mood';

/** True while the player's world share is the largest of all active labs (and above zero). */
function useLeading(): boolean {
  return useGameStore((s) => {
    const state = s.state;
    if (!state) return false;
    const mine = getWorldShare(state, s.pack, state.playerLabId);
    if (mine <= 0) return false;
    for (const id of state.labOrder) {
      if (id === state.playerLabId || !state.labs[id].active) continue;
      if (getWorldShare(state, s.pack, id) >= mine) return false;
    }
    return true;
  });
}

/** Remembers news about the player and purchases for MOOD_MEMORY_MS. */
function useRecentReactions(): { news: 'good' | 'bad' | null; purchase: boolean } {
  const [news, setNews] = useState<'good' | 'bad' | null>(null);
  const [purchase, setPurchase] = useState(false);
  useEffect(() => {
    let newsTimer: ReturnType<typeof setTimeout> | undefined;
    let buyTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (!s.state || !prev.state || s.state === prev.state || s.state.seed !== prev.state.seed) return;
      const me = s.state.labs[s.state.playerLabId];
      const before = prev.state.labs[prev.state.playerLabId];
      if (me !== before && me.stats.nodesBought + me.stats.dataCentresBuilt > before.stats.nodesBought + before.stats.dataCentresBuilt) {
        setPurchase(true);
        clearTimeout(buyTimer);
        buyTimer = setTimeout(() => setPurchase(false), MOOD_MEMORY_MS);
      }
      let tone: 'good' | 'bad' | null = null;
      for (const item of freshNews(prev.state, s.state)) {
        if (item.labId !== s.state.playerLabId) continue;
        if (item.tone === 'bad') tone = 'bad';
        else if (item.tone === 'good' && tone === null) tone = 'good';
      }
      if (tone) {
        setNews(tone);
        clearTimeout(newsTimer);
        newsTimer = setTimeout(() => setNews(null), MOOD_MEMORY_MS);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(newsTimer);
      clearTimeout(buyTimer);
    };
  }, []);
  return { news, purchase };
}

/** The mascot's mood in the game shell: pause, composure, recent news and purchases, the race lead. */
export function useMascotMood(): MascotMood {
  const paused = useGameStore((s) => s.speed === 0);
  const { level } = useComposure();
  const leading = useLeading();
  const recent = useRecentReactions();
  return mascotMood({ paused, level, recentNews: recent.news, recentPurchase: recent.purchase, leading });
}
