/**
 * The map's tap registry: things drawn over the map that take taps before the regions
 * (moment bubbles and their edge indicators). Pure, so the touch path can be tested.
 */
import type { MapView } from '../touchController';
import { toScreenPoint, type Layout } from '../viewTransform';

export interface TapTarget {
  /** Map point of the anchor. */
  mx: number;
  my: number;
  /** Offset from the anchor in points. */
  dx: number;
  dy: number;
  /** Hit radius in points. */
  r: number;
  onTap(): void;
  /**
   * When the point is off the visible map, an edge indicator stands for it (EDGE_INSET in
   * from the nearest edge); a tap on the indicator calls this instead.
   */
  onEdgeTap?(): void;
  /**
   * Where the thing is actually drawn now, when it is kept apart from others (moment
   * bubbles, src/ui/moments/relax.ts): a nudge in points added to the anchor and offset,
   * and the edge indicator's centre (null while the thing is on screen).
   */
  place?(): { nudge: [number, number]; edge: [number, number] | null } | null;
}

/** Indicators of off-screen things sit this far in from the edge (centre, points). */
export const EDGE_INSET = 26;
/** A point further than this beyond the visible map's edge counts as off-screen (a bubble mostly hidden). */
export const EDGE_MARGIN = -14;
const EDGE_HIT = 22;

/** Where the edge indicator of a screen point stands, or null when the point is on screen. */
export function edgePoint(px: number, py: number, right: number, bottom: number): [number, number] | null {
  'worklet';
  if (px >= EDGE_MARGIN && px <= right - EDGE_MARGIN && py >= EDGE_MARGIN && py <= bottom - EDGE_MARGIN) return null;
  const x = Math.min(Math.max(px, EDGE_INSET), Math.max(EDGE_INSET, right - EDGE_INSET));
  const y = Math.min(Math.max(py, EDGE_INSET), Math.max(EDGE_INSET, bottom - EDGE_INSET));
  return [x, y];
}

/** Things on top of the map that take taps before the regions do. Keyed by id; nearest wins. */
export class TapTargets {
  private items = new Map<string, TapTarget>();
  set(id: string, target: TapTarget): void {
    this.items.set(id, target);
  }
  delete(id: string): void {
    this.items.delete(id);
  }
  get size(): number {
    return this.items.size;
  }
  /** The target under a touch-view point, if any (the nearest when several overlap). */
  hit(layout: Layout, v: MapView, px: number, py: number): { id: string; target: TapTarget; edge: boolean } | null {
    let best: { id: string; target: TapTarget; edge: boolean } | null = null;
    let bestD = Infinity;
    const right = Math.max(1, layout.cw - (layout.insetRight ?? 0));
    for (const [id, t] of this.items) {
      const [sx, sy] = toScreenPoint(layout, v.s, v.tx, v.ty, t.mx, t.my);
      const placed = t.place ? t.place() : null;
      const x = sx + t.dx + (placed && Number.isFinite(placed.nudge[0]) ? placed.nudge[0] : 0);
      const y = sy + t.dy + (placed && Number.isFinite(placed.nudge[1]) ? placed.nudge[1] : 0);
      const edge = t.onEdgeTap ? (placed ? placed.edge : edgePoint(x, y, right, layout.ch)) : null;
      const d = edge ? Math.hypot(edge[0] - px, edge[1] - py) : Math.hypot(x - px, y - py);
      if (d <= (edge ? EDGE_HIT : t.r) && d < bestD) {
        bestD = d;
        best = { id, target: t, edge: !!edge };
      }
    }
    return best;
  }
}

