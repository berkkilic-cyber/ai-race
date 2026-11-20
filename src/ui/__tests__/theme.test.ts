/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { contrast, ensureContrast, mixColor } from '../color';
import { LAB_CONTRAST, readableLabColor } from '../i18n';
import { getPackEntry } from '../packs';
import { colors, palettes, resolveThemeName, voice, type Palette } from '../theme';

const ROOT = path.join(__dirname, '..', '..', '..');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      out.push(...files(full));
    } else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

describe('themes', () => {
  it('both palettes have identical token names', () => {
    expect(Object.keys(palettes.night).sort()).toEqual(Object.keys(palettes.paper).sort());
  });

  it('EXPO_PUBLIC_THEME picks night only when asked; paper is the default', () => {
    expect(resolveThemeName('night')).toBe('night');
    expect(resolveThemeName('paper')).toBe('paper');
    expect(resolveThemeName(undefined)).toBe('paper');
    expect(resolveThemeName('neon')).toBe('paper');
    // Tests run without the variable.
    expect(colors).toBe(palettes.paper);
  });

  it.each(Object.entries(palettes))('%s: text tokens reach 4.5:1 on bg and surface', (_name, p: Palette) => {
    for (const fg of [p.text, p.dim, p.playerText, p.goodText, p.bad, p.info]) {
      expect(contrast(fg, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, p.surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(p.text, p.raised)).toBeGreaterThanOrEqual(7);
  });

  it.each(Object.entries(palettes))('%s: the loud voice reads (newsPaper on newsInk and newsRed, ink on newsPaper)', (_name, p: Palette) => {
    expect(contrast(p.newsPaper, p.newsInk)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.newsPaper, p.newsRed)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.newsDim, p.newsPaper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.newsGood, p.newsPaper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.newsRed, p.newsWash)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(palettes))('%s: label on the accent is at least large-text readable (3:1)', (_name, p: Palette) => {
    expect(contrast(p.onPlayer, p.player)).toBeGreaterThanOrEqual(3);
  });

  it('text presets carry the two voices', () => {
    expect(voice.loudHeadline.textTransform).toBe('uppercase');
    expect(voice.loudKicker.textTransform).toBe('uppercase');
    expect(voice.calmNumber.fontVariant).toContain('tabular-nums');
    expect(voice.calmHeading.fontFamily).toContain('Fraunces');
    expect(voice.loudHeadline.fontFamily).toContain('BarlowCondensed');
  });
});

describe('colour helpers', () => {
  it('contrast is 21 for black on white and symmetric', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1);
  });

  it('ensureContrast keeps colours that pass and moves the others until they do', () => {
    expect(ensureContrast('#111111', ['#ffffff'], 4.5, '#000000')).toBe('#111111');
    const fixed = ensureContrast('#4FC3F7', ['#F4EFE6'], 4.5, '#1D1B18');
    expect(contrast(fixed, '#F4EFE6')).toBeGreaterThanOrEqual(4.5);
    expect(fixed).not.toBe('#1D1B18');
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('readableLabColor makes every rival colour read on the current theme', () => {
    const { pack } = getPackEntry();
    for (const rival of pack.rivals) {
      const lab = { color: rival.color, controller: 'ai' as const };
      for (const use of ['graphic', 'text'] as const) {
        const c = readableLabColor(lab, use);
        expect(contrast(c, colors.bg)).toBeGreaterThanOrEqual(LAB_CONTRAST[use]);
        expect(contrast(c, colors.surface)).toBeGreaterThanOrEqual(LAB_CONTRAST[use]);
      }
    }
  });
});

describe('no hard-coded colours', () => {
  const HEX = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?\b/;
  const RGBA = /\brgba?\s*\(/;
  const ALLOWED = new Set([path.join(ROOT, 'src', 'ui', 'theme.ts')]);

  it('src/ui and app define colours only in src/ui/theme.ts', () => {
    const offenders: string[] = [];
    for (const file of [...files(path.join(ROOT, 'src', 'ui')), ...files(path.join(ROOT, 'app'))]) {
      if (ALLOWED.has(file)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (HEX.test(line) || RGBA.test(line)) offenders.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
