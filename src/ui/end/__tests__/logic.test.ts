import { createGame, type GameState, type NewsItem } from '@/engine';

import { getPackEntry } from '../../packs';
import { endStats, isAboutLab, pickNotableHeadlines, playAgainSetup } from '../logic';

const { pack } = getPackEntry();
const SETUP = { playerName: 'Moon Lab', founderId: 'hustler', homeRegion: 'canada', seed: 42 };

function news(tick: number, textKey: string, tone: NewsItem['tone'], labId?: string, params?: NewsItem['params']): NewsItem {
  return { tick, textKey, tone, ...(labId ? { labId } : {}), ...(params ? { params } : {}) };
}

describe('pickNotableHeadlines', () => {
  it('keeps only news about the player', () => {
    expect(isAboutLab(news(1, 'a', 'good', 'player'), 'player')).toBe(true);
    expect(isAboutLab(news(1, 'a', 'good', 'overfit', { rival: 'player' }), 'player')).toBe(true);
    expect(isAboutLab(news(1, 'a', 'good', 'overfit', { lab: 'overfit' }), 'player')).toBe(false);
  });

  it('prefers good and bad news over neutral and routine notices, then returns them in order', () => {
    const items = [
      news(1, 'engine.news.launched', 'neutral', 'player'),
      news(2, 'h.flavour', 'neutral', 'player'),
      news(3, 'h.scandal', 'bad', 'player'),
      news(4, 'h.rival', 'bad', 'overfit'),
      news(5, 'engine.news.achievement', 'good', 'player'),
      news(6, 'h.win', 'good', 'player'),
    ];
    expect(pickNotableHeadlines(items, 'player', 3).map((n) => n.textKey)).toEqual(['h.flavour', 'h.scandal', 'h.win']);
    expect(pickNotableHeadlines(items, 'player').map((n) => n.tick)).toEqual([1, 2, 3, 5, 6]);
  });

  it('shows each headline once (the latest) and caps at 8', () => {
    const items: NewsItem[] = [];
    for (let i = 0; i < 20; i++) items.push(news(i, `h.${i % 12}`, 'bad', 'player'));
    const picked = pickNotableHeadlines(items, 'player');
    expect(picked).toHaveLength(8);
    expect(new Set(picked.map((n) => n.textKey)).size).toBe(8);
    expect(picked.map((n) => n.tick)).toEqual([12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('returns nothing when there is no news about the player', () => {
    expect(pickNotableHeadlines([news(1, 'x', 'bad', 'overfit')], 'player')).toEqual([]);
  });
});

describe('playAgainSetup', () => {
  it('keeps name, founder, home region and pack, with a new seed', () => {
    const state = createGame(pack, SETUP);
    const setup = playAgainSetup(state, () => 0.5);
    expect(setup).toMatchObject({ playerName: 'Moon Lab', founderId: 'hustler', homeRegion: 'canada', packId: pack.id });
    expect(setup.seed).toBe(Math.floor(0.5 * 0x7fffffff));
  });
  it('never repeats the old seed', () => {
    const state: GameState = { ...createGame(pack, SETUP), seed: 0 };
    expect(playAgainSetup(state, () => 0).seed).not.toBe(0);
  });
});

describe('endStats', () => {
  it('reads the player stats and ending day', () => {
    const base = createGame(pack, SETUP);
    const player = base.labs[base.playerLabId];
    const state: GameState = {
      ...base,
      status: 'ended',
      ending: { endingId: 'revolt', kind: 'lose', trigger: 'revolt', tick: 99, score: 10 },
      labs: { ...base.labs, [player.id]: { ...player, stats: { ...player.stats, nodesBought: 4, dataCentresBuilt: 2, eventsResolved: 7, peakWorldShare: 0.12 } } },
    };
    const stats = endStats(state, pack);
    expect(stats).toMatchObject({ days: 100, nodesBought: 4, dataCentresBuilt: 2, eventsResolved: 7, peakWorldShare: 0.12 });
    expect(stats.users).toBeGreaterThan(0);
    expect(stats.meters).toEqual(expect.objectContaining({ regulation: expect.any(Number), backlash: expect.any(Number), rival: expect.any(Number) }));
  });
});
