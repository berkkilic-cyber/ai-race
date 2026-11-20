/**
 * When the map may move the view by itself. The view transform changes only on: the first
 * layout, the player's gestures and buttons, the explicit reset, centring when a region
 * panel opens, switches or closes, and the tutorial asking for the home region. These pure
 * helpers decide the automatic cases so they can be tested without a renderer.
 */

export interface Size {
  w: number;
  h: number;
}

/** Layout sizes are compared in whole points: native reports sub-pixel jitter on re-measure. */
export function roundSize(w: number, h: number): Size | null {
  if (!(Number.isFinite(w) && Number.isFinite(h)) || w <= 0 || h <= 0) return null;
  return { w: Math.round(w), h: Math.round(h) };
}

export type LayoutDecision =
  /** Same size (or no usable size): leave the view alone. */
  | 'none'
  /** First real layout: show the default view. */
  | 'first'
  /** The size changed and the player has not moved the view: fit the default view to the new size. */
  | 'refit'
  /** The size changed while the player has a view of their own: keep it, only clamp it into the new size. */
  | 'clamp';

/**
 * What a layout event should do to the view, given the last size the view was fitted to
 * (null before the first), the new size (null when unusable, e.g. a hidden tab reporting
 * 0×0) and whether the player has moved the view since the last fit or reset.
 */
export function layoutDecision(prev: Size | null, next: Size | null, userMoved: boolean): LayoutDecision {
  if (!next) return 'none';
  if (!prev) return 'first';
  if (prev.w === next.w && prev.h === next.h) return 'none';
  return userMoved ? 'clamp' : 'refit';
}

export type PanelDecision =
  /** Nothing about the panel changed: leave the view alone. */
  | 'none'
  /** A panel opened or switched region: centre that region beside it. */
  | 'centre'
  /** The panel closed: settle back into the full container (clamp only). */
  | 'settle';

/**
 * What a change of the side panel should do. `prevFocus`/`nextFocus` are the region the
 * panel shows (null when no panel covers the map). Settling back happens only when a
 * panel was actually open.
 */
export function panelDecision(prevFocus: string | null, nextFocus: string | null): PanelDecision {
  if (prevFocus === nextFocus) return 'none';
  if (nextFocus) return 'centre';
  return 'settle';
}

/**
 * Scale at which a region of the given on-screen size (points, at scale `s`) is at least
 * `minSide` on its shorter side, or null when it already is. Never zooms out.
 */
export function focusScale(s: number, sideW: number, sideH: number, minSide: number, maxScale: number): number | null {
  const side = Math.min(Math.abs(sideW), Math.abs(sideH));
  if (!(side > 0) || !Number.isFinite(s) || s <= 0) return null;
  if (side >= minSide) return null;
  const target = Math.min(maxScale, (s * minSide) / side);
  return target > s + 0.01 ? target : null;
}
