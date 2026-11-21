import { createGame, getStandings, step, type GameState, type StandingRow } from '@/engine';

import { setI18nContext } from '../../i18n';
import { getPackEntry } from '../../packs';
import { raceView, rivalDetail, sortRows, statusOf } from '../logic';
import { addSample, MAX_SAMPLES, trendOf, type ShareSample } from '../trend';

const pack = getPackEntry().pack;

function game(ticks = 0): GameState {
  let state = createGame(pack, { playerName: 'Test Lab', founderId: pack.founders[0].id, homeRegion: 'usa', seed: 5 });
  for (let i = 0; i < ticks; i++) state = step(state, pack);
  return state;
}

beforeAll(() => setI18nContext(pack, null));

const row = (patch: Partial<StandingRow>): StandingRow => ({
  labId: 'x',
  name: 'x',
  status: 'active',
  worldShare: 0,
  users: 0,
  agi: 0,
  tier: 0,
  ownedTier: 0,
  compute: 0,
  dataCentres: 0,
  bannedRegions: 0,
  homeRegion: 'usa',
  ...patch,
});

describe('statusOf', () => {
  it('names every status', () => {
    expect(statusOf(row({})).text).toBe('Active');
    expect(statusOf(row({ bannedRegions: 3 }))).toEqual({ text: 'Banned in 3', tone: 'bad', out: false });
    expect(statusOf(row({ status: 'pending' })).text).toBe('Not yet entered');
    expect(statusOf(row({ status: 'eliminated', eliminatedReason: 'acquired' }))).toEqual({ text: 'Bought out', tone: 'dim', out: true });
    expect(statusOf(row({ status: 'eliminated', eliminatedReason: 'banned' })).text).toBe('Eliminated');
    expect(statusOf(row({ status: 'eliminated', eliminatedReason: 'revolt' })).text).toBe('Toppled');
  });
});

describe('sortRows', () => {
  const rows = [
    { id: 'a', isPlayer: false },
    { id: 'me', isPlayer: true },
    { id: 'b', isPlayer: false },
  ];
  it('keeps the standings order by world share', () => {
    expect(sortRows(rows, 'share').map((r) => r.id)).toEqual(['a', 'me', 'b']);
  });
  it('puts the player first, the rest in standings order', () => {
    expect(sortRows(rows, 'you').map((r) => r.id)).toEqual(['me', 'a', 'b']);
  });
});

describe('raceView', () => {
  it('has one row per lab in getStandings order, the player marked', () => {
    const state = game(40);
    const view = raceView(state, pack, []);
    expect(view.rows.map((r) => r.labId)).toEqual(getStandings(state, pack).map((r) => r.labId));
    expect(view.rows.filter((r) => r.isPlayer).map((r) => r.labId)).toEqual([state.playerLabId]);
  });

  it('shows the three ways to win with plain captions', () => {
    const view = raceView(game(), pack, []);
    expect(view.wins.map((w) => w.id)).toEqual(['agi', 'dependence', 'monopoly']);
    expect(view.wins[1].caption).toContain('45%');
    expect(view.wins[2].caption).toBe(`Buy out or outlast every rival. ${pack.rivals.length} of ${pack.rivals.length} left`);
    for (const w of view.wins) expect(w.caption).not.toMatch(/[{}]/);
  });

  it('marks an owned tier above the running one', () => {
    const state = game();
    const me = { ...state.labs[state.playerLabId], ownedNodes: ['cap-model-1', 'cap-model-2', 'cap-model-3'] };
    const view = raceView({ ...state, labs: { ...state.labs, [me.id]: me } }, pack, []);
    const mine = view.rows.find((r) => r.isPlayer);
    expect(mine?.tierText).toBe('T0');
    expect(mine?.ownedText).toBe('owns 3');
  });
});

describe('rivalDetail', () => {
  it('explains why the player cannot buy a rival out yet', () => {
    const state = game(5);
    const rival = state.labOrder.find((id) => id !== state.playerLabId && state.labs[id].active);
    expect(rival).toBeDefined();
    const detail = rivalDetail(state, pack, rival as string);
    expect(detail?.buyout.ok).toBe(false);
    expect(detail?.buyout.text).toMatch(/upgrade \(Shadow tree\)/);
  });

  it('offers the buyout with its price once the player can afford it', () => {
    const state = game(5);
    const rival = state.labOrder.find((id) => id !== state.playerLabId && state.labs[id].active) as string;
    const me = { ...state.labs[state.playerLabId], ownedNodes: ['shadow-benchmarks', 'shadow-lobbying', 'shadow-ma-team'], cash: 1e6 };
    const detail = rivalDetail({ ...state, labs: { ...state.labs, [me.id]: me } }, pack, rival);
    expect(detail?.buyout.ok).toBe(true);
    expect(detail?.buyout.ok && detail.buyout.price).toMatch(/^\$/);
  });

  it('is null for the player', () => {
    const state = game();
    expect(rivalDetail(state, pack, state.playerLabId)).toBeNull();
  });
});

describe('share trend', () => {
  const s = (tick: number, share: number): ShareSample => ({ tick, shares: { a: share } });

  it('samples every few ticks and stays bounded', () => {
    let buf: ShareSample[] = [];
    for (let tick = 0; tick < 300; tick++) buf = addSample(buf, s(tick, tick / 1000));
    expect(buf.length).toBeLessThanOrEqual(MAX_SAMPLES);
    for (let i = 1; i < buf.length; i++) expect(buf[i].tick - buf[i - 1].tick).toBeGreaterThanOrEqual(3);
  });

  it('restarts when time goes backwards (a new run)', () => {
    expect(addSample([s(100, 0.1)], s(2, 0))).toEqual([s(2, 0)]);
  });

  it('compares with the share about 30 ticks ago', () => {
    const buf = [s(60, 0.1), s(72, 0.12), s(90, 0.2)];
    expect(trendOf(buf, 'a', 0.13, 100)).toBe('up');
    expect(trendOf(buf, 'a', 0.08, 100)).toBe('down');
    expect(trendOf(buf, 'a', 0.1203, 100)).toBe('flat');
    expect(trendOf([], 'a', 0.5, 100)).toBe('flat');
  });
});
