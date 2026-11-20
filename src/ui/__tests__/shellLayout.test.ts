import { parseInsetsParam } from '../hooks/insetsParam';
import { crawlGeometry, MEASURE_WIDTH } from '../shell/crawl';
import { narrowShellLayout, wideShellLayout } from '../shell/shellLayout';
import { layout } from '../theme';

/** iPhone with a Dynamic Island in landscape: iOS reports the side inset on both sides. */
const ISLAND = { top: 0, right: 59, bottom: 21, left: 59 };
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

describe('wideShellLayout', () => {
  it('matches the plain layout with zero insets', () => {
    const l = wideShellLayout(844, 390, ZERO);
    expect(l.rail).toEqual({ width: layout.railWidth, paddingLeft: 0, paddingTop: layout.stripHeight });
    expect(l.main).toEqual({ left: layout.railWidth, top: 0, right: 0, width: 844 - layout.railWidth, height: 390 });
    expect(l.ticker).toEqual({ height: layout.tickerHeight, paddingBottom: 0 });
    expect(l.stageHeight).toBe(390 - layout.stripHeight - layout.tickerHeight);
  });

  it('adds the left inset to the rail once and starts the main area at its right edge', () => {
    const l = wideShellLayout(859, 396, ISLAND);
    expect(l.rail.width).toBe(59 + layout.railWidth);
    expect(l.rail.paddingLeft).toBe(59);
    // The tabs' content box is exactly railWidth wide: never zero, never negative.
    expect(l.rail.width - l.rail.paddingLeft).toBe(layout.railWidth);
    expect(l.main.left).toBe(l.rail.width);
    expect(l.main.right).toBe(59);
    expect(l.main.left + l.main.width + l.main.right).toBe(859);
    expect(l.stripWidth).toBe(859 - 59 - layout.railWidth - 59);
  });

  it('extends the ticker band under the bottom inset with its text above it', () => {
    const l = wideShellLayout(859, 396, ISLAND);
    expect(l.ticker).toEqual({ height: layout.tickerHeight + 21, paddingBottom: 21 });
    expect(l.main.height).toBe(396);
    expect(l.stageHeight).toBe(396 - layout.stripHeight - layout.tickerHeight - 21);
    expect(layout.stripHeight + l.stageHeight + l.ticker.height).toBe(l.main.height);
  });

  it('handles both rotation directions (cutout on the left or on the right)', () => {
    const cutoutLeft = wideShellLayout(800, 360, { top: 0, right: 0, bottom: 0, left: 48 });
    expect(cutoutLeft.rail.width).toBe(48 + layout.railWidth);
    expect(cutoutLeft.main.left).toBe(48 + layout.railWidth);
    expect(cutoutLeft.main.right).toBe(0);
    expect(cutoutLeft.main.width).toBe(800 - 48 - layout.railWidth);

    const cutoutRight = wideShellLayout(800, 360, { top: 0, right: 48, bottom: 0, left: 0 });
    expect(cutoutRight.rail.width).toBe(layout.railWidth);
    expect(cutoutRight.main.left).toBe(layout.railWidth);
    expect(cutoutRight.main.right).toBe(48);
    expect(cutoutRight.main.width).toBe(800 - 48 - layout.railWidth);
  });

  it('offsets everything by the top inset and the rail tabs below the strip', () => {
    const l = wideShellLayout(900, 420, { top: 24, right: 0, bottom: 0, left: 0 });
    expect(l.main.top).toBe(24);
    expect(l.main.height).toBe(396);
    expect(l.rail.paddingTop).toBe(24 + layout.stripHeight);
  });

  it('ignores negative or invalid insets and never returns negative sizes', () => {
    const l = wideShellLayout(100, 60, { top: -5, right: Number.NaN, bottom: 200, left: 80 });
    expect(l.main.top).toBe(0);
    expect(l.main.right).toBe(0);
    expect(l.main.width).toBe(0);
    expect(l.stageHeight).toBe(0);
  });
});

describe('narrowShellLayout', () => {
  it('insets the content at the top and sides and pads the tab bar at the bottom', () => {
    const l = narrowShellLayout({ top: 59, right: 0, bottom: 34, left: 0 });
    expect(l.main).toEqual({ marginTop: 59, marginLeft: 0, marginRight: 0 });
    expect(l.tabBar).toEqual({ paddingLeft: 0, paddingRight: 0, paddingBottom: 34 });
  });
});

describe('parseInsetsParam', () => {
  it('reads top,right,bottom,left', () => {
    expect(parseInsetsParam('?debug=1&insets=0,59,21,59')).toEqual(ISLAND);
    expect(parseInsetsParam('?insets=1.5,2,3,4')).toEqual({ top: 1.5, right: 2, bottom: 3, left: 4 });
    expect(parseInsetsParam('?insets=0%2C59%2C21%2C59')).toEqual(ISLAND);
  });

  it('rejects missing or malformed values', () => {
    expect(parseInsetsParam('')).toBeNull();
    expect(parseInsetsParam('?debug=1')).toBeNull();
    expect(parseInsetsParam('?insets=1,2,3')).toBeNull();
    expect(parseInsetsParam('?insets=1,2,,4')).toBeNull();
    expect(parseInsetsParam('?insets=1,2,x,4')).toBeNull();
    expect(parseInsetsParam('?insets=1,-2,3,4')).toBeNull();
  });
});

describe('crawlGeometry', () => {
  it('does not crawl before the run is measured (first frame, no layout yet)', () => {
    expect(crawlGeometry(0, 600, false)).toEqual({ crawl: false, copies: 1, trackWidth: MEASURE_WIDTH });
    expect(crawlGeometry(300, 0, false).crawl).toBe(false);
    expect(crawlGeometry(Number.NaN, 600, false).crawl).toBe(false);
  });

  it('does not crawl when the run does not fit the measuring width, or with reduced motion', () => {
    expect(crawlGeometry(MEASURE_WIDTH, 600, false).crawl).toBe(false);
    expect(crawlGeometry(300, 600, true).crawl).toBe(false);
  });

  it('fills the box plus one run with copies and gives the track an explicit width', () => {
    const g = crawlGeometry(250, 600, false);
    expect(g.crawl).toBe(true);
    expect(g.copies).toBe(4);
    expect(g.copies * 250).toBeGreaterThanOrEqual(600 + 250);
    expect(g.trackWidth).toBeGreaterThanOrEqual(g.copies * 250);
    expect(crawlGeometry(2000, 600, false).copies).toBe(2);
  });
});
