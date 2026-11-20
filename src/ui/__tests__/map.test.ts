import { createGame, type GameState, type NewsItem } from '@/engine';

import { flashTone, freshNews } from '../hooks/useRegionFlashes';
import { bannedKey, bucketOwners, mixColor, newPresences, parseSites, regionDotColors, regionFills, sitesKey } from '../map/mapColors';
import { createHitTester, parseRings } from '../map/hitTest';
import { clampTranslate, centreOn, fitWorld, toMapPoint, toScreenPoint, zoomAbout, type Layout } from '../map/viewTransform';
import { getPackEntry } from '../packs';
import { colors } from '../theme';

const { pack } = getPackEntry();
const ids = pack.regions.map((r) => r.id);

function game(): GameState {
  return createGame(pack, { playerName: 'P', founderId: pack.founders[0].id, homeRegion: 'canada', seed: 3 });
}

describe('map colours', () => {
  it('mixColor blends hex colours', () => {
    expect(mixColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColor('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('untouched regions use the raised colour, others lean to the leader colour', () => {
    const s = game();
    const fills = regionFills(s, ids);
    expect(fills['india']).toBe(colors.raised);
    expect(fills['canada']).not.toBe(colors.raised);
    const strong: GameState = { ...s, labs: { ...s.labs, player: { ...s.labs.player, adoption: { canada: 0.9 } } } };
    const weakDist = Math.abs(parseInt(fills['canada'].slice(1, 3), 16) - parseInt(colors.player.slice(1, 3), 16));
    const strongFill = regionFills(strong, ids)['canada'];
    const strongDist = Math.abs(parseInt(strongFill.slice(1, 3), 16) - parseInt(colors.player.slice(1, 3), 16));
    expect(strongDist).toBeLessThan(weakDist);
  });

  it('bannedKey lists active bans of the player', () => {
    const s = game();
    const banned: GameState = { ...s, labs: { ...s.labs, player: { ...s.labs.player, bans: { usa: -1, mexico: s.tick + 5, japan: s.tick } } } };
    expect(bannedKey(banned)).toBe('mexico|usa');
  });

  it('sitesKey round-trips through parseSites with online state', () => {
    const s = game();
    const withSites: GameState = {
      ...s,
      tick: 10,
      labs: { ...s.labs, player: { ...s.labs.player, dataCentres: [{ id: 'dc1', regionId: 'canada', level: 2 }, { id: 'dc2', regionId: 'canada', level: 1, disabledUntilTick: 20 }] } },
    };
    const sites = parseSites(sitesKey(withSites), 'player', () => '#123456');
    expect(sites).toEqual([
      { key: 'player:dc1', regionId: 'canada', color: '#123456', level: 2, online: true, mine: true },
      { key: 'player:dc2', regionId: 'canada', color: '#123456', level: 1, online: false, mine: true },
    ]);
  });
});

describe('dot matrix colours', () => {
  it('bucketOwners lights round(share x buckets) buckets per lab, biggest share first, at least one when present', () => {
    expect(bucketOwners([], 4)).toEqual([null, null, null, null]);
    expect(bucketOwners([{ id: 'a', share: 0.5 }], 4)).toEqual(['a', 'a', null, null]);
    expect(bucketOwners([{ id: 'a', share: 0.01 }], 10)).toEqual(['a', ...Array(9).fill(null)]);
    expect(bucketOwners([{ id: 'small', share: 0.2 }, { id: 'big', share: 0.6 }], 10)).toEqual(['big', 'big', 'big', 'big', 'big', 'big', 'small', 'small', null, null]);
    // Too tiny to show.
    expect(bucketOwners([{ id: 'a', share: 0.0001 }], 4)).toEqual([null, null, null, null]);
  });

  it('bucketOwners never hands out more buckets than exist', () => {
    const owners = bucketOwners([{ id: 'a', share: 0.62 }, { id: 'b', share: 0.36 }, { id: 'c', share: 0.02 }], 12);
    expect(owners).toHaveLength(12);
    expect(owners.filter((o) => o === 'c')).toHaveLength(1);
    expect(owners.filter((o) => o === null)).toHaveLength(0);
  });

  it('regionDotColors: unlit dots rest, banned regions drop to dark, colour strings change only with the share', () => {
    const s = game();
    const colorOf = (id: string) => (id === 'player' ? '#aaaaaa' : '#bbbbbb');
    const base = regionDotColors(s, ids, 12, colorOf);
    expect(base['india'].split(',')).toEqual(Array(12).fill(colors.dotRest));
    expect(base['canada'].split(',')[0]).toBe('#aaaaaa');
    // A tiny change in adoption that crosses no bucket threshold keeps the same string.
    const a = s.labs.player.adoption.canada ?? 0;
    const nudged: GameState = { ...s, labs: { ...s.labs, player: { ...s.labs.player, adoption: { ...s.labs.player.adoption, canada: a + 0.0001 } } } };
    expect(regionDotColors(nudged, ids, 12, colorOf)['canada']).toBe(base['canada']);
    const banned: GameState = { ...s, labs: { ...s.labs, player: { ...s.labs.player, bans: { india: -1 } } } };
    expect(regionDotColors(banned, ids, 12, colorOf)['india'].split(',')).toEqual(Array(12).fill(colors.dotBanned));
  });

  it('newPresences lists labs that gained a foothold since the previous state', () => {
    const s = game();
    const next: GameState = { ...s, labs: { ...s.labs, player: { ...s.labs.player, adoption: { ...s.labs.player.adoption, usa: 0.01 } } } };
    expect(newPresences(s, next)).toEqual([{ labId: 'player', regionId: 'usa' }]);
    expect(newPresences(next, next)).toEqual([]);
    expect(newPresences(null, next)).toEqual([]);
  });
});

describe('news flashes', () => {
  const item = (over: Partial<NewsItem>): NewsItem => ({ tick: 1, textKey: 'k', tone: 'neutral', ...over });

  it('flashTone: bad red, good green, neutral only for the player, nothing without a region', () => {
    expect(flashTone(item({ regionId: 'usa', tone: 'bad' }), 'player')).toBe('bad');
    expect(flashTone(item({ regionId: 'usa', tone: 'good' }), 'player')).toBe('good');
    expect(flashTone(item({ regionId: 'usa', labId: 'player' }), 'player')).toBe('good');
    expect(flashTone(item({ regionId: 'usa', labId: 'rival' }), 'player')).toBeNull();
    expect(flashTone(item({ tone: 'bad' }), 'player')).toBeNull();
  });

  it('freshNews returns only items added since the previous state', () => {
    const s = game();
    const a = item({ textKey: 'a' });
    const b = item({ textKey: 'b' });
    const prev: GameState = { ...s, news: [a] };
    const next: GameState = { ...s, news: [a, b] };
    expect(freshNews(prev, next)).toEqual([b]);
    expect(freshNews(next, next)).toEqual([]);
    expect(freshNews(null, next)).toEqual([]);
  });
});

describe('view transform', () => {
  const layout: Layout = { cw: 400, ch: 600, mw: 1000, mh: 468 };

  it('centres the map when it is smaller than the container', () => {
    expect(clampTranslate(layout, 1, 50, 80)).toEqual([0, 0]);
  });

  it('keeps the map covering the container when zoomed in', () => {
    const [tx] = clampTranslate(layout, 4, 10000, 0);
    // Left edge of the content may not move right of the container's left edge.
    expect(200 + tx + 4 * (0 - 200)).toBeCloseTo(0);
  });

  it('zoomAbout keeps the focal point fixed', () => {
    const [s0, tx0, ty0] = [2, 10, -20];
    const focus = { x: 100, y: 300 };
    // Untransformed point currently under the focus: focus = c + t + s * (q - c).
    const q = { x: 200 + (focus.x - 200 - tx0) / s0, y: 300 + (focus.y - 300 - ty0) / s0 };
    const [tx, ty] = zoomAbout(layout, s0, 4, tx0, ty0, focus.x, focus.y);
    expect(200 + tx + 4 * (q.x - 200)).toBeCloseTo(focus.x);
    expect(300 + ty + 4 * (q.y - 300)).toBeCloseTo(focus.y);
  });

  it('centreOn puts a map point in the middle when there is room', () => {
    const [tx, ty] = centreOn(layout, 4, 500, 234);
    expect(tx).toBeCloseTo(0);
    expect(ty).toBeCloseTo(0);
  });
});

describe('view transform in a wide (landscape) main area', () => {
  // 844x390 minus the rail, top strip and ticker.
  const wide: Layout = { cw: 788, ch: 322, mw: 1000, mh: 468 };

  it('fitWorld shows the whole world inside the area, touching it on one axis', () => {
    const [s, tx, ty] = fitWorld(wide);
    const [x0, y0] = toScreenPoint(wide, s, tx, ty, 0, 0);
    const [x1, y1] = toScreenPoint(wide, s, tx, ty, wide.mw, wide.mh);
    expect(x0).toBeGreaterThanOrEqual(0);
    expect(y0).toBeGreaterThanOrEqual(0);
    expect(x1).toBeLessThanOrEqual(wide.cw);
    expect(y1).toBeLessThanOrEqual(wide.ch);
    // Height-limited here: it fills the height and is centred horizontally.
    expect(y0).toBeCloseTo(0);
    expect(y1).toBeCloseTo(wide.ch);
    expect(x0).toBeCloseTo(wide.cw - x1);
  });

  it('fitWorld ignores an open panel', () => {
    expect(fitWorld({ ...wide, insetRight: 360 })).toEqual(fitWorld(wide));
  });

  it('centreOn with a panel centres the point in the uncovered part when there is room', () => {
    const panel: Layout = { ...wide, insetRight: 360 };
    const visibleCentre = (wide.cw - 360) / 2;
    // Mid-map point at the whole-world zoom.
    const [tx, ty] = centreOn(panel, 1, 500, 234);
    expect(toScreenPoint(panel, 1, tx, ty, 500, 234)[0]).toBeCloseTo(visibleCentre);
    // Zoomed in, a point far east still lands in the middle of the uncovered part.
    const [tx2, ty2] = centreOn(panel, 3, 800, 200);
    const [sx, sy] = toScreenPoint(panel, 3, tx2, ty2, 800, 200);
    expect(sx).toBeCloseTo(visibleCentre);
    expect(sy).toBeCloseTo(wide.ch / 2);
  });

  it('centreOn with a panel keeps a point at the map edge out from under the panel', () => {
    const panel: Layout = { ...wide, insetRight: 360 };
    const [tx, ty] = centreOn(panel, 1, 990, 200);
    const [sx] = toScreenPoint(panel, 1, tx, ty, 990, 200);
    expect(sx).toBeLessThanOrEqual(wide.cw - 360);
    // The map still covers the uncovered part (no empty gap on the left).
    expect(toScreenPoint(panel, 1, tx, ty, 0, 0)[0]).toBeLessThanOrEqual(0);
  });

  it('clampTranslate without a panel recentres a world view panned for the panel', () => {
    const panel: Layout = { ...wide, insetRight: 360 };
    const [tx, ty] = centreOn(panel, 1, 900, 200);
    expect(clampTranslate(wide, 1, tx, ty)).toEqual(fitWorld(wide).slice(1));
  });
});

describe('hit testing', () => {
  const { geometry } = getPackEntry();
  const tester = createHitTester(geometry, 150, 7);

  it('parses M/L/Z path data into rings', () => {
    expect(parseRings('M0,0L10,0L10,10ZM20,20L30,20L30,30Z')).toEqual([
      [0, 0, 10, 0, 10, 10],
      [20, 20, 30, 20, 30, 30],
    ]);
  });

  it('finds every region at its centroid', () => {
    for (const id of ids) {
      if (id === 'far-south' || id === 'pacific') continue; // centroids of scattered shapes may sit in the sea
      expect(tester.at(...geometry.regions[id].centroid)).toBe(id);
    }
  });

  it('returns null in the open ocean', () => {
    // Mid South Atlantic.
    expect(tester.at(430, 330)).toBeNull();
  });

  it('toMapPoint inverts the view transform', () => {
    const layout: Layout = { cw: 390, ch: 600, mw: geometry.width, mh: geometry.height };
    const [x, y] = geometry.regions.japan.centroid;
    const [tx, ty] = centreOn(layout, 6, x, y);
    const [mx, my] = toMapPoint(layout, 6, tx, ty, 195, 300);
    expect(mx).toBeCloseTo(x, 0);
    expect(my).toBeCloseTo(y, 0);
  });
});
