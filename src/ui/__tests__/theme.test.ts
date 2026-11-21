/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { contrast, distinctFrom, ensureContrast, hueDistance, hueOf, mixColor, readableOn, rotateHue } from '../color';
import { themeFontSources } from '../fonts';
import { LAB_CONTRAST, readableLabColor } from '../i18n';
import { getPackEntry } from '../packs';
import { colors, darkThemes, DEFAULT_THEME, palettes, resolveThemeName, shapes, THEME_NAMES, themeFontFaces, voice, type Palette, type ThemeName } from '../theme';

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
  it.each(THEME_NAMES)('%s has the same token names as paper', (name) => {
    expect(Object.keys(palettes[name]).sort()).toEqual(Object.keys(palettes.paper).sort());
    expect(Object.keys(shapes[name]).sort()).toEqual(Object.keys(shapes.paper).sort());
  });

  it('EXPO_PUBLIC_THEME picks a known theme only when asked; blueprint is the default', () => {
    for (const name of THEME_NAMES) expect(resolveThemeName(name)).toBe(name);
    expect(DEFAULT_THEME).toBe('blueprint');
    expect(resolveThemeName(undefined)).toBe('blueprint');
    expect(resolveThemeName('neon')).toBe('blueprint');
    // Tests run without the variable.
    expect(colors).toBe(palettes.blueprint);
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

  it.each(THEME_NAMES)('%s: every bundled face of the theme is loaded, and nothing else', (name) => {
    const before = process.env.EXPO_PUBLIC_THEME;
    process.env.EXPO_PUBLIC_THEME = name;
    try {
      const loaded = Object.keys(themeFontSources()).sort();
      const used = [...new Set(Object.values(themeFontFaces[name]).filter(Boolean))].sort();
      expect(loaded).toEqual(used);
    } finally {
      if (before === undefined) delete process.env.EXPO_PUBLIC_THEME;
      else process.env.EXPO_PUBLIC_THEME = before;
    }
  });

  it.each([undefined, 'neon'])('with EXPO_PUBLIC_THEME=%s the default theme\'s faces are loaded', (value) => {
    const before = process.env.EXPO_PUBLIC_THEME;
    if (value === undefined) delete process.env.EXPO_PUBLIC_THEME;
    else process.env.EXPO_PUBLIC_THEME = value;
    try {
      const used = [...new Set(Object.values(themeFontFaces[DEFAULT_THEME]).filter(Boolean))].sort();
      expect(Object.keys(themeFontSources()).sort()).toEqual(used);
    } finally {
      if (before === undefined) delete process.env.EXPO_PUBLIC_THEME;
      else process.env.EXPO_PUBLIC_THEME = before;
    }
  });

  it('new themes leave the retired look behind: no cream ground, no orange accent, no serif headings', () => {
    for (const name of ['blueprint', 'hazard', 'candy'] as const) {
      const hue = hueOf(palettes[name].player);
      expect(hue === null || hueDistance(hue, 20) > 25).toBe(true);
      expect(Object.values(themeFontFaces[name]).some((f) => f.startsWith('Fraunces'))).toBe(false);
      expect(palettes[name].bg).not.toBe(palettes.paper.bg);
    }
  });

  it('text presets carry the two voices', () => {
    expect(voice.loudHeadline.textTransform).toBe('uppercase');
    expect(voice.loudKicker.textTransform).toBe('uppercase');
    expect(voice.calmNumber.fontVariant).toContain('tabular-nums');
    expect(voice.calmHeading.fontFamily).toContain(themeFontFaces[DEFAULT_THEME].heading);
    expect(voice.loudHeadline.fontFamily).toContain(themeFontFaces[DEFAULT_THEME].newsHeavy);
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

  it('rotateHue and distinctFrom move colours around the wheel', () => {
    expect(hueOf(rotateHue('#FF0000', 120))).toBeCloseTo(120, 0);
    expect(rotateHue('#808080', 90)).toBe('#808080');
    const moved = distinctFrom('#F06292', '#FF2E93', 45);
    expect(hueDistance(hueOf(moved)!, hueOf('#FF2E93')!)).toBeGreaterThanOrEqual(44.5);
    expect(distinctFrom('#4FC3F7', '#FF2E93', 45)).toBe('#4FC3F7');
  });

  it.each(THEME_NAMES)('%s: rival colours read, stay apart from the player and from each other', (name: ThemeName) => {
    const p = palettes[name];
    const s = shapes[name];
    const toward = darkThemes[name] ? p.newsPaper : p.text;
    const { pack } = getPackEntry();
    const rivals = pack.rivals.map((r) => readableOn(r.color, p, LAB_CONTRAST.graphic, toward, { rival: true, minHue: s.rivalHue, lift: s.rivalLift }));
    const player = readableOn(p.player, p, LAB_CONTRAST.graphic, toward, { rival: false, minHue: 0, lift: 0 });
    expect(player).toBe(p.player);
    for (const c of [...rivals, player]) {
      expect(contrast(c, p.bg)).toBeGreaterThanOrEqual(LAB_CONTRAST.graphic);
      expect(contrast(c, p.surface)).toBeGreaterThanOrEqual(LAB_CONTRAST.graphic);
      // Lit dots stand out from resting ones.
      expect(contrast(c, p.dotRest)).toBeGreaterThanOrEqual(1.6);
    }
    const hp = hueOf(player)!;
    // Lifting and the contrast step can drift the hue a few degrees after the rotation.
    if (s.rivalHue > 0) for (const c of rivals) expect(hueDistance(hueOf(c)!, hp)).toBeGreaterThanOrEqual(s.rivalHue - 5);
    for (let i = 0; i < rivals.length; i++)
      for (let j = i + 1; j < rivals.length; j++) expect(hueDistance(hueOf(rivals[i])!, hueOf(rivals[j])!)).toBeGreaterThanOrEqual(20);
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
