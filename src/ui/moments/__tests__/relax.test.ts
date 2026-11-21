import { BUBBLE_GAP, EDGE_PAD, MAX_NUDGE, placeEdgeMarkers, pointAngle, relaxBubbles, type Rect } from '../relax';

const R = 20;
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const moved = (pts: [number, number][], nudges: [number, number][]) => pts.map((p, i) => [p[0] + nudges[i][0], p[1] + nudges[i][1]] as [number, number]);

describe('relaxBubbles', () => {
  it('leaves bubbles that are already apart where they are', () => {
    const pts: [number, number][] = [
      [100, 100],
      [300, 100],
    ];
    expect(relaxBubbles(pts, [true, true], [], 844, 300, R)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('pushes overlapping bubbles in neighbouring regions apart, deterministically', () => {
    const pts: [number, number][] = [
      [200, 150],
      [210, 155],
      [205, 140],
    ];
    const a = relaxBubbles(pts, [true, true, true], [], 844, 300, R);
    expect(relaxBubbles(pts, [true, true, true], [], 844, 300, R)).toEqual(a);
    const out = moved(pts, a);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(dist(out[i], out[j])).toBeGreaterThanOrEqual(2 * R + BUBBLE_GAP - 1);
    for (const n of a) expect(Math.hypot(n[0], n[1])).toBeLessThanOrEqual(MAX_NUDGE + 1e-9);
  });

  it('splits bubbles at exactly the same point', () => {
    const out = moved([[200, 150], [200, 150]], relaxBubbles([[200, 150], [200, 150]], [true, true], [], 844, 300, R));
    expect(dist(out[0], out[1])).toBeGreaterThanOrEqual(2 * R + BUBBLE_GAP - 1);
  });

  it('keeps bubbles off the controls and the standings strip and inside the map', () => {
    const controls: Rect = { x: 12, y: 200, w: 120, h: 90 };
    const standings: Rect = { x: 690, y: 240, w: 148, h: 50 };
    const pts: [number, number][] = [
      [60, 240],
      [760, 270],
      [400, 2],
    ];
    const out = moved(pts, relaxBubbles(pts, [true, true, true], [controls, standings], 844, 300, R));
    const inside = (p: [number, number], o: Rect) => p[0] > o.x - R && p[0] < o.x + o.w + R && p[1] > o.y - R && p[1] < o.y + o.h + R;
    expect(inside(out[0], controls)).toBe(false);
    expect(inside(out[1], standings)).toBe(false);
    expect(out[2][1]).toBeGreaterThanOrEqual(R + EDGE_PAD - 1e-9);
  });

  it('leaves off-screen bubbles alone and survives NaN', () => {
    const n = relaxBubbles([[NaN, 10], [-500, 10]], [true, false], [], 844, 300, R);
    expect(n[1]).toEqual([0, 0]);
    expect(n.flat().every(Number.isFinite)).toBe(true);
  });
});

describe('placeEdgeMarkers', () => {
  it('slides a marker on the left edge clear of the controls, and markers apart', () => {
    const controls: Rect = { x: 12, y: 200, w: 120, h: 90 };
    const out = placeEdgeMarkers([[26, 250], [26, 252], null], [controls], 844, 300, 30, 26);
    expect(out[2]).toBeNull();
    for (const p of out.slice(0, 2)) {
      expect(p![0]).toBe(26);
      expect(p![1] < controls.y || p![1] > controls.y + controls.h).toBe(true);
    }
    expect(dist(out[0]!, out[1]!)).toBeGreaterThanOrEqual(30);
  });

  it('slides a marker on the bottom edge sideways', () => {
    const standings: Rect = { x: 690, y: 240, w: 148, h: 50 };
    const out = placeEdgeMarkers([[760, 274]], [standings], 844, 300, 30, 26);
    expect(out[0]![1]).toBe(274);
    expect(out[0]![0]).toBeLessThan(standings.x);
  });
});

describe('pointAngle', () => {
  it('points from the marker towards the bubble', () => {
    expect(pointAngle(0, 0, 10, 0)).toBe(0);
    expect(pointAngle(0, 0, 0, 10)).toBeCloseTo(Math.PI / 2);
    expect(pointAngle(0, 0, -10, 0)).toBeCloseTo(Math.PI);
    expect(pointAngle(NaN, 0, 1, 1)).toBe(0);
  });
});

describe('relaxBubbles and the region marker', () => {
  it('steps a bubble pushed against the top edge sideways off its own marker', () => {
    // Marker 10 pt below the top: the bubble's slot is above it, off the map; clamped down it would cover the marker.
    const anchor: [number, number] = [300, 10];
    const pts: [number, number][] = [[300, -26]];
    const out = moved(pts, relaxBubbles(pts, [true], [], 844, 300, R, [anchor], 32));
    expect(dist(out[0], anchor)).toBeGreaterThanOrEqual(32 - 1e-6);
    expect(out[0][1]).toBeGreaterThanOrEqual(R + EDGE_PAD - 1e-9);
  });
});
