import { getPackEntry } from '../packs';
import { createHitTester } from '../map/hitTest';
import { DOUBLE_TAP_MS, SLOP, TAP_MS, TouchController, type MapView, type TouchPoint } from '../map/touchController';
import { centreOn, toMapPoint, toScreenPoint, type Layout } from '../map/viewTransform';

const { geometry } = getPackEntry();

/** The wide map area on a 926x428 phone (about 800x330). */
const LAYOUT: Layout = { cw: 800, ch: 330, mw: geometry.width, mh: geometry.height };

function harness(initial: MapView = { s: 1, tx: 0, ty: 0 }) {
  let view = { ...initial };
  const taps: [number, number][] = [];
  const doubleTaps: [number, number][] = [];
  const ends: string[] = [];
  let sets = 0;
  const c = new TouchController({
    layout: () => LAYOUT,
    view: () => view,
    setView: (v) => {
      sets++;
      view = v;
    },
    tap: (x, y) => taps.push([x, y]),
    doubleTap: (x, y) => doubleTaps.push([x, y]),
    gestureEnd: (k) => ends.push(k),
  });
  return {
    c,
    get view() {
      return view;
    },
    taps,
    doubleTaps,
    ends,
    get sets() {
      return sets;
    },
  };
}

const pt = (x: number, y: number, id = 1): TouchPoint => ({ id, x, y });

/** One finger: down at a, moves through `path`, lifts at the last point. */
function drag(h: ReturnType<typeof harness>, a: [number, number], path: [number, number][], t0 = 0, stepMs = 16) {
  h.c.begin([pt(...a)], t0);
  let t = t0;
  for (const p of path) {
    t += stepMs;
    h.c.update([pt(...p)], t);
  }
  const last = path[path.length - 1] ?? a;
  h.c.release(pt(...last), t + stepMs);
  return t + stepMs;
}

describe('touch controller: taps', () => {
  it('a touch that stays put is a tap at the touch-down point, and moves nothing', () => {
    const h = harness();
    h.c.begin([pt(200, 100)], 0);
    h.c.update([pt(202, 101)], 40);
    h.c.release(pt(202, 101), 90);
    expect(h.taps).toEqual([[200, 100]]);
    expect(h.sets).toBe(0);
    expect(h.ends).toEqual([]);
  });

  it('a touch held too long is not a tap', () => {
    const h = harness();
    h.c.begin([pt(200, 100)], 0);
    h.c.release(pt(200, 100), TAP_MS + 10);
    expect(h.taps).toEqual([]);
  });

  it('a cancelled touch (responder terminated) is not a tap', () => {
    const h = harness();
    h.c.begin([pt(200, 100)], 0);
    h.c.cancel();
    expect(h.taps).toEqual([]);
  });

  it('a tap after a drag does not select; a later clean tap does', () => {
    const h = harness({ s: 3, tx: 0, ty: 0 });
    const t = drag(h, [300, 150], [[310, 150], [340, 160], [380, 170]]);
    expect(h.taps).toEqual([]);
    expect(h.ends).toEqual(['pan']);
    h.c.begin([pt(100, 100)], t + 500);
    h.c.release(pt(100, 100), t + 560);
    expect(h.taps).toEqual([[100, 100]]);
  });

  it('a drag that comes back to where it started is still not a tap', () => {
    const h = harness({ s: 3, tx: 0, ty: 0 });
    drag(h, [300, 150], [[320, 150], [300, 150]]);
    expect(h.taps).toEqual([]);
  });

  it('two quick taps in the same place: a tap, then a double tap (not a second tap)', () => {
    const h = harness();
    h.c.begin([pt(200, 100)], 0);
    h.c.release(pt(200, 100), 60);
    h.c.begin([pt(205, 103)], 60 + DOUBLE_TAP_MS - 50);
    h.c.release(pt(205, 103), 60 + DOUBLE_TAP_MS);
    expect(h.taps).toEqual([[200, 100]]);
    expect(h.doubleTaps).toEqual([[205, 103]]);
  });

  it('two taps too far apart in time or space are two taps', () => {
    const h = harness();
    h.c.begin([pt(200, 100)], 0);
    h.c.release(pt(200, 100), 60);
    h.c.begin([pt(200, 100)], 60 + DOUBLE_TAP_MS + 100);
    h.c.release(pt(200, 100), 60 + DOUBLE_TAP_MS + 150);
    h.c.begin([pt(400, 100)], 60 + DOUBLE_TAP_MS + 200);
    h.c.release(pt(400, 100), 60 + DOUBLE_TAP_MS + 250);
    expect(h.taps).toHaveLength(3);
    expect(h.doubleTaps).toHaveLength(0);
  });

  it('two quick drags are never a double tap', () => {
    const h = harness({ s: 3, tx: 0, ty: 0 });
    const t = drag(h, [300, 150], [[340, 150]], 0, 10);
    drag(h, [300, 150], [[340, 150]], t + 50, 10);
    expect(h.doubleTaps).toEqual([]);
    expect(h.taps).toEqual([]);
  });

  it('a wobble within the slop stays a tap', () => {
    const h = harness();
    h.c.begin([pt(200, 100)], 0);
    h.c.update([pt(200 + SLOP - 1, 100)], 30);
    h.c.release(pt(200 + SLOP - 1, 100), 60);
    expect(h.taps).toHaveLength(1);
    expect(h.sets).toBe(0);
  });
});

describe('touch controller: pan', () => {
  it('the content follows one finger point for point, slop included', () => {
    const h = harness({ s: 3, tx: 0, ty: 0 });
    drag(h, [300, 150], [[303, 150], [310, 152], [350, 170]]);
    expect(h.view.s).toBe(3);
    expect(h.view.tx).toBeCloseTo(50);
    expect(h.view.ty).toBeCloseTo(20);
  });

  it('a pan stays inside the map (clamped) at the whole-world view', () => {
    const h = harness({ s: 1, tx: 0, ty: 0 });
    drag(h, [300, 150], [[600, 150]]);
    // At scale 1 the fitted map is centred on the free axis and pinned on the covered one.
    expect(Math.abs(h.view.tx)).toBeLessThan(LAYOUT.cw);
    expect(Number.isFinite(h.view.ty)).toBe(true);
  });
});

describe('touch controller: pinch', () => {
  it('two fingers spreading zoom in around their midpoint (the point under it stays put)', () => {
    const h = harness({ s: 2, tx: 0, ty: 0 });
    const mid: [number, number] = [400, 165];
    const before = toMapPoint(LAYOUT, 2, 0, 0, mid[0], mid[1]);
    h.c.begin([pt(350, 165, 1)], 0);
    h.c.update([pt(350, 165, 1), pt(450, 165, 2)], 10);
    h.c.update([pt(325, 165, 1), pt(475, 165, 2)], 30);
    h.c.update([pt(300, 165, 1), pt(500, 165, 2)], 50);
    h.c.release(pt(500, 165, 2), 70);
    expect(h.view.s).toBeCloseTo(4);
    const after = toMapPoint(LAYOUT, h.view.s, h.view.tx, h.view.ty, mid[0], mid[1]);
    expect(after[0]).toBeCloseTo(before[0], 3);
    expect(after[1]).toBeCloseTo(before[1], 3);
    expect(h.taps).toEqual([]);
    expect(h.ends).toEqual(['pinch']);
  });

  it('both fingers moving together pan the zoomed map', () => {
    const h = harness({ s: 3, tx: 0, ty: 0 });
    h.c.begin([pt(300, 150, 1), pt(400, 150, 2)], 0);
    h.c.update([pt(320, 160, 1), pt(420, 160, 2)], 20);
    expect(h.view.s).toBeCloseTo(3);
    expect(h.view.tx).toBeCloseTo(20);
    expect(h.view.ty).toBeCloseTo(10);
  });

  it('lifting one finger of a pinch keeps panning with the other, without a jump, and never taps', () => {
    const h = harness({ s: 3, tx: 0, ty: 0 });
    h.c.begin([pt(300, 150, 1)], 0);
    h.c.update([pt(300, 150, 1), pt(400, 150, 2)], 10);
    h.c.update([pt(400, 150, 2)], 20); // finger 1 lifted
    const v = h.view;
    h.c.update([pt(410, 155, 2)], 30);
    expect(h.view.tx - v.tx).toBeCloseTo(10);
    expect(h.view.ty - v.ty).toBeCloseTo(5);
    h.c.release(pt(410, 155, 2), 40);
    expect(h.taps).toEqual([]);
  });

  it('a quick two-finger touch is never a tap', () => {
    const h = harness();
    h.c.begin([pt(300, 150, 1), pt(310, 150, 2)], 0);
    h.c.release(pt(310, 150, 2), 50);
    expect(h.taps).toEqual([]);
  });

  it('pinching never leaves the zoom range or returns NaN', () => {
    const h = harness({ s: 7, tx: 0, ty: 0 });
    h.c.begin([pt(390, 165, 1), pt(410, 165, 2)], 0);
    h.c.update([pt(0, 165, 1), pt(800, 165, 2)], 10);
    expect(h.view.s).toBeLessThanOrEqual(8);
    h.c.update([pt(400, 165, 1), pt(400, 165, 2)], 20); // fingers on top of each other
    expect(Number.isFinite(h.view.s) && Number.isFinite(h.view.tx) && Number.isFinite(h.view.ty)).toBe(true);
  });
});

describe('touch controller: taps hit the right region at any zoom', () => {
  const tester = createHitTester(geometry, 150, 7);
  const big = Object.entries(geometry.regions)
    .sort((a, b) => b[1].area - a[1].area)
    .slice(0, 6)
    .map(([id]) => id);

  it.each([1, 2.5, 5])('scale %p, after a pan', (s) => {
    for (const id of big) {
      const region = geometry.regions[id];
      const [tx, ty] = centreOn(LAYOUT, s, region.centroid[0], region.centroid[1]);
      const h = harness({ s, tx, ty });
      // Pan a little first, then tap the region's centroid where it now is on screen.
      drag(h, [100, 100], [[120, 110]]);
      const v = h.view;
      const [sx, sy] = toScreenPoint(LAYOUT, v.s, v.tx, v.ty, region.centroid[0], region.centroid[1]);
      h.c.begin([pt(sx, sy)], 10000);
      h.c.release(pt(sx, sy), 10050);
      expect(h.taps).toHaveLength(1);
      const [mx, my] = toMapPoint(LAYOUT, v.s, v.tx, v.ty, h.taps[0][0], h.taps[0][1]);
      expect(mx).toBeCloseTo(region.centroid[0], 6);
      expect(my).toBeCloseTo(region.centroid[1], 6);
      // The same region as a hit test at the centroid itself (a concave region's centroid can lie in a neighbour).
      expect(tester.at(mx, my)).toBe(tester.at(region.centroid[0], region.centroid[1]));
    }
  });
});
