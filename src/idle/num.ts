/**
 * Big numbers as plain doubles. Content is tuned so a long save stays far below
 * MAX_AMOUNT (about 1e300; doubles reach 1.8e308), and doubles keep 15 to 16 significant
 * digits, which is more than any display or comparison here needs. Every amount written
 * to state passes through `amount()`, so NaN, negatives and infinities can never stick.
 */
export const MAX_AMOUNT = 1e300;

/** A finite amount in 0..MAX_AMOUNT (NaN and negatives become 0, overflow the cap). */
export function amount(n: number): number {
  if (Number.isNaN(n) || n <= 0) return 0;
  return n > MAX_AMOUNT ? MAX_AMOUNT : n;
}

/** A finite number or the fallback. */
export function finite(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

function trim(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/**
 * Short form for big amounts: 950 → "950", 12345 → "12.3K", 4.2e9 → "4.2B",
 * up to "Vg" (1e63), then scientific ("1.23e72"). Three significant figures above 1,000;
 * below 1,000 whole numbers (one decimal under 10 when `decimals` allows).
 */
export function formatAmount(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '0';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a < 1000) {
    if (a < 10 && decimals > 0 && a !== Math.floor(a)) return sign + trim(a.toFixed(decimals));
    return sign + String(Math.floor(a));
  }
  let tier = Math.floor(Math.log10(a) / 3);
  // log10 can land a hair under the true tier (999.9999 → "1000K"); step up when it does.
  let scaled = a / Math.pow(10, tier * 3);
  if (scaled >= 999.5) {
    tier += 1;
    scaled = a / Math.pow(10, tier * 3);
  }
  if (tier >= SUFFIXES.length) {
    const exp = Math.floor(Math.log10(a));
    let mant = a / Math.pow(10, exp);
    let e = exp;
    if (mant >= 9.995) {
      mant /= 10;
      e += 1;
    }
    return `${sign}${trim(mant.toFixed(2))}e${e}`;
  }
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${sign}${trim(scaled.toFixed(digits))}${SUFFIXES[tier]}`;
}

/** A duration as "3h 12m", "4m 05s", "12s". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(finite(ms) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
