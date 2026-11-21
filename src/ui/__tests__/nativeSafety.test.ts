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

describe('source rules for native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');
  const roots = [path.join(__dirname, '..'), path.join(__dirname, '..', '..', '..', 'app')];
  const files: { file: string; src: string }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(full);
      } else if (/\.tsx?$/.test(e.name)) files.push({ file: path.relative(process.cwd(), full), src: fs.readFileSync(full, 'utf8') });
    }
  };
  roots.forEach(walk);
  const offenders = (re: RegExp, allow: (f: string) => boolean = () => false) => files.filter((f) => re.test(f.src) && !allow(f.file)).map((f) => f.file);

  it('uses no native Modal, no SafeAreaView and no gesture-handler gestures', () => {
    expect(offenders(/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*'react-native'/)).toEqual([]);
    expect(offenders(/<SafeAreaView|import[^;]*\bSafeAreaView\b[^;]*from/)).toEqual([]);
    // Only the root's GestureHandlerRootView (expo-router needs it); no gestures anywhere.
    expect(offenders(/GestureDetector|Gesture\.(Pan|Pinch|Tap)|PanGestureHandler|TapGestureHandler/)).toEqual([]);
  });

  it('loops only on the shared ambient clock (and the ticker crawl, which stops with it)', () => {
    expect(offenders(/withRepeat\(/, (f) => f.endsWith(path.join('motion', 'ambient.tsx')) || f.endsWith(path.join('shell', 'Ticker.tsx')))).toEqual([]);
  });

  it('keeps DOM APIs behind a web check', () => {
    // Files that touch document/window DOM APIs must also check Platform.OS or typeof document/window.
    const dom = files.filter((f) => /\bdocument\.|\.getBoundingClientRect\(|window\.location/.test(f.src));
    for (const f of dom) expect([f.file, /Platform\.OS\s*[!=]==\s*'web'|typeof (document|window)/.test(f.src)]).toEqual([f.file, true]);
  });
});
