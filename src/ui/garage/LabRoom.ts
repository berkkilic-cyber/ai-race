import { allFinite, finiteOr } from '../map/svgSafe';

/**
 * Where things sit on the stage, shared by the bubbles over the lab (happenings, golden
 * moments, the bonus offer): the happening spots (door, desk, racks: each stage's pixel
 * room puts its door, desks and racks there, see the Art section of docs/GARAGE.md) and
 * the helpers that keep a bubble clear of the tap target. The room itself is drawn by
 * PixelRoom.tsx.
 */

/** A happening's spot in the room, in px (centre). `jx`/`jy` (0..1) nudge it a little. */
export function spotPosition(spot: string, jx: number, jy: number, w: number, h: number): { x: number; y: number } {
  const j = (v: number) => (finiteOr(v, 0.5) - 0.5) * 0.06;
  const at = (x: number, y: number) => ({ x: (x + j(jx)) * w, y: (y + j(jy)) * h });
  switch (spot) {
    case 'door':
      return at(0.14, 0.52);
    case 'desk':
      return at(0.2, 0.76);
    case 'rack':
      // On the floor in front of the racks, so its label never sits across them.
      return at(0.85, 0.79);
    default:
      return at(0.5, 0.35);
  }
}

/** A rectangle in the stage, in px (the tap target's outer ring, for the bubbles to keep clear of). */
export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The horizontal span a bubble at `x` may use without crossing the tap target: the side of
 * the stage it is on (with a small gap), or the whole width when it is above or below it.
 */
export function clearSpan(x: number, w: number, avoid: StageRect | null, gap = 4): { lo: number; hi: number } {
  if (!avoid || !allFinite(avoid.x, avoid.w)) return { lo: 2, hi: w - 2 };
  if (x < avoid.x) return { lo: 2, hi: Math.max(2, avoid.x - gap) };
  if (x > avoid.x + avoid.w) return { lo: Math.min(w - 2, avoid.x + avoid.w + gap), hi: w - 2 };
  return { lo: 2, hi: w - 2 };
}

/** Whether two rectangles overlap. */
export function overlaps(a: StageRect, b: StageRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
