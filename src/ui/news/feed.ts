import type { LabId, NewsItem } from '@/engine';

export type NewsFilter = 'all' | 'you' | 'rivals' | 'world';
export const NEWS_FILTERS: readonly NewsFilter[] = ['all', 'you', 'rivals', 'world'];

/** Who a news item is about: the player, another lab, or nobody (world news). */
export function matchesFilter(item: NewsItem, filter: NewsFilter, playerId: LabId): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'you':
      return item.labId === playerId;
    case 'rivals':
      return item.labId !== undefined && item.labId !== playerId;
    case 'world':
      return item.labId === undefined;
  }
}

export type NewsRow = { kind: 'day'; key: string; tick: number } | { kind: 'item'; key: string; item: NewsItem };

const keys = new WeakMap<NewsItem, string>();
let nextKey = 1;

/**
 * Stable list key for a news item. Items are never mutated and are shared between
 * states, so identity is stable even when the capped log drops old items.
 */
export function newsKey(item: NewsItem): string {
  let key = keys.get(item);
  if (!key) {
    key = `n${nextKey++}`;
    keys.set(item, key);
  }
  return key;
}

/** Filtered news, newest first, with a day header row before each new day. */
export function buildNewsRows(news: readonly NewsItem[], filter: NewsFilter, playerId: LabId): NewsRow[] {
  const rows: NewsRow[] = [];
  let day: number | null = null;
  for (let i = news.length - 1; i >= 0; i--) {
    const item = news[i];
    if (!matchesFilter(item, filter, playerId)) continue;
    if (item.tick !== day) {
      day = item.tick;
      rows.push({ kind: 'day', key: `d${item.tick}`, tick: item.tick });
    }
    rows.push({ kind: 'item', key: newsKey(item), item });
  }
  return rows;
}

/** Items that arrived after `seen` (the newest item when News was last open). All of them if `seen` has dropped out of the log. */
export function countUnread(news: readonly NewsItem[], seen: NewsItem | null): number {
  if (!seen) return news.length;
  const index = news.lastIndexOf(seen);
  return index < 0 ? news.length : news.length - 1 - index;
}

/** True when two news logs hold the same items (the engine copies the array every tick). */
export function sameNews(a: readonly NewsItem[], b: readonly NewsItem[]): boolean {
  return a === b || (a.length === b.length && a[0] === b[0] && a[a.length - 1] === b[b.length - 1]);
}
