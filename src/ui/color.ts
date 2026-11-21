/** Small colour helpers (pure): hex parsing, mixing and WCAG contrast. */

export type RGB = [number, number, number];

export function parseHex(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Linear blend from colour a (t = 0) to colour b (t = 1). */
export function mixColor(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

/** WCAG relative luminance, 0..1. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The colour itself when it reaches `min` contrast on every background, otherwise
 * the closest step towards `toward` (ink on light themes, white on dark ones) that does.
 */
export function ensureContrast(color: string, backgrounds: readonly string[], min: number, toward: string): string {
  const ok = (c: string) => backgrounds.every((bg) => contrast(c, bg) >= min);
  if (ok(color)) return color;
  for (let i = 1; i <= 20; i++) {
    const c = mixColor(color, toward, i / 20);
    if (ok(c)) return c;
  }
  return toward;
}

/** Hue rotation in degrees (HSL), keeping saturation and lightness. */
export function rotateHue(hex: string, degrees: number): string {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex.toLowerCase();
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + degrees) % 360) + 360) % 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const k = h / 360;
  return rgbToHex([channel(k + 1 / 3) * 255, channel(k) * 255, channel(k - 1 / 3) * 255]);
}

/** HSL saturation of a colour, 0..1. */
export function saturationOf(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return 0;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/**
 * The colour with its HSL saturation raised to at least `min` (hue and lightness kept), so a
 * muted pack colour stays vivid on a dark ground. Greys and colours already vivid are returned as is.
 */
export function saturateTo(hex: string, min: number): string {
  const s = saturationOf(hex);
  if (s === 0 || s >= min) return hex;
  const rgb = parseHex(hex).map((v) => v / 255);
  const l = (Math.max(...rgb) + Math.min(...rgb)) / 2;
  // In HSL every channel sits at l + (c - l): scaling those distances changes saturation only.
  const k = min / s;
  // Never past the gamut: limit the scale so no channel leaves 0..1.
  const fit = Math.min(k, ...rgb.map((c) => (c > l ? (1 - l) / (c - l) : c < l ? l / (l - c) : Infinity)));
  return rgbToHex(rgb.map((c) => (l + (c - l) * fit) * 255) as RGB);
}

/** Hue of a colour in degrees (0..360), or null for greys. */
export function hueOf(hex: string): number | null {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d < 0.04) return null;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

/** Smallest angle between two hues, 0..180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * A colour whose hue sits at least `minHue` degrees from `avoid` (the player's colour), so
 * a rival never passes for the player on the map. Rotates away from `avoid` in the
 * direction it already leans; greys and colours already far enough are returned as is.
 */
export function distinctFrom(color: string, avoid: string, minHue: number): string {
  const h = hueOf(color);
  const a = hueOf(avoid);
  if (h === null || a === null) return color;
  const d = hueDistance(h, a);
  if (d >= minHue) return color;
  const signed = ((h - a + 540) % 360) - 180;
  return rotateHue(color, (signed >= 0 ? 1 : -1) * (minHue - d));
}

/** The tokens readableOn needs from a palette. */
export interface ReadableGround {
  bg: string;
  surface: string;
  player: string;
  /** The danger colour, for `alarmHue`. */
  alarm?: string;
}

export interface ReadableOptions {
  rival: boolean;
  /** Minimum hue distance of a rival from the player. */
  minHue: number;
  /** How far a rival is lifted towards `toward` first. */
  lift: number;
  /** Minimum hue distance of a rival from `ground.alarm` (0 or absent = no rule). */
  alarmHue?: number;
  /** Minimum HSL saturation of a rival (0 or absent = as it is). */
  sat?: number;
}

/**
 * A lab colour adjusted for one theme: rivals are first lifted `lift` of the way towards
 * `toward` (light tints on a dark drawing), moved away from the alarm's hue (`alarmHue`),
 * then from the player's hue (at least `minHue` degrees) and saturated to `sat`; then every
 * colour is stepped towards `toward` until it reaches `min` contrast on the theme's bg and
 * surface. Pure.
 */
export function readableOn(base: string, ground: ReadableGround, min: number, toward: string, opts: ReadableOptions): string {
  let c = base;
  if (opts.rival) {
    if (opts.lift > 0) c = mixColor(c, toward, opts.lift);
    if (opts.alarmHue && ground.alarm) c = distinctFrom(c, ground.alarm, opts.alarmHue);
    c = distinctFrom(c, ground.player, opts.minHue);
    if (opts.sat) c = saturateTo(c, opts.sat);
  }
  return ensureContrast(c, [ground.bg, ground.surface], min, toward);
}
