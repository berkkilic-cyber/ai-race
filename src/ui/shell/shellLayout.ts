import { layout } from '../theme';

/** Safe-area insets in points (same shape as react-native-safe-area-context's EdgeInsets). */
export interface EdgeInsetsLike {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The wide (landscape) shell, computed in one place from the window size and the safe-area
 * insets. Everything is in points, measured from the window's top-left corner.
 *
 * - The rail runs the full height at the left edge. Its background extends under the left
 *   inset; its tabs sit inside the safe area (paddingLeft = left inset).
 * - The main column (top strip, main area, ticker) starts exactly at the rail's right edge
 *   and ends at the right inset, so the speed control and the side panel stay clear of a
 *   notch or Dynamic Island on either side.
 * - The ticker band reaches the bottom edge of the window; its text sits above the bottom
 *   inset (home indicator).
 */
export interface WideShellLayout {
  rail: { width: number; paddingLeft: number; paddingTop: number };
  main: { left: number; top: number; right: number; width: number; height: number };
  stripWidth: number;
  /** Height of the main area between the top strip and the ticker. */
  stageHeight: number;
  ticker: { height: number; paddingBottom: number };
}

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function wideShellLayout(width: number, height: number, insets: EdgeInsetsLike): WideShellLayout {
  const left = nonNeg(insets.left);
  const right = nonNeg(insets.right);
  const top = nonNeg(insets.top);
  const bottom = nonNeg(insets.bottom);
  const railWidth = left + layout.railWidth;
  const mainWidth = Math.max(0, width - railWidth - right);
  const mainHeight = Math.max(0, height - top);
  const tickerHeight = layout.tickerHeight + bottom;
  return {
    rail: { width: railWidth, paddingLeft: left, paddingTop: top + layout.stripHeight },
    main: { left: railWidth, top, right, width: mainWidth, height: mainHeight },
    stripWidth: mainWidth,
    stageHeight: Math.max(0, mainHeight - layout.stripHeight - tickerHeight),
    ticker: { height: tickerHeight, paddingBottom: bottom },
  };
}

/**
 * The narrow (portrait) shell: header, content and ticker inset on top and both sides;
 * the tab bar's background reaches the bottom and side edges with its tabs inside the
 * safe area.
 */
export interface NarrowShellLayout {
  main: { marginTop: number; marginLeft: number; marginRight: number };
  tabBar: { paddingLeft: number; paddingRight: number; paddingBottom: number };
}

export function narrowShellLayout(insets: EdgeInsetsLike): NarrowShellLayout {
  return {
    main: { marginTop: nonNeg(insets.top), marginLeft: nonNeg(insets.left), marginRight: nonNeg(insets.right) },
    tabBar: { paddingLeft: nonNeg(insets.left), paddingRight: nonNeg(insets.right), paddingBottom: nonNeg(insets.bottom) },
  };
}
