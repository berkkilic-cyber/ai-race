import { formatAmount, formatDuration } from '@/idle';

import { t } from './i18n';
import { getCurrentLocale } from './locale/current';

/**
 * Number text for the UI, by hand: no Intl, no toLocaleString (slow, and engine-dependent).
 * English output is fixed by tests. Turkish (docs/GLOSSARY.tr.md, "Numbers"): decimal comma
 * ("0,5"), dot for thousands ("2.526"), percent sign first ("%43"), short units
 * B / Mn / Mr / Tn after a no-break space ("2,5 Mn"), dollar sign after the amount
 * ("1,2 Mr $"). The locale is a plain module read, so every call stays cheap.
 */

/** No-break space between a number and its unit, so they never wrap apart. */
const NBSP = ' ';

const isTr = () => getCurrentLocale() === 'tr';

function trim(n: number, digits: number): string {
  return n.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** Decimal point -> the locale's decimal mark (a plain "1.5" string from toFixed or String). */
function dec(s: string, tr: boolean): string {
  return tr ? s.replace('.', ',') : s;
}

/** Turkish short units for K / M / B / T. */
const TR_UNIT: Record<string, string> = { K: 'B', M: 'Mn', B: 'Mr', T: 'Tn' };

/** Cash is in millions: 850 -> "$850M", 1200 -> "$1.2B", 2.5e6 -> "$2.5T" (Turkish "850 Mn $", "1,2 Mr $"). */
export function fmtCash(millions: number): string {
  const sign = millions < 0 ? '-' : '';
  const m = Math.abs(millions);
  let value: string;
  let unit: string;
  if (m >= 1e6) [value, unit] = [trim(m / 1e6, m >= 1e7 ? 0 : 1), 'T'];
  else if (m >= 1000) [value, unit] = [trim(m / 1000, m >= 1e4 ? 0 : 1), 'B'];
  else if (m >= 10) [value, unit] = [String(Math.round(m)), 'M'];
  else if (m >= 1) [value, unit] = [trim(m, 1), 'M'];
  else [value, unit] = [trim(m, 2), 'M'];
  if (isTr()) return `${sign}${dec(value, true)}${NBSP}${TR_UNIT[unit]}${NBSP}$`;
  return `${sign}$${value}${unit}`;
}

/** 950 -> "950", 1234 -> "1.2K", 3.4e6 -> "3.4M", 12.34 -> "12", 3.45 -> "3.5" (Turkish "1,2 B", "3,4 Mn"). */
export function fmtCompact(n: number): string {
  const tr = isTr();
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
      const s = trim(v, v >= 100 ? 0 : 1);
      return tr ? `${sign}${dec(s, true)}${NBSP}${TR_UNIT[suffix]}` : `${sign}${s}${suffix}`;
    }
  }
  if (a >= 10) return `${sign}${Math.round(a)}`;
  return `${sign}${dec(trim(a, 1), tr)}`;
}

/**
 * Whole number with thousands separators: 1234567 -> "1,234,567" (Turkish "1.234.567").
 * Plain string work instead of toLocaleString/Intl, whose support differs between JS engines.
 */
export function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const sep = isTr() ? '.' : ',';
  const sign = n < 0 ? '-' : '';
  const digits = String(Math.round(Math.abs(n)));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += sep;
    out += digits[i];
  }
  return sign + out;
}

/** Users are in millions: 0.5 -> "500K", 12 -> "12M", 1400 -> "1.4B". */
export function fmtUsers(millions: number): string {
  return fmtCompact(millions * 1e6);
}

/**
 * A number that is already a percentage, with the sign where the locale puts it:
 * 43 -> "43%" (Turkish "%43"), -5 -> "-5%" ("-%5"), 0.4 -> "0.4%" ("%0,4").
 * Round before calling (a string is taken as English digits, e.g. from toFixed); this only
 * places the sign and the decimal mark.
 */
export function pctText(percent: number | string): string {
  return pctStr(String(percent));
}

/** pctText for a number already written in English digits ("0.4", "-5"). */
function pctStr(s: string): string {
  if (!isTr()) return `${s}%`;
  return s.charAt(0) === '-' ? `-%${dec(s.slice(1), true)}` : `%${dec(s, true)}`;
}

/** Fraction 0..1 -> "12%"; small values keep a decimal ("0.4%"); zero is "0%". */
export function fmtPct(fraction: number): string {
  const p = fraction * 100;
  if (p === 0) return pctStr('0');
  if (Math.abs(p) < 10) return pctStr(trim(p, 1));
  return pctStr(String(Math.round(p)));
}

/** A plain number with at most `digits` decimals, trailing zeros dropped: 1.50 -> "1.5" (Turkish "1,5"). */
export function fmtNum(n: number, digits = 1): string {
  return dec(trim(n, digits), isTr());
}

/** A number with exactly `digits` decimals: 82 -> "82.0" (Turkish "82,0"). */
export function fmtFixed(n: number, digits = 1): string {
  return dec(n.toFixed(digits), isTr());
}

/**
 * Idle-mode big amounts (src/idle formatAmount: "12.3K", "4.2B", "1.5Qa", "1.23e72"), with
 * the Turkish decimal comma and units ("12,3 B", "4,2 Mr", "1,5 Qa"). Turkish has no short
 * forms past trilyon, so the idle letters from Qa up stay.
 */
export function fmtAmount(n: number, decimals = 1): string {
  const s = formatAmount(n, decimals);
  if (!isTr()) return s;
  let i = s.length;
  while (i > 0) {
    const c = s.charCodeAt(i - 1);
    if (c < 65 || c > 122 || (c > 90 && c < 97)) break; // stop at the first non-letter from the end
    i--;
  }
  if (i === s.length || s.indexOf('e') > 0) return dec(s, true);
  const unit = s.slice(i);
  return `${dec(s.slice(0, i), true)}${NBSP}${TR_UNIT[unit] ?? unit}`;
}

/** A duration as "3h 12m", "4m 05s", "12s" (Turkish "3 sa 12 dk", "4 dk 05 sn", "12 sn", "2 gün 4 sa"). */
export function fmtDuration(ms: number): string {
  if (!isTr()) return formatDuration(ms);
  const s = Math.max(0, Math.floor(Number.isFinite(ms) ? ms / 1000 : 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return h > 0 ? `${d}${NBSP}gün ${h}${NBSP}sa` : `${d}${NBSP}gün`;
  if (h > 0) return m > 0 ? `${h}${NBSP}sa ${m}${NBSP}dk` : `${h}${NBSP}sa`;
  if (m > 0) return `${m}${NBSP}dk ${String(sec).padStart(2, '0')}${NBSP}sn`;
  return `${sec}${NBSP}sn`;
}

/** Hours with one decimal: 0.5 -> "0.5 h" (Turkish "0,5 sa"). */
export function fmtHours(hours: number): string {
  return isTr() ? `${fmtNum(hours)}${NBSP}sa` : `${fmtNum(hours)} h`;
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
