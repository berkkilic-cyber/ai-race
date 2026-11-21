/**
 * One touch controller for the maps, fed from React Native's core responder system (see
 * useMapTouch.ts). Pure and synchronous: it receives snapshots of the active touches in
 * the touch view's own coordinates and decides what they mean.
 *
 *   one finger moved more than SLOP      pan (the content follows the finger from touch-down)
 *   two fingers                          pinch-zoom around their midpoint, plus pan
 *   released within SLOP and TAP_MS      tap (never after a pan or a second finger)
 *   two taps within DOUBLE_TAP_MS        double tap (the second tap is not reported as a tap)
 *   a tap the host claims (claimsTap)    always a single tap, never part of a double tap
 *
 * The view is read from and written to the host through `hooks`, so the host can keep it
 * in a ref and push it to the native transform without any React state per move.
 */

import { clampScale, panBy, zoomAbout, type Layout } from './viewTransform';

export interface TouchPoint {
  id: number;
  /** Touch-view coordinates (points). */
  x: number;
  y: number;
}

export interface MapView {
  s: number;
  tx: number;
  ty: number;
}

export type GestureKind = 'pan' | 'pinch';

export interface TouchHooks {
  layout(): Layout;
  view(): MapView;
  setView(v: MapView): void;
  /** A new touch sequence began (before any view() read): settle a running animation. */
  begin?(): void;
  /** A tap at a touch-view point. */
  tap(x: number, y: number): void;
  /** The second tap of a double tap. */
  doubleTap(x: number, y: number): void;
  /**
   * True when a tap here belongs to something on the map that takes taps of its own (a
   * moment bubble): such a tap is always a single tap and never starts or completes a double
   * tap, so tapping two bubbles quickly collects both instead of resetting the view.
   */
  claimsTap?(x: number, y: number): boolean;
  /** A pan or pinch ended (the last finger lifted). */
  gestureEnd?(kind: GestureKind, v: MapView): void;
}

/** Travel (points) before one finger becomes a pan; a tap may wander this far. */
export const SLOP = 6;
/** A tap is released within this long of touch-down (generous: a deliberate tap can rest a moment). */
export const TAP_MS = 450;
/** The second tap of a double tap starts within this long of the first one's release ... */
export const DOUBLE_TAP_MS = 300;
/** ... and this close to it (points). */
export const DOUBLE_TAP_DIST = 40;

interface Pt {
  x: number;
  y: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p: TouchPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);

export class TouchController {
  private last = new Map<number, Pt>();
  /** The touch-down of a possible tap; null once the touch is a pan or a pinch. */
  private down: (Pt & { t: number }) | null = null;
  private kind: GestureKind | null = null;
  private lastTap: (Pt & { t: number }) | null = null;

  constructor(private hooks: TouchHooks) {}

  /** Active touch count after the last event. */
  get touchCount(): number {
    return this.last.size;
  }

  /** What the current touch is so far: 'tap' (possible tap), 'pan', 'pinch' or 'idle'. */
  get phase(): 'idle' | 'tap' | GestureKind {
    if (this.last.size === 0) return 'idle';
    return this.kind ?? (this.down ? 'tap' : 'idle');
  }

  /** The responder was granted: the first touch(es) went down. */
  begin(touches: readonly TouchPoint[], t: number): void {
    this.hooks.begin?.();
    this.last.clear();
    this.kind = null;
    const pts = touches.filter(finite);
    this.down = pts.length === 1 ? { x: pts[0].x, y: pts[0].y, t } : null;
    if (pts.length >= 2) this.kind = 'pinch';
    for (const p of pts) this.last.set(p.id, { x: p.x, y: p.y });
  }

  /** Any change while the responder is held: a move, or a finger added or lifted (others still down). */
  update(touches: readonly TouchPoint[], t: number): void {
    const pts = touches.filter(finite);
    if (pts.length === 0) return;
    if (this.last.size === 0) {
      this.begin(pts, t);
      return;
    }
    if (pts.length >= 2) {
      this.down = null;
      this.kind = 'pinch';
      const [a, b] = pts;
      const pa = this.last.get(a.id);
      const pb = this.last.get(b.id);
      if (pa && pb) this.pinch(pa, pb, a, b);
    } else {
      const p = pts[0];
      const prev = this.last.get(p.id);
      if (this.down && !this.kind) {
        const start = this.down;
        if (dist(p, start) > SLOP) {
          // A pan from touch-down: the slop is included, so the content stays under the finger.
          this.kind = 'pan';
          this.down = null;
          this.move(p.x - start.x, p.y - start.y);
        }
      } else if (prev && this.kind) {
        this.move(p.x - prev.x, p.y - prev.y);
      }
    }
    this.last.clear();
    for (const p of pts) this.last.set(p.id, { x: p.x, y: p.y });
  }

  /** The last finger lifted. `end` is where it lifted (the released touch), if known. */
  release(end: TouchPoint | null, t: number): void {
    const down = this.down;
    const kind = this.kind;
    const lastPt = end && finite(end) ? end : this.last.size === 1 ? [...this.last.values()][0] : null;
    this.reset();
    if (kind) {
      this.lastTap = null;
      this.hooks.gestureEnd?.(kind, this.hooks.view());
      return;
    }
    if (!down) return;
    const at = lastPt ?? down;
    if (dist(at, down) > SLOP || t - down.t > TAP_MS) {
      this.lastTap = null;
      return;
    }
    if (this.hooks.claimsTap?.(down.x, down.y)) {
      this.lastTap = null;
      this.hooks.tap(down.x, down.y);
      return;
    }
    const prevTap = this.lastTap;
    if (prevTap && down.t - prevTap.t <= DOUBLE_TAP_MS && dist(down, prevTap) <= DOUBLE_TAP_DIST) {
      this.lastTap = null;
      this.hooks.doubleTap(down.x, down.y);
      return;
    }
    this.lastTap = { x: down.x, y: down.y, t };
    this.hooks.tap(down.x, down.y);
  }

  /** The responder was taken away or the touch was cancelled: no tap, no double tap. */
  cancel(): void {
    const kind = this.kind;
    this.reset();
    this.lastTap = null;
    if (kind) this.hooks.gestureEnd?.(kind, this.hooks.view());
  }

  private reset() {
    this.last.clear();
    this.down = null;
    this.kind = null;
  }

  private move(dx: number, dy: number) {
    const v = this.hooks.view();
    const [tx, ty] = panBy(this.hooks.layout(), v.s, v.tx, v.ty, dx, dy);
    if (tx !== v.tx || ty !== v.ty) this.hooks.setView({ s: v.s, tx, ty });
  }

  private pinch(pa: Pt, pb: Pt, a: Pt, b: Pt) {
    const l = this.hooks.layout();
    const v = this.hooks.view();
    const d0 = dist(pa, pb);
    const d1 = dist(a, b);
    const ratio = d0 >= 1 && d1 >= 1 ? d1 / d0 : 1;
    const m0 = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const s1 = clampScale(v.s * ratio);
    const [zx, zy] = zoomAbout(l, v.s, s1, v.tx, v.ty, m0.x, m0.y);
    const [tx, ty] = panBy(l, s1, zx, zy, m1.x - m0.x, m1.y - m0.y);
    this.hooks.setView({ s: s1, tx, ty });
  }
}
