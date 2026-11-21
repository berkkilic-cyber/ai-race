/**
 * The Garage's clock: wall time, so time away counts. Debug builds can skew it
 * (fast-forward) to show offline returns without waiting.
 */
let skew = 0;

export function garageNow(): number {
  return Date.now() + skew;
}

/** Debug: move the clock forward (or back) by `ms`. */
export function skewClock(ms: number): void {
  skew += ms;
}

export function clockSkew(): number {
  return skew;
}
