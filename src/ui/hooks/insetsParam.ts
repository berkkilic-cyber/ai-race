/** Safe-area insets in points (same shape as react-native-safe-area-context's EdgeInsets). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ZERO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Parses the debug query `insets=top,right,bottom,left` (points, non-negative numbers).
 * Returns null when the parameter is absent or malformed.
 */
export function parseInsetsParam(search: string): Insets | null {
  const match = /[?&]insets=([^&#]*)/.exec(search);
  if (!match) return null;
  const parts = decodeURIComponent(match[1]).split(',').map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => p === '')) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [top, right, bottom, left] = nums;
  return { top, right, bottom, left };
}

