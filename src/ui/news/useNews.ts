import { create } from 'zustand';

import type { NewsItem } from '@/engine';

import { useGameStore, type GameStore } from '../store/game';
import { useTabStore } from '../shell/tabActive';
import { countUnread, sameNews } from './feed';

const EMPTY: NewsItem[] = [];
let cached: NewsItem[] = EMPTY;

/** The news log, keeping the same array while no item was added (the engine copies it every tick). */
function selectNews(s: GameStore): NewsItem[] {
  const next = s.state?.news ?? EMPTY;
  if (!sameNews(cached, next)) cached = next;
  return cached;
}

/** The news log; re-renders only when items arrive or drop out. */
export function useNewsLog(): NewsItem[] {
  return useTabStore(selectNews);
}

interface SeenStore {
  /** The newest item when the News tab was last open. */
  seen: NewsItem | null;
  markSeen(item: NewsItem | null): void;
}

/** Remembers how far the player has read, for the ticker's unread count. */
export const useNewsSeen = create<SeenStore>()((set) => ({
  seen: null,
  markSeen(item) {
    set({ seen: item });
  },
}));

/** Items since the News tab was last open. */
export function useUnreadCount(): number {
  const seen = useNewsSeen((s) => s.seen);
  return useGameStore((s) => countUnread(s.state?.news ?? EMPTY, seen));
}
