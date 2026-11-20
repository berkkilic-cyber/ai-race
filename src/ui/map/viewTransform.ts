/**
 * Pan/zoom maths for the map. The SVG fills its container with "meet" scaling;
 * a view transform (translate t, then scale s around the container centre c)
 * moves it: screen = c + t + s * (p - c). All functions are worklets so the
 * gesture callbacks can call them on the UI thread.
 */
export interface Layout {
  /** Container size. */
  cw: number;
  ch: number;
  /** Map size in map units. */
  mw: number;
  mh: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

/** Map units -> untransformed container points. */
export function fit(layout: Layout): { k: number; ox: number; oy: number } {
  'worklet';
  const k = Math.min(layout.cw / layout.mw, layout.ch / layout.mh);
  return { k, ox: (layout.cw - layout.mw * k) / 2, oy: (layout.ch - layout.mh * k) / 2 };
}

export function clampScale(s: number): number {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Keeps the map covering the container where it can, centred where it cannot. */
export function clampTranslate(layout: Layout, s: number, tx: number, ty: number): [number, number] {
  'worklet';
  const { k, ox, oy } = fit(layout);
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  const axis = (t: number, c: number, size: number, o: number, len: number): number => {
    // Content edges after transform: c + t + s*(o - c) and c + t + s*(o + len - c).
    const hi = -c - s * (o - c); // left edge at 0
    const lo = size - c - s * (o + len - c); // right edge at size
    if (lo > hi) return (lo + hi) / 2;
    return Math.min(hi, Math.max(lo, t));
  };
  return [axis(tx, cx, layout.cw, ox, layout.mw * k), axis(ty, cy, layout.ch, oy, layout.mh * k)];
}

/** New translation that keeps the focal point (container coords) fixed while scale goes from s0 to s1. */
export function zoomAbout(layout: Layout, s0: number, s1: number, tx: number, ty: number, fx: number, fy: number): [number, number] {
  'worklet';
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  const r = s1 / s0;
  return [fx - cx - r * (fx - cx - tx), fy - cy - r * (fy - cy - ty)];
}

/** Translation that centres a map point at scale s. */
export function centreOn(layout: Layout, s: number, x: number, y: number): [number, number] {
  'worklet';
  const { k, ox, oy } = fit(layout);
  const px = ox + x * k;
  const py = oy + y * k;
  return clampTranslate(layout, s, -s * (px - layout.cw / 2), -s * (py - layout.ch / 2));
}

/** Container point (e.g. a tap) -> map units, undoing the view transform and the fit. */
export function toMapPoint(layout: Layout, s: number, tx: number, ty: number, px: number, py: number): [number, number] {
  'worklet';
  const { k, ox, oy } = fit(layout);
  const cx = layout.cw / 2;
  const cy = layout.ch / 2;
  const qx = cx + (px - cx - tx) / s;
  const qy = cy + (py - cy - ty) / s;
  return [(qx - ox) / k, (qy - oy) / k];
}
