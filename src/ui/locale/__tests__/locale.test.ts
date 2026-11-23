import { createGame } from '@/engine';

import { setI18nContext, t } from '../../i18n';
import { getPackEntry } from '../../packs';
import { applyTransform, cased, lower, lowerFirst, upper, upperFirst } from '../casing';
import { getCurrentLocale, setCurrentLocale } from '../current';
import { detectDeviceLocale, localeFromTag } from '../detect';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { stringPairs, readJson, placeholders } = require('../../../../scripts/i18n/pairs') as {
  stringPairs: () => { en: string; tr: string; name: string }[];
  readJson: (file: string) => Record<string, string>;
  placeholders: (text: string) => string;
};

const pairs = stringPairs();

afterEach(() => {
  setCurrentLocale('en');
  setI18nContext(getPackEntry().pack, null);
  jest.restoreAllMocks();
});

describe('Turkish strings files', () => {
  it('finds the English files and each has a Turkish sibling', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(10);
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    for (const p of pairs) expect({ file: p.name, tr: fs.existsSync(p.tr) }).toEqual({ file: p.name, tr: true });
  });

  it.each(pairs.map((p) => [p.name, p] as const))('%s: no keys missing from English, same placeholders, no empty values', (_name, pair) => {
    const en = readJson(pair.en);
    const tr = readJson(pair.tr);
    const problems: string[] = [];
    for (const [key, text] of Object.entries(tr)) {
      if (!(key in en)) problems.push(`extra key ${key}`);
      else if (placeholders(text) !== placeholders(en[key])) problems.push(`${key}: {${placeholders(text)}} vs {${placeholders(en[key])}}`);
      if (typeof text !== 'string' || !text.trim()) problems.push(`${key}: empty`);
    }
    expect(problems).toEqual([]);
  });
});

describe('casing', () => {
  it('handles the Turkish dotted and dotless i', () => {
    expect(upper('istanbul ılık', 'tr')).toBe('İSTANBUL ILIK');
    expect(lower('İSTANBUL ILIK', 'tr')).toBe('istanbul ılık');
    expect(upper('istanbul', 'en')).toBe('ISTANBUL');
    expect(upperFirst('ileri', 'tr')).toBe('İleri');
    expect(lowerFirst('Irmak', 'tr')).toBe('ırmak');
    expect(applyTransform('şirket iflası', 'uppercase', 'tr')).toBe('ŞİRKET İFLASI');
    expect(applyTransform('veri merkezi', 'capitalize', 'tr')).toBe('Veri Merkezi');
    expect(applyTransform('Abc', 'none', 'tr')).toBe('Abc');
  });

  it('follows the current locale by default', () => {
    setCurrentLocale('tr');
    expect(upper('bilgi')).toBe('BİLGİ');
    expect(cased({ textTransform: 'uppercase' }, 'bilgi')).toBe('BİLGİ');
    expect(cased(undefined, 'bilgi')).toBe('bilgi');
    setCurrentLocale('en');
    expect(upper('bilgi')).toBe('BILGI');
  });
});

describe('detection', () => {
  it('maps tags to supported locales', () => {
    expect(localeFromTag('tr-TR')).toBe('tr');
    expect(localeFromTag('tr_TR')).toBe('tr');
    expect(localeFromTag('en-GB')).toBe('en');
    expect(localeFromTag('de-DE')).toBeNull();
    expect(localeFromTag(undefined)).toBeNull();
  });

  it('picks Turkish only when the first device language is Turkish, and never throws', () => {
    expect(detectDeviceLocale(['tr-TR', 'en-US'])).toBe('tr');
    expect(detectDeviceLocale(['en-US', 'tr-TR'])).toBe('en');
    expect(detectDeviceLocale(['de-DE'])).toBe('en');
    expect(detectDeviceLocale([undefined, null, '', 'tr'])).toBe('tr');
    expect(detectDeviceLocale([])).toBe('en');
    const evil = [{ toString: () => { throw new Error('x'); } }];
    expect(detectDeviceLocale(evil)).toBe('en');
  });
});

describe('t in Turkish', () => {
  it('uses the Turkish text and falls back to English for a missing key', () => {
    const base = getPackEntry().pack;
    const pack = { ...base, strings: { en: { ...base.strings.en, 'x.only.en': 'Only English {lab}' }, tr: { ...base.strings.tr, 'x.both': 'Türkçe' } } };
    const state = createGame(pack, { playerName: 'Ay Lab', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed: 1 });
    setI18nContext(pack, state.labs);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    setCurrentLocale('tr');
    expect(getCurrentLocale()).toBe('tr');
    expect(t('x.both')).toBe('Türkçe');
    expect(t('x.only.en', { lab: 'player' })).toBe('Only English Ay Lab');
    t('x.only.en');
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('x.only.en'))).toHaveLength(1);
    expect(t('ui.locale.label')).toBe('Dil');
    setCurrentLocale('en');
    expect(t('ui.locale.label')).toBe('Language');
  });
});

describe('casing goes through the helper', () => {
  it('no toUpperCase / toLowerCase on visible text outside src/ui/locale/casing.ts', () => {
    const fs = jest.requireActual<typeof import('node:fs')>('node:fs');
    const path = jest.requireActual<typeof import('node:path')>('node:path');
    const root = path.join(__dirname, '..', '..', '..', '..');
    // Not visible text: colour hex, SVG path commands, search folding, the English key humaniser.
    const allowed = ['src/ui/color.ts', 'src/ui/map/hitTest.ts', 'src/ui/start/logic.ts', 'src/ui/i18n.ts', 'src/ui/locale/casing.ts', 'src/ui/locale/detect.ts'];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== '__tests__' && e.name !== 'dev') walk(p);
        } else if (/\.tsx?$/.test(e.name)) {
          const rel = path.relative(root, p).split(path.sep).join('/');
          if (allowed.includes(rel)) continue;
          fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
            if (/\.to(Locale)?(Upper|Lower)Case\(/.test(line)) hits.push(`${rel}:${i + 1}`);
          });
        }
      }
    };
    walk(path.join(root, 'src', 'ui'));
    walk(path.join(root, 'app'));
    expect(hits).toEqual([]);
  });
});
