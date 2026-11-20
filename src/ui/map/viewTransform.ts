/**
 * Pan/zoom maths for the map. The SVG fills its container with "meet" scaling;
 * a view transform (translate t, then scale s around the container centre c)
 * moves it: screen = c + t + s * (p - c). All functions are worklets so the
 * gesture callbacks can call them on the UI thread.
 *
 * Every function returns finite numbers whatever it is given (a zero-sized container
 * before the first layout, a pinch reporting scale 0 or NaN): a NaN reaching a native
 * transform or SVG attribute can crash the app.
 */

/** n when finite, else the fallback. */
function finite(n: number, fallback: number): number {
  'worklet';
  return Number.isFinite(n) ? n : fallback;
}
export interface Layout {
  /** Container size. */
  cw: number;
  ch: number;
  /** Map size in map units. */
  mw: number;
  mh: number;
  /**
   * Width covered on the right by an overlay (the side panel). The visible part of
   * the map is then [0, cw - insetRight]: clamping and centring use that part.
   */
  insetRight?: number;
}

/** Width of the part of the container that is not covered by an overlay. */
export function visibleWidth(layout: Layout): number {
  'worklet';
  return Math.max(1, layout.cw - (layout.insetRight ?? 0));
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

/** Map units -> untransformed container points. */
export function fit(layout: Layout): { k: number; ox: number; oy: number } {
  'worklet';
  const raw = Math.min(layout.cw / layout.mw, layout.ch / layout.mh);
  const k = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return { k, ox: finite((layout.cw - layout.mw * k) / 2, 0), oy: finite((layout.ch - layout.mh * k) / 2, 0) };
}

export function clampScale(s: number): number {
  'worklet';
  if (!Number.isFinite(s)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Keeps the map covering the visible part of the container where it can, centred in it where it cannot. */
export function clampTranslate(layout: Layout, s: number, tx: number, ty: number): [number, number] {
  'worklet';
  const { k, ox, oy } = fit(layout);
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  const axis = (t: number, c: number, size: number, o: number, len: number): number => {
    // Content edges after transform: c + t + s*(o - c) and c + t + s*(o + len - c).
    const hi = -c - s * (o - c); // left edge at 0
    const lo = size - c - s * (o + len - c); // right (bottom) edge at the visible size
    if (lo > hi) return finite((lo + hi) / 2, 0);
    return finite(Math.min(hi, Math.max(lo, finite(t, 0))), 0);
  };
  return [axis(tx, cx, visibleWidth(layout), ox, layout.mw * k), axis(ty, cy, layout.ch, oy, layout.mh * k)];
}

/** New translation that keeps the focal point (container coords) fixed while scale goes from s0 to s1. */
export function zoomAbout(layout: Layout, s0: number, s1: number, tx: number, ty: number, fx: number, fy: number): [number, number] {
  'worklet';
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  const r = s0 > 0 && Number.isFinite(s1 / s0) ? s1 / s0 : 1;
  return [finite(fx - cx - r * (fx - cx - tx), tx), finite(fy - cy - r * (fy - cy - ty), ty)];
}

/**
 * Translation that centres a map point at scale s in the visible part of the container
 * (left of any insetRight overlay), as far as clamping allows.
 */
export function centreOn(layout: Layout, s: number, x: number, y: number): [number, number] {
  'worklet';
  const { k, ox, oy } = fit(layout);
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  const px = ox + x * k;
  const py = oy + y * k;
  // screen = c + t + s * (p - c) must equal the visible centre.
  const targetX = visibleWidth(layout) / 2;
  return clampTranslate(layout, s, targetX - cx - s * (px - cx), cy - cy - s * (py - cy));
}

/** The whole-world view: the map fitted to the container ("meet") and centred. Returns [scale, tx, ty]. */
export function fitWorld(layout: Layout): [number, number, number] {
  'worklet';
  const [tx, ty] = clampTranslate({ ...layout, insetRight: 0 }, MIN_SCALE, 0, 0);
  return [MIN_SCALE, tx, ty];
}

/** Map units -> container point under the view transform (the inverse of toMapPoint). */
export function toScreenPoint(layout: Layout, s: number, tx: number, ty: number, x: number, y: number): [number, number] {
  'worklet';
  const { k, ox, oy } = fit(layout);
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  return [cx + tx + s * (ox + x * k - cx), cy + ty + s * (oy + y * k - cy)];
}

/** Container point (e.g. a tap) -> map units, undoing the view transform and the fit. */
export function toMapPoint(layout: Layout, s: number, tx: number, ty: number, px: number, py: number): [number, number] {
  'worklet';
  const { k, ox, oy } = fit(layout);
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  const ss = s > 0 && Number.isFinite(s) ? s : 1;
  const qx = cx + (px - cx - tx) / ss;
  const qy = cy + (py - cy - ty) / ss;
  return [finite((qx - ox) / k, 0), finite((qy - oy) / k, 0)];
}

/**
 * Translation after dragging by (dx, dy) screen points: the content follows the finger
 * point for point (translation is in screen units, never divided by the scale), up to the
 * clamp. Used with per-event deltas so a pinch's focal correction in between is kept.
 */
export function panBy(layout: Layout, s: number, tx: number, ty: number, dx: number, dy: number): [number, number] {
  'worklet';
  return clampTranslate(layout, s, finite(tx, 0) + finite(dx, 0), finite(ty, 0) + finite(dy, 0));
}
