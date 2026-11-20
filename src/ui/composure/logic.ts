import type { Meters } from '@/engine';

/** 0 calm, 1 uneasy, 2 tense, 3 critical. */
export type ComposureLevel = 0 | 1 | 2 | 3;
export type MeterKey = keyof Meters;

export interface Composure {
  level: ComposureLevel;
  /** The meter with the highest value (the one driving the level). */
  driver: MeterKey;
  /** That meter's value, 0..100. */
  value: number;
}

/** Lower bounds of levels 1, 2 and 3 (docs/DESIGN.md): < 40 calm, 40-64 uneasy, 65-84 tense, >= 85 critical. */
export const COMPOSURE_THRESHOLDS = [40, 65, 85] as const;

/** Ticker speed multiplier per level. */
export const TICKER_SPEED: Record<ComposureLevel, number> = { 0: 1, 1: 1.3, 2: 1.7, 3: 2.2 };

/** Order used to break ties between equal meters. */
const METER_ORDER: readonly MeterKey[] = ['regulation', 'backlash', 'rival'];

/** Key of the tabloid tag that names a danger; the pack may override the UI fallback. */
export function dangerKey(meter: MeterKey): string {
  return `term.danger.${meter}`;
}

export function levelFor(value: number): ComposureLevel {
  if (value >= COMPOSURE_THRESHOLDS[2]) return 3;
  if (value >= COMPOSURE_THRESHOLDS[1]) return 2;
  if (value >= COMPOSURE_THRESHOLDS[0]) return 1;
  return 0;
}

/** Composure from the three meters: the level of the highest one, and which one it is. */
export function composureOf(meters: Meters, forced: ComposureLevel | null = null): Composure {
  let driver: MeterKey = METER_ORDER[0];
  for (const key of METER_ORDER) if (meters[key] > meters[driver]) driver = key;
  const value = meters[driver];
  return { level: forced ?? levelFor(value), driver, value };
}
