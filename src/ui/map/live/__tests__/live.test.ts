import { createGame, getReachableRegions, type GameState, type NewsItem } from '@/engine';

import { setI18nContext } from '../../../i18n';
import { getPackEntry } from '../../../packs';
import { TouchController } from '../../touchController';
import { toScreenPoint, type Layout } from '../../viewTransform';
import { MAP_LIVE_CONFIGS, channelIcon, mapLiveConfig } from '../config';
import { MAX_RACKS, objectItems, objectsKey, parseObjectsKey, placeSites, rackIcon } from '../objects';
import { TapTargets, edgePoint } from '../targets';
import { reachText } from '../reach';
import { arcControl, bezier, routeFor } from '../routes';

const { pack, geometry } = getPackEntry();
setI18nContext(pack, null);
const config = mapLiveConfig(pack.id);
const L: Layout = { cw: 800, ch: 330, mw: geometry.width, mh: geometry.height };

function game(seed = 4): GameState {
  return createGame(pack, { playerName: 'T', founderId: pack.founders[0].id, homeRegion: 'usa', seed });
}

describe('live map config', () => {
  it('names only nodes and icons that exist', () => {
    const nodeIds = new Set(pack.nodes.map((n) => n.id));
    for (const id of Object.keys(MAP_LIVE_CONFIGS['ai-lab'].objects)) expect(nodeIds.has(id)).toBe(true);
    for (const c of pack.channels ?? []) expect(channelIcon(config, c.id)).toMatch(/^channel-/);
  });
});

describe('objects on the map', () => {
  it('lays rack chips in a centred row, the player first, with an overflow count', () => {
    const sites = [1, 2, 3, 1, 2].map((level, i) => ({ key: `k${i}`, labId: i === 4 ? 'me' : 'r', level, online: true, mine: i === 4 }));
    const { placed, more } = placeSites(sites);
    expect(placed.length).toBe(MAX_RACKS);
    expect(more).toBe(1);
    expect(placed[0].mine).toBe(true);
    expect(placed[0].dx + placed[placed.length - 1].dx).toBeCloseTo(0);
    expect([rackIcon(1), rackIcon(2), rackIcon(3), rackIcon(5)]).toEqual(['rack-1', 'rack-2', 'rack-3', 'rack-3']);
  });

  it('places node objects by the pack rules: robots in strong regions, lobbyists in strict ones', () => {
    const s = game();
    const me = s.labs[s.playerLabId];
    expect(objectItems(s, pack, config)).toEqual([]);
    me.adoption = { usa: 0.3, canada: 0.2, mexico: 0.01, france: 0.005 };
    me.ownedNodes = [...me.ownedNodes, 'cap-robotics', 'shadow-lobbying', 'shadow-capture'];
    const items = objectItems(s, pack, config);
    expect(items.filter((i) => i.icon === 'robot').map((i) => i.regionId)).toEqual(['usa', 'canada', 'mexico']);
    // Lobbying (2) and capture (4) share an icon: the larger count wins, strictest first.
    const lobby = items.filter((i) => i.icon === 'lobbyist').map((i) => i.regionId);
    expect(lobby.length).toBe(4);
    const strict = (id: string) => pack.regions.find((r) => r.id === id)!.strictness;
    expect(strict(lobby[0])).toBeGreaterThanOrEqual(strict(lobby[1]));
    expect(parseObjectsKey(objectsKey(items))).toEqual(items);
  });
});

describe('routes', () => {
  const entry = (labId: string, from: string, to: string, channel: string): NewsItem => ({ tick: 1, kind: 'entry', textKey: 'x', tone: 'good', params: { lab: labId, region: to, from, channel }, regionId: to, labId });

  it('always draws the player, and rivals only into the player or across an ocean', () => {
    const s = game();
    const rival = s.labOrder.find((id) => id !== s.playerLabId)!;
    const ocean = pack.regions.find((r) => Object.values(r.linkBarriers ?? {}).some((b) => b.includes('ocean')))!;
    const over = Object.entries(ocean.linkBarriers!).find(([, b]) => b.includes('ocean'))![0];
    expect(routeFor(entry(s.playerLabId, 'usa', 'mexico', 'language:spanish'), s, pack, config)).toMatchObject({ mine: true, style: 'plain', icon: 'channel-language' });
    expect(routeFor(entry(rival, 'usa', 'mexico', 'language:spanish'), s, pack, config)).toBeNull();
    expect(routeFor(entry(rival, ocean.id, over, 'ocean'), s, pack, config)).toMatchObject({ mine: false, style: 'crossing', icon: 'channel-ocean' });
    expect(routeFor(entry(s.playerLabId, 'usa', 'brazil', 'viral'), s, pack, config)?.style).toBe('viral');
    expect(routeFor({ tick: 1, kind: 'entry', textKey: 'x', tone: 'neutral', params: { lab: rival, region: 'usa' }, regionId: 'usa' }, s, pack, config)).toBeNull();
  });

  it('bends arcs upward and higher for crossings', () => {
    const a: [number, number] = [0, 100];
    const b: [number, number] = [100, 100];
    const plain = arcControl(a, b, 'plain');
    const crossing = arcControl(a, b, 'crossing');
    expect(plain[1]).toBeLessThan(100);
    expect(crossing[1]).toBeLessThan(plain[1]);
    expect(bezier(0, 0, 100, ...plain, 100, 100)).toEqual([0, 100]);
    expect(bezier(1, 0, 100, ...plain, 100, 100)).toEqual([100, 100]);
  });
});

describe('tap targets', () => {
  it('hits the nearest target within its radius, and an off-screen one through its edge indicator', () => {
    const t = new TapTargets();
    const taps: string[] = [];
    const v = { s: 1, tx: 0, ty: 0 };
    const usa = geometry.regions.usa.centroid;
    t.set('a', { mx: usa[0], my: usa[1], dx: 0, dy: -36, r: 30, onTap: () => taps.push('a'), onEdgeTap: () => taps.push('edge-a') });
    const [sx, sy] = toScreenPoint(L, 1, 0, 0, usa[0], usa[1]);
    expect(t.hit(L, v, sx, sy - 36)?.id).toBe('a');
    expect(t.hit(L, v, sx, sy - 36 + 31)).toBeNull();
    // Pan the point far off the left edge: the indicator stands for it.
    const away = { s: 4, tx: 3000, ty: 0 };
    const [ox, oy] = toScreenPoint(L, 4, 3000, 0, usa[0], usa[1]);
    const at = edgePoint(ox, oy - 36, L.cw, L.ch)!;
    expect(at).not.toBeNull();
    const hit = t.hit(L, away, at[0], at[1])!;
    expect(hit.edge).toBe(true);
    t.delete('a');
    expect(t.hit(L, v, sx, sy - 36)).toBeNull();
  });

  it('a claimed tap is never part of a double tap', () => {
    const taps: number[] = [];
    let doubles = 0;
    const c = new TouchController({
      layout: () => L,
      view: () => ({ s: 1, tx: 0, ty: 0 }),
      setView: () => undefined,
      tap: (x) => taps.push(x),
      doubleTap: () => doubles++,
      claimsTap: (x) => x < 100,
    });
    const tap = (x: number, t: number) => {
      c.begin([{ id: 1, x, y: 50 }], t);
      c.release({ id: 1, x, y: 50 }, t + 50);
    };
    tap(50, 0);
    tap(52, 150);
    expect(taps).toEqual([50, 52]);
    expect(doubles).toBe(0);
    tap(300, 1000);
    tap(302, 1150);
    expect(doubles).toBe(1);
  });
});

describe('reach note', () => {
  it('says what blocks a region and which nodes unlock it, or that it is next', () => {
    const s = game();
    const rows = getReachableRegions(s, pack, s.playerLabId);
    const blocked = rows.find((r) => r.blockedBy && r.blockedBy.length === 1 && (r.unlockedBy?.[r.blockedBy[0]] ?? []).length > 0)!;
    const text = reachText(blocked, pack)!;
    expect(text.kind).toBe('blocked');
    expect(text.lines[0]).toMatch(/^Blocked by /);
    expect(text.lines[1]).toMatch(/lets you cross\.$/);
    const next = rows.find((r) => r.reachable && !r.present);
    if (next) expect(reachText(next, pack)?.kind).toBe('next');
    expect(reachText(rows.find((r) => r.present), pack)).toBeNull();
  });
});
