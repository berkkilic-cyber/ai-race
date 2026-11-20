import type { TargetRect } from './targets';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlaceInput {
  /** Cut-outs; the caption is placed beside the first and avoids all of them. */
  holes: readonly TargetRect[];
  screen: { width: number; height: number };
  /** Safe-area insets: the caption stays inside them. */
  insets: { top: number; right: number; bottom: number; left: number };
  card: { width: number; height: number };
  /** Space between the caption and its target, and from the screen edges. */
  gap?: number;
  /** Preferred side when several fit. */
  prefer?: 'side' | 'vertical';
  /** Beside the target: centred on it, or level with its bottom edge (keeps a headline above clear). */
  sideAlign?: 'centre' | 'end';
}

/** Padding drawn around a target in the cut-out. */
export const HOLE_PAD = 6;

/** A target rect grown by the cut-out padding and clamped to the screen. */
export function holeFor(r: TargetRect, screen: { width: number; height: number }, pad = HOLE_PAD): TargetRect {
  const x = Math.max(0, r.x - pad);
  const y = Math.max(0, r.y - pad);
  const right = Math.min(screen.width, r.x + r.width + pad);
  const bottom = Math.min(screen.height, r.y + r.height + pad);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

function overlaps(a: Box, b: TargetRect): boolean {
  return a.left < b.x + b.width && a.right > b.x && a.top < b.y + b.height && a.bottom > b.y;
}

function overlapArea(a: Box, b: TargetRect): number {
  const w = Math.min(a.right, b.x + b.width) - Math.max(a.left, b.x);
  const h = Math.min(a.bottom, b.y + b.height) - Math.max(a.top, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Where the caption card goes: beside its first target (below, above, right or left,
 * whichever fits inside the safe area without covering any target), else the safe
 * position covering the least of the targets. Centred when there is no target.
 */
export function placeCaption({ holes, screen, insets, card, gap = 10, prefer = 'vertical', sideAlign = 'centre' }: PlaceInput): { left: number; top: number } {
  const minX = insets.left + gap;
  const minY = insets.top + gap;
  const maxX = Math.max(minX, screen.width - insets.right - gap - card.width);
  const maxY = Math.max(minY, screen.height - insets.bottom - gap - card.height);
  const clampX = (x: number) => Math.min(maxX, Math.max(minX, x));
  const clampY = (y: number) => Math.min(maxY, Math.max(minY, y));
  const box = (left: number, top: number): Box => ({ left, top, right: left + card.width, bottom: top + card.height });

  const target = holes[0];
  if (!target) return { left: clampX((screen.width - card.width) / 2), top: clampY((screen.height - card.height) / 2) };

  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  const below = { left: clampX(cx - card.width / 2), top: target.y + target.height + gap };
  const above = { left: clampX(cx - card.width / 2), top: target.y - gap - card.height };
  const sideTop = clampY(sideAlign === 'end' ? target.y + target.height - card.height : cy - card.height / 2);
  const right = { left: target.x + target.width + gap, top: sideTop };
  const left = { left: target.x - gap - card.width, top: sideTop };
  const order = prefer === 'side' ? [right, left, below, above] : [below, above, right, left];

  const inside = (p: { left: number; top: number }) => p.left >= minX - 0.5 && p.left <= maxX + 0.5 && p.top >= minY - 0.5 && p.top <= maxY + 0.5;
  for (const p of order) {
    if (inside(p) && !holes.some((h) => overlaps(box(p.left, p.top), h))) return p;
  }
  // Nothing fits cleanly: clamp each candidate into the safe area and take the one that covers least.
  let best = { left: clampX(below.left), top: clampY(below.top) };
  let bestCover = Infinity;
  for (const p of order) {
    const c = { left: clampX(p.left), top: clampY(p.top) };
    const cover = holes.reduce((sum, h) => sum + overlapArea(box(c.left, c.top), h), 0);
    if (cover < bestCover) {
      best = c;
      bestCover = cover;
    }
  }
  return best;
}

/**
 * Full-screen path with rounded-rect holes, for an even-odd fill (the dim layer).
 * Every number is finite; holes of zero size are left out.
 */
export function dimPath(screen: { width: number; height: number }, holes: readonly TargetRect[], radius = 10): string {
  const n = (v: number) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
  const w = n(Math.max(0, screen.width));
  const h = n(Math.max(0, screen.height));
  let d = `M0 0H${w}V${h}H0Z`;
  for (const hole of holes) {
    if (!(hole.width > 0 && hole.height > 0)) continue;
    const r = Math.max(0, Math.min(radius, hole.width / 2, hole.height / 2));
    const x = n(hole.x);
    const y = n(hole.y);
    const x2 = n(hole.x + hole.width);
    const y2 = n(hole.y + hole.height);
    const rr = n(r);
    d += `M${n(x + r)} ${y}H${n(x2 - r)}A${rr} ${rr} 0 0 1 ${x2} ${n(y + r)}V${n(y2 - r)}A${rr} ${rr} 0 0 1 ${n(x2 - r)} ${y2}H${n(x + r)}A${rr} ${rr} 0 0 1 ${x} ${n(y2 - r)}V${n(y + r)}A${rr} ${rr} 0 0 1 ${n(x + r)} ${y}Z`;
  }
  return d;
}

/** The four rects around a hole that block touches everywhere else. */
export function blockersAround(hole: TargetRect, screen: { width: number; height: number }): TargetRect[] {
  const right = hole.x + hole.width;
  const bottom = hole.y + hole.height;
  return [
    { x: 0, y: 0, width: screen.width, height: Math.max(0, hole.y) },
    { x: 0, y: bottom, width: screen.width, height: Math.max(0, screen.height - bottom) },
    { x: 0, y: hole.y, width: Math.max(0, hole.x), height: hole.height },
    { x: right, y: hole.y, width: Math.max(0, screen.width - right), height: hole.height },
  ].filter((r) => r.width > 0 && r.height > 0);
}
