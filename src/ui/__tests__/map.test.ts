import { createGame, type GameState, type NewsItem } from '@/engine';

import { flashTone, freshNews } from '../hooks/useRegionFlashes';
import { bannedKey, mixColor, parseSites, regionFills, sitesKey } from '../map/mapColors';
import { createHitTester, parseRings } from '../map/hitTest';
import { clampTranslate, centreOn, toMapPoint, zoomAbout, type Layout } from '../map/viewTransform';
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
