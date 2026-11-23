import { createGame, type GameState, type NewsItem } from '@/engine';

import { getPackEntry } from '../../packs';
import { closeCall, closeCallText, endStats, isAboutLab, pickNotableHeadlines, playAgainSetup, rematchSetup } from '../logic';
import { setI18nContext } from '../../i18n';

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

describe('close call and rematch', () => {
  const ended = (edit: (s: GameState) => void, kind: 'win' | 'lose'): GameState => {
    const s = JSON.parse(JSON.stringify(createGame(pack, { ...SETUP, runLength: 'sprint' }))) as GameState;
    s.status = 'ended';
    s.ending = { endingId: kind === 'win' ? 'agi-aligned' : 'banned', kind, trigger: kind === 'win' ? 'agi' : 'banned', tick: 10, score: 1 };
    for (const id of s.labOrder) if (id !== s.playerLabId) s.labs[id].active = true;
    edit(s);
    setI18nContext(pack, s.labs);
    return s;
  };

  it('a win reports the nearest threat: a rival’s AGI or the highest meter', () => {
    const byRival = ended((s) => {
      s.labs.player.agiProgress = 100;
      const rival = s.labOrder[1];
      s.labs[rival].agiProgress = 92;
      s.labs.player.backlash = 40;
    }, 'win');
    const call = closeCall(byRival, pack);
    expect(call).toMatchObject({ kind: 'win', threat: { type: 'rivalAgi', labId: byRival.labOrder[1] }, near: true });
    expect(call.value).toBeCloseTo(0.92);
    expect(closeCallText(call)).toMatch(/^Close call: .*92%\.$/);

    const byMeter = ended((s) => {
      s.labs.player.backlash = 61;
      s.labs.player.regulation = 20;
    }, 'win');
    const meterCall = closeCall(byMeter, pack);
    expect(meterCall).toMatchObject({ kind: 'win', threat: { type: 'meter', meter: 'backlash' }, near: false });
    expect(closeCallText(meterCall)).toMatch(/^Comfortable: .*61%\.$/);
  });

  it('a loss reports the best win condition', () => {
    const lost = ended((s) => {
      s.labs.player.agiProgress = 85;
    }, 'lose');
    const call = closeCall(lost, pack);
    expect(call).toMatchObject({ kind: 'lose', goal: 'agi', near: true });
    expect(closeCallText(call)).toBe('So close: you were 85% of the way to AGI.');
    const far = ended((s) => {
      s.labs.player.agiProgress = 12;
      const rival = s.labOrder[1];
      s.labs[rival].eliminated = { reason: 'acquired', tick: 5, byLabId: 'player' };
      s.labs[rival].active = false;
    }, 'lose');
    const farCall = closeCall(far, pack);
    expect(farCall).toMatchObject({ kind: 'lose', goal: 'monopoly', near: false });
    expect(closeCallText(farCall)).toMatch(/^You got 25% of the way to a monopoly\.$/);
  });

  it('never reports NaN', () => {
    const s = ended((x) => (x.labs.player.agiProgress = Number.NaN), 'lose');
    expect(Number.isFinite(closeCall(s, pack).value)).toBe(true);
  });

  it('rematch keeps the seed and the whole setup; play again keeps the run length', () => {
    const s = ended(() => undefined, 'lose');
    expect(rematchSetup(s)).toMatchObject({ seed: 42, playerName: 'Moon Lab', founderId: 'hustler', homeRegion: 'canada', runLength: 'sprint', packId: pack.id });
    expect(createGame(pack, { ...rematchSetup(s), seed: rematchSetup(s).seed ?? -1 })).toEqual(createGame(pack, { ...SETUP, runLength: 'sprint' }));
    expect(playAgainSetup(s, () => 0.5)).toMatchObject({ runLength: 'sprint' });
  });
});
