import { t } from './i18n';

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** Cash is in millions: 850 -> "$850M", 1200 -> "$1.2B", 2.5e6 -> "$2.5T". */
export function fmtCash(millions: number): string {
  const sign = millions < 0 ? '-' : '';
  const m = Math.abs(millions);
  if (m >= 1e6) return `${sign}$${trim(m / 1e6, m >= 1e7 ? 0 : 1)}T`;
  if (m >= 1000) return `${sign}$${trim(m / 1000, m >= 1e4 ? 0 : 1)}B`;
  if (m >= 10) return `${sign}$${Math.round(m)}M`;
  if (m >= 1) return `${sign}$${trim(m, 1)}M`;
  return `${sign}$${trim(m, 2)}M`;
}

/** 950 -> "950", 1234 -> "1.2K", 3.4e6 -> "3.4M", 12.34 -> "12", 3.45 -> "3.5". */
export function fmtCompact(n: number): string {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (a >= size) {
      const v = a / size;
      return `${sign}${trim(v, v >= 100 ? 0 : 1)}${suffix}`;
    }
  }
  if (a >= 10) return `${sign}${Math.round(a)}`;
  return `${sign}${trim(a, 1)}`;
}

/** Users are in millions: 0.5 -> "500K", 12 -> "12M", 1400 -> "1.4B". */
export function fmtUsers(millions: number): string {
  return fmtCompact(millions * 1e6);
}

/** Fraction 0..1 -> "12%"; small values keep a decimal ("0.4%"); zero is "0%". */
export function fmtPct(fraction: number): string {
  const p = fraction * 100;
  if (p === 0) return '0%';
  if (Math.abs(p) < 10) return `${trim(p, 1)}%`;
  return `${Math.round(p)}%`;
}

/** Tick 0 is day 1. */
export function fmtDay(tick: number): string {
  return t('ui.top.day', { day: tick + 1 });
}

/** Signed per-day amount, e.g. "+$2.4M/day". */
export function fmtPerDay(value: string): string {
  return t('ui.resource.perDay', { amount: value });
}

/** Region attribute 0..1 shown as 1..5 pips. */
export function toPips(value: number, max = 5): number {
  return Math.max(1, Math.min(max, Math.round(value * max)));
}
