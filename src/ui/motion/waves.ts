/** Ambient wave shapes, as worklets (pure: no Reanimated import, so tests can use them). */

/** A smooth 0..1..0 wave with the given period in seconds; 0 at t = 0 (rest). */
export function wave(t: number, period: number): number {
  'worklet';
  if (!(period > 0) || !Number.isFinite(t)) return 0;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / period);
}

/**
 * A short shake every `period` seconds: out to -amp, across to +amp, back to 0 in
 * `stepS` steps, then still. 0 at t = 0.
 */
export function shakeAt(t: number, period: number, amp: number, stepS: number): number {
  'worklet';
  if (!(period > 0) || !(stepS > 0) || !Number.isFinite(t)) return 0;
  const p = t % period;
  if (p < stepS) return (-amp * p) / stepS;
  if (p < 2 * stepS) return -amp + (2 * amp * (p - stepS)) / stepS;
  if (p < 3 * stepS) return amp - (amp * (p - 2 * stepS)) / stepS;
  return 0;
}
