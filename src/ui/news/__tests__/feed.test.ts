import type { NewsItem } from '@/engine';

import { buildNewsRows, countUnread, matchesFilter, newsKey, sameNews } from '../feed';

const item = (tick: number, labId?: string, textKey = `k${tick}`): NewsItem => ({ tick, textKey, tone: 'neutral', ...(labId ? { labId } : {}) });

const you = item(10, 'player', 'a');
const rival = item(10, 'rival-1', 'b');
const world = item(12, undefined, 'c');
const rival2 = item(15, 'rival-2', 'd');
const NEWS = [you, rival, world, rival2];

describe('matchesFilter', () => {
  it('splits by labId: the player, another lab, or none', () => {
    expect(NEWS.filter((n) => matchesFilter(n, 'all', 'player'))).toEqual(NEWS);
    expect(NEWS.filter((n) => matchesFilter(n, 'you', 'player'))).toEqual([you]);
    expect(NEWS.filter((n) => matchesFilter(n, 'rivals', 'player'))).toEqual([rival, rival2]);
    expect(NEWS.filter((n) => matchesFilter(n, 'world', 'player'))).toEqual([world]);
  });
});

describe('buildNewsRows', () => {
  it('lists newest first with a header before each day', () => {
    const rows = buildNewsRows(NEWS, 'all', 'player');
    expect(rows.map((r) => (r.kind === 'day' ? `day ${r.tick}` : r.item.textKey))).toEqual(['day 15', 'd', 'day 12', 'c', 'day 10', 'b', 'a']);
  });

  it('only adds headers for days with matching items', () => {
    const rows = buildNewsRows(NEWS, 'rivals', 'player');
    expect(rows.map((r) => (r.kind === 'day' ? `day ${r.tick}` : r.item.textKey))).toEqual(['day 15', 'd', 'day 10', 'b']);
    expect(buildNewsRows(NEWS, 'world', 'nobody').length).toBe(2);
  });

  it('is empty for an empty log or no matches', () => {
    expect(buildNewsRows([], 'all', 'player')).toEqual([]);
    expect(buildNewsRows([rival], 'you', 'player')).toEqual([]);
  });

  it('gives unique keys that stay the same when old items drop out', () => {
    const first = buildNewsRows(NEWS, 'all', 'player');
    const keys = first.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    const later = buildNewsRows([rival, world, rival2, item(20)], 'all', 'player');
    const keyOf = (rows: typeof first, n: NewsItem) => rows.find((r) => r.kind === 'item' && r.item === n)?.key;
    expect(keyOf(later, world)).toBe(keyOf(first, world));
    expect(newsKey(world)).toBe(keyOf(first, world));
  });
});

describe('countUnread', () => {
  it('counts items after the last one seen', () => {
    expect(countUnread(NEWS, rival2)).toBe(0);
    expect(countUnread(NEWS, rival)).toBe(2);
    expect(countUnread(NEWS, null)).toBe(4);
  });

  it('counts everything when the seen item dropped out of the log', () => {
    expect(countUnread([world, rival2], you)).toBe(2);
  });
});

describe('sameNews', () => {
  it('treats a copied array with the same items as the same log', () => {
    expect(sameNews(NEWS, NEWS.slice())).toBe(true);
    expect(sameNews(NEWS, [...NEWS, item(30)])).toBe(false);
    expect(sameNews(NEWS, [rival, world, rival2, item(31)])).toBe(false);
    expect(sameNews([], [])).toBe(true);
  });
});
