/**
 * Keeping the things drawn over the map apart, in screen points (map container
 * coordinates). Pure worklets, run once per frame for at most a handful of bubbles.
 *
 * Priorities, highest first:
 *  1. Controls (zoom buttons, Regions, the help button): never covered. They sit above the
 *     map's touch view; bubbles and edge indicators are pushed out of their rects.
 *  2. Moment bubbles: what the player taps. Pushed apart from each other, out of the
 *     obstacle rects (controls, the standings strip) and inside the visible map, by at most
 *     MAX_NUDGE so a bubble stays by its region.
 *  3. Edge indicators (bubbles off screen): slide along their edge out of obstacles and
 *     apart from each other.
 *  4. Banners, racks, routes and the standings strip: informational, drawn below bubbles.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Space kept between two bubbles, and between a bubble and an obstacle. */
export const BUBBLE_GAP = 6;
/** Largest distance a bubble is moved from where its slot puts it. */
export const MAX_NUDGE = 96;
/** Bubbles keep this far inside the visible map's edges. */
export const EDGE_PAD = 4;
const ITERATIONS = 10;

function finite(n: number): number {
  'worklet';
  return Number.isFinite(n) ? n : 0;
}

/**
 * Nudges (dx, dy) for bubbles of radius r centred at `points` so that they do not overlap
 * each other or the obstacles and stay inside [0, w] x [0, h]. Points flagged off-screen
 * (`onScreen[i]` false) are left alone (their edge indicator stands in for them).
 * Deterministic: the same input gives the same output, ties broken by index.
 */
export function relaxBubbles(
  points: readonly [number, number][],
  onScreen: readonly boolean[],
  rects: readonly Rect[],
  w: number,
  h: number,
  r: number,
  /** Each bubble's own region marker: a bubble never ends up within `keep` of it (the region stays tappable there). */
  anchors?: readonly [number, number][],
  keep = 0,
): [number, number][] {
  'worklet';
  const n = points.length;
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < n; i++) {
    px.push(finite(points[i][0]));
    py.push(finite(points[i][1]));
  }
  const min = 2 * r + BUBBLE_GAP;
  const pad = r + EDGE_PAD;
  for (let it = 0; it < ITERATIONS; it++) {
    // Apart from each other.
    for (let i = 0; i < n; i++) {
      if (!onScreen[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!onScreen[j]) continue;
        let dx = px[j] - px[i];
        let dy = py[j] - py[i];
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d >= min) continue;
        if (d < 0.01) {
          // Same spot: split along a fixed direction per pair.
          const a = (i * 7 + j * 3) * 0.9;
          dx = Math.cos(a);
          dy = Math.sin(a);
          d = 1;
        }
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        px[i] -= ux * push;
        py[i] -= uy * push;
        px[j] += ux * push;
        py[j] += uy * push;
      }
    }
    // Out of the obstacles, along the shortest way out.
    for (let i = 0; i < n; i++) {
      if (!onScreen[i]) continue;
      for (let k = 0; k < rects.length; k++) {
        const o = rects[k];
        const left = o.x - r - BUBBLE_GAP / 2;
        const right = o.x + o.w + r + BUBBLE_GAP / 2;
        const top = o.y - r - BUBBLE_GAP / 2;
        const bottom = o.y + o.h + r + BUBBLE_GAP / 2;
        if (px[i] <= left || px[i] >= right || py[i] <= top || py[i] >= bottom) continue;
        const outs = [px[i] - left, right - px[i], py[i] - top, bottom - py[i]];
        // Never push a bubble out of the map to escape an obstacle at the edge.
        if (left < pad) outs[0] = Infinity;
        if (right > w - pad) outs[1] = Infinity;
        if (top < pad) outs[2] = Infinity;
        if (bottom > h - pad) outs[3] = Infinity;
        let best = 0;
        for (let s = 1; s < 4; s++) if (outs[s] < outs[best]) best = s;
        if (!Number.isFinite(outs[best])) continue;
        if (best === 0) px[i] = left;
        else if (best === 1) px[i] = right;
        else if (best === 2) py[i] = top;
        else py[i] = bottom;
      }
    }
    // Inside the visible map.
    for (let i = 0; i < n; i++) {
      if (!onScreen[i]) continue;
      px[i] = Math.min(Math.max(px[i], pad), Math.max(pad, w - pad));
      py[i] = Math.min(Math.max(py[i], pad), Math.max(pad, h - pad));
    }
    // Off the bubble's own marker (a bubble pressed against the top edge would otherwise sit on
    // it): step sideways, along the same height, to the edge of the keep-out circle.
    if (anchors && keep > 0) {
      for (let i = 0; i < n; i++) {
        if (!onScreen[i] || !anchors[i]) continue;
        const ax = finite(anchors[i][0]);
        const ay = finite(anchors[i][1]);
        const dx = px[i] - ax;
        const dy = py[i] - ay;
        if (dx * dx + dy * dy >= keep * keep) continue;
        let side = dx > 0.01 ? 1 : dx < -0.01 ? -1 : i % 2 === 0 ? 1 : -1;
        const step = Math.sqrt(Math.max(0, keep * keep - dy * dy));
        if (ax + side * step > w - pad) side = -1;
        if (ax + side * step < pad) side = 1;
        px[i] = ax + side * step;
      }
    }
  }
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    if (!onScreen[i]) {
      out.push([0, 0]);
      continue;
    }
    let dx = px[i] - finite(points[i][0]);
    let dy = py[i] - finite(points[i][1]);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > MAX_NUDGE) {
      dx = (dx / d) * MAX_NUDGE;
      dy = (dy / d) * MAX_NUDGE;
    }
    out.push([finite(dx), finite(dy)]);
  }
  return out;
}

/**
 * Edge indicator positions (centres) for off-screen items: each starts at its clamped edge
 * point, then slides along that edge out of obstacles and apart from the others (size
 * `size`). Null entries stay null.
 */
export function placeEdgeMarkers(points: readonly ([number, number] | null)[], rects: readonly Rect[], w: number, h: number, size: number, inset: number): ([number, number] | null)[] {
  'worklet';
  const n = points.length;
  const out: ([number, number] | null)[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    out.push(p ? [finite(p[0]), finite(p[1])] : null);
  }
  const lo = inset;
  const hiX = Math.max(inset, w - inset);
  const hiY = Math.max(inset, h - inset);
  // On a left or right edge a marker slides vertically, on the top or bottom edge horizontally.
  const vertical = (p: [number, number]) => p[0] <= lo + 0.5 || p[0] >= hiX - 0.5;
  for (let it = 0; it < ITERATIONS; it++) {
    for (let i = 0; i < n; i++) {
      const p = out[i];
      if (!p) continue;
      for (let k = 0; k < rects.length; k++) {
        const o = rects[k];
        const half = size / 2 + BUBBLE_GAP / 2;
        if (p[0] <= o.x - half || p[0] >= o.x + o.w + half || p[1] <= o.y - half || p[1] >= o.y + o.h + half) continue;
        if (vertical(p)) {
          const up = o.y - half;
          const down = o.y + o.h + half;
          p[1] = up >= lo && (p[1] - up < down - p[1] || down > hiY) ? up : down;
        } else {
          const l = o.x - half;
          const r = o.x + o.w + half;
          p[0] = l >= lo && (p[0] - l < r - p[0] || r > hiX) ? l : r;
        }
      }
      for (let j = i + 1; j < n; j++) {
        const q = out[j];
        if (!q) continue;
        const dx = q[0] - p[0];
        const dy = q[1] - p[1];
        const d = Math.sqrt(dx * dx + dy * dy);
        const min = size + 2;
        if (d >= min) continue;
        const push = (min - d) / 2;
        if (vertical(p) && vertical(q)) {
          const s = dy >= 0 ? 1 : -1;
          p[1] -= s * push;
          q[1] += s * push;
        } else {
          const s = dx >= 0 ? 1 : -1;
          p[0] -= s * push;
          q[0] += s * push;
        }
      }
      p[0] = Math.min(Math.max(p[0], lo), hiX);
      p[1] = Math.min(Math.max(p[1], lo), hiY);
    }
  }
  return out;
}

/** Angle (radians) from an edge marker towards the thing it stands for. */
export function pointAngle(fromX: number, fromY: number, toX: number, toY: number): number {
  'worklet';
  if (![fromX, fromY, toX, toY].every((n) => Number.isFinite(n))) return 0;
  const a = Math.atan2(toY - fromY, toX - fromX);
  return Number.isFinite(a) ? a : 0;
}
