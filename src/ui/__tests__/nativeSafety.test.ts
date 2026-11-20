import { shakeAt, wave } from '../motion/waves';
import { allFinite, finiteOr, isDrawablePath, nonNegative, unitInterval } from '../map/svgSafe';
import { centreOn, clampScale, clampTranslate, fit, toMapPoint, zoomAbout, type Layout } from '../map/viewTransform';

describe('ambient waves', () => {
  it('rest at t = 0 and stay within 0..1', () => {
    expect(wave(0, 0.9)).toBe(0);
    for (let t = 0; t < 5; t += 0.07) {
      const v = wave(t, 1.3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(wave(0.45, 0.9)).toBeCloseTo(1);
  });
  it('never return NaN', () => {
    expect(wave(Number.NaN, 1)).toBe(0);
    expect(wave(1, 0)).toBe(0);
    expect(shakeAt(Number.NaN, 1, 1, 0.1)).toBe(0);
  });
  it('shake is still at t = 0 and after its three steps', () => {
    expect(shakeAt(0, 0.88, 1.2, 0.06)).toBeCloseTo(0);
    expect(shakeAt(0.06, 0.88, 1.2, 0.06)).toBeCloseTo(-1.2);
    expect(shakeAt(0.12, 0.88, 1.2, 0.06)).toBeCloseTo(1.2);
    expect(shakeAt(0.5, 0.88, 1.2, 0.06)).toBe(0);
  });
});

describe('svg guards', () => {
  it('reject numbers native SVG cannot take', () => {
    expect(finiteOr(Number.NaN, 3)).toBe(3);
    expect(finiteOr(Infinity, 3)).toBe(3);
    expect(nonNegative(-2)).toBe(0);
    expect(nonNegative(Number.NaN)).toBe(0);
    expect(unitInterval(1.4)).toBe(1);
    expect(unitInterval(Number.NaN)).toBe(0);
    expect(allFinite(1, 2, Number.NaN)).toBe(false);
  });
  it('reject empty and malformed paths', () => {
    expect(isDrawablePath('')).toBe(false);
    expect(isDrawablePath('  ')).toBe(false);
    expect(isDrawablePath(undefined)).toBe(false);
    expect(isDrawablePath('M1 NaNh.01')).toBe(false);
    expect(isDrawablePath('M1 2h.01')).toBe(true);
  });
});

describe('view transform before the first layout', () => {
  const zero: Layout = { cw: 0, ch: 0, mw: 400, mh: 200 };
  const finite = (xs: number[]) => xs.every((x) => Number.isFinite(x));
  it('returns finite numbers for a zero-sized container', () => {
    expect(fit(zero).k).toBeGreaterThan(0);
    expect(finite(clampTranslate(zero, 1, 0, 0))).toBe(true);
    expect(finite(centreOn(zero, 2, 100, 50))).toBe(true);
    expect(finite(toMapPoint(zero, 1, 0, 0, 10, 10))).toBe(true);
  });
  it('survives a pinch reporting 0 or NaN', () => {
    const l: Layout = { cw: 800, ch: 300, mw: 400, mh: 200 };
    expect(clampScale(Number.NaN)).toBe(1);
    expect(finite(zoomAbout(l, 0, 2, 0, 0, 10, 10))).toBe(true);
    expect(finite(zoomAbout(l, 1, Number.NaN, 0, 0, 10, 10))).toBe(true);
    expect(finite(clampTranslate(l, Number.NaN, Number.NaN, 5))).toBe(true);
  });
});
