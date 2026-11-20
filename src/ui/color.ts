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
