/**
 * The Garage's clock: wall time, so time away counts. Debug builds can skew it
 * (fast-forward) to show offline returns without waiting.
 */
let skew = 0;
let frozenAt: number | null = null;

export function garageNow(): number {
  return frozenAt ?? Date.now() + skew;
}

/** Debug: stop the clock (no production, nothing expires) or let it run again from where it stopped. */
export function freezeClock(on: boolean): void {
  if (on && frozenAt === null) frozenAt = Date.now() + skew;
  if (!on && frozenAt !== null) {
    skew = frozenAt - Date.now();
    frozenAt = null;
  }
}

/** Debug: move the clock forward (or back) by `ms`. */
export function skewClock(ms: number): void {
  skew += ms;
}

export function clockSkew(): number {
  return skew;
}
