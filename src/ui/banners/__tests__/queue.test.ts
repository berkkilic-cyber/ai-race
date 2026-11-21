import { createGame, type NewsItem } from '@/engine';

import { getPackEntry } from '../../packs';
import { BANNER_STALE_MS, MAX_QUEUE, bannerFor, enqueue, nextBanner, type LaunchBanner } from '../queue';

const { pack } = getPackEntry();
const state = createGame(pack, { playerName: 'T', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed: 2 });
const rival = state.labOrder.find((id) => id !== state.playerLabId)!;

const launch = (labId: string, tier: number): NewsItem => ({ tick: 1, kind: 'launch', tier, textKey: 'x', tone: 'bad', params: { lab: labId, model: 'node.m.name', tier }, labId, regionId: 'r' });

describe('launch banners', () => {
  it('turns only launch news into banners, with how far a rival is ahead', () => {
    expect(bannerFor({ tick: 1, kind: 'headline', textKey: 'x', tone: 'neutral' }, state, 1, 1, 0)).toBeNull();
    const b = bannerFor(launch(rival, 3), state, 1, 1, 0)!;
    expect(b).toMatchObject({ labId: rival, mine: false, modelKey: 'node.m.name', tier: 3, ahead: 2 });
    expect(bannerFor(launch(rival, 1), state, 2, 1, 0)!.ahead).toBe(0);
    expect(bannerFor(launch(state.playerLabId, 2), state, 2, 1, 0)).toMatchObject({ mine: true, ahead: 0 });
  });

  it('shows one at a time in order, the player first, never more than the cap', () => {
    const mk = (id: number, mine = false): LaunchBanner => ({ id, labId: 'l', mine, modelKey: '', tier: 1, ahead: 0, at: 0 });
    let q: LaunchBanner[] = [];
    q = enqueue(q, mk(1));
    q = enqueue(q, mk(2));
    q = enqueue(q, mk(3, true));
    expect(q.map((b) => b.id)).toEqual([3, 1, 2]);
    for (let i = 4; i < 10; i++) q = enqueue(q, mk(i));
    expect(q.length).toBe(MAX_QUEUE);
    const { show, rest } = nextBanner(q, 10);
    expect(show?.id).toBe(3);
    expect(rest.length).toBe(MAX_QUEUE - 1);
  });

  it('drops banners that waited too long', () => {
    const old: LaunchBanner = { id: 1, labId: 'l', mine: false, modelKey: '', tier: 1, ahead: 0, at: 0 };
    expect(nextBanner([old], BANNER_STALE_MS + 1)).toEqual({ show: null, rest: [] });
  });
});
