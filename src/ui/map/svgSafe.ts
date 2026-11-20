/**
 * Guards for numbers and path data passed to react-native-svg. Browsers ignore an invalid
 * attribute; native renderers can throw (NaN or Infinity in a coordinate, a negative
 * radius or size, an empty or malformed path), which closes the app without a JS error.
 */

/** n when it is a finite number, otherwise the fallback. */
export function finiteOr(n: number, fallback: number): number {
  'worklet';
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

/** A length that must be zero or more (radius, width, height, stroke width). */
export function nonNegative(n: number): number {
  'worklet';
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Opacity clamped to 0..1 (0 when not a number). */
export function unitInterval(n: number): number {
  'worklet';
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** True when path data can be drawn: non-empty, starts with a move, no NaN or Infinity. */
export function isDrawablePath(d: string | null | undefined): d is string {
  if (typeof d !== 'string') return false;
  const s = d.trim();
  return s.length > 1 && /^[Mm]/.test(s) && !/NaN|Infinity/.test(s);
}

/** True when every number is finite. */
export function allFinite(...values: number[]): boolean {
  for (const v of values) if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  return true;
}
