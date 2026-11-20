import { getPackEntry } from '../packs';
import { focusScale, layoutDecision, panelDecision, roundSize } from '../map/viewPolicy';
import { clampTranslate, fit, panBy, toScreenPoint, type Layout } from '../map/viewTransform';
import { wideShellLayout } from '../shell/shellLayout';
import { layout as themeLayout } from '../theme';

const { geometry } = getPackEntry();

describe('view refit policy', () => {
  it('rounds sizes to whole points and rejects unusable ones', () => {
    expect(roundSize(832.6667, 331.3333)).toEqual({ w: 833, h: 331 });
    expect(roundSize(0, 300)).toBeNull();
    expect(roundSize(NaN, 300)).toBeNull();
  });

  it('fits on the first real layout only', () => {
    expect(layoutDecision(null, { w: 800, h: 330 }, false)).toBe('first');
    expect(layoutDecision(null, null, false)).toBe('none');
  });

  it('ignores repeat layouts of the same rounded size (native re-measures), moved or not', () => {
    const a = roundSize(832.6667, 331.3333);
    const b = roundSize(832.66666, 331.33331);
    expect(layoutDecision(a, b, false)).toBe('none');
    expect(layoutDecision(a, b, true)).toBe('none');
  });

  it('ignores a hidden tab reporting 0x0', () => {
    expect(layoutDecision({ w: 800, h: 330 }, roundSize(0, 0), true)).toBe('none');
  });

  it('refits a real size change only while the player has not moved the view', () => {
    expect(layoutDecision({ w: 800, h: 330 }, { w: 800, h: 304 }, false)).toBe('refit');
    expect(layoutDecision({ w: 800, h: 330 }, { w: 800, h: 304 }, true)).toBe('clamp');
  });

  it('moves the view for the panel only when the panel actually changes', () => {
    expect(panelDecision(null, null)).toBe('none');
    expect(panelDecision('japan', 'japan')).toBe('none');
    expect(panelDecision(null, 'japan')).toBe('centre');
    expect(panelDecision('japan', 'india')).toBe('centre');
    expect(panelDecision('japan', null)).toBe('settle');
  });

  it('focusScale zooms a small region up to the minimum side, never out, within the max', () => {
    expect(focusScale(1, 30, 50, 110, 8)).toBeCloseTo(110 / 30);
    expect(focusScale(1, 200, 150, 110, 8)).toBeNull();
    expect(focusScale(2, 5, 5, 110, 8)).toBe(8);
    expect(focusScale(1, 0, 10, 110, 8)).toBeNull();
  });
});

/** The map area of the wide shell on an iPhone 13 Pro Max in landscape (insets 0,47,21,47). */
function phoneLayout(insetRight = 0): Layout {
  const shell = wideShellLayout(926, 428, { top: 0, right: 47, bottom: 21, left: 47 });
  const ch = shell.stageHeight;
  return { cw: shell.main.width, ch, mw: geometry.width, mh: geometry.height, insetRight };
}

describe('pan maths', () => {
  const l = phoneLayout();

  it('the phone map area excludes the rail, the strip, the ticker and the safe areas', () => {
    expect(l.cw).toBe(926 - 47 - themeLayout.railWidth - 47);
    expect(l.ch).toBeLessThan(428 - 21);
  });

  it.each([1, 2, 4])('at scale %d a drag moves the content point for point until the clamp', (s) => {
    // Start centred, then drag by small steps in each direction.
    const [x0, y0] = clampTranslate(l, s, 0, 0);
    const p = [geometry.width / 2, geometry.height / 2] as const;
    const before = toScreenPoint(l, s, x0, y0, p[0], p[1]);
    for (const [dx, dy] of [
      [12, 0],
      [-12, 0],
      [0, 9],
      [0, -9],
    ]) {
      const [x1, y1] = panBy(l, s, x0, y0, dx, dy);
      const after = toScreenPoint(l, s, x1, y1, p[0], p[1]);
      const { k } = fit(l);
      // Horizontal slack exists from scale 1 (the world is wider than the area); vertical from scale 2.
      const slackX = l.mw * k * s - l.cw;
      const slackY = l.mh * k * s - l.ch;
      expect(after[0] - before[0]).toBeCloseTo(slackX > 2 * Math.abs(dx) ? dx : after[0] - before[0]);
      expect(after[1] - before[1]).toBeCloseTo(slackY > 2 * Math.abs(dy) ? dy : 0);
    }
  });

  it.each([2, 4])('at scale %d the clamp stops with the map edge at the container edge, never past it', (s) => {
    const { k, ox, oy } = fit(l);
    const [xr, yr] = panBy(l, s, 0, 0, 1e6, 1e6);
    // Dragged far right/down: the map's left/top edge sits at 0.
    expect(toScreenPoint(l, s, xr, yr, 0, 0)[0]).toBeCloseTo(0);
    expect(toScreenPoint(l, s, xr, yr, 0, 0)[1]).toBeCloseTo(0);
    const [xl, yl] = panBy(l, s, 0, 0, -1e6, -1e6);
    // Dragged far left/up: the right/bottom edge sits at the container's right/bottom.
    const edge = toScreenPoint(l, s, xl, yl, l.mw, l.mh);
    expect(edge[0]).toBeCloseTo(l.cw);
    expect(edge[1]).toBeCloseTo(l.ch);
    // Plenty of slack at these scales: a drag of 50 points moves the content 50 points.
    const [x50] = panBy(l, s, 0, 0, 50, 0);
    expect(toScreenPoint(l, s, x50, 0, 100, 100)[0] - toScreenPoint(l, s, 0, 0, 100, 100)[0]).toBeCloseTo(50);
    expect(ox).toBeGreaterThanOrEqual(0);
    expect(oy).toBeGreaterThanOrEqual(0);
    expect(k).toBeGreaterThan(0);
  });

  it('with the side panel open the right-hand clamp is the panel edge', () => {
    const panel = 360;
    const lp = phoneLayout(panel);
    const [xl] = panBy(lp, 4, 0, 0, -1e6, 0);
    expect(toScreenPoint(lp, 4, xl, 0, lp.mw, 0)[0]).toBeCloseTo(lp.cw - panel);
    const [xr] = panBy(lp, 4, 0, 0, 1e6, 0);
    expect(toScreenPoint(lp, 4, xr, 0, 0, 0)[0]).toBeCloseTo(0);
  });

  it('survives junk deltas', () => {
    const [x, y] = panBy(l, 2, 10, 10, NaN, Infinity);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });
});
