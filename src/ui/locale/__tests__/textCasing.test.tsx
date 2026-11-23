/**
 * Turkish capitals on every platform. iOS applies `textTransform: 'uppercase'` without the
 * locale ("bilgi" -> "BILGI"), so text under a case-changing style must go through the
 * locale Text (src/ui/locale/Text.tsx), which cases it in JS and neutralises the style.
 *
 * 1. A source guard: no file with a case-changing style renders React Native's Text.
 * 2. Rendered components in Turkish: the string handed to the host Text is already
 *    "BİLGİ"-style upper case and the host style no longer changes the case.
 */
import fs from 'node:fs';
import path from 'node:path';

import { act, type ReactElement } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { createRoot, type Root, type TestInstance } from 'test-renderer';

import { Button } from '../../components/Button';
import { Stamp } from '../../components/Deco';
import { ModalCard } from '../../components/ModalCard';
import { voice } from '../../theme';
import { setCurrentLocale } from '../current';
import { Text } from '../Text';

jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(function layoutAnimation() {}, { get: () => () => chain() });
  const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: (c: unknown) => c };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (v: unknown) => ({ value: v, get: () => v, set: () => undefined }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    Easing: new Proxy({}, { get: () => () => (v: unknown) => v }),
    FadeIn: chain(),
    FadeOut: chain(),
    FadeInUp: chain(),
    ZoomIn: chain(),
    SlideInRight: chain(),
    SlideOutRight: chain(),
    useReducedMotion: () => false,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaProvider: ({ children }: { children: unknown }) => children };
});

const ROOT = path.join(__dirname, '..', '..', '..', '..');

// --- 1. Source guard -------------------------------------------------------------------

/** Voice presets that set textTransform in any theme, read from theme.ts itself. */
function casingPresets(): string[] {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'theme.ts'), 'utf8');
  const names = new Set<string>();
  for (const m of src.matchAll(/(\w+):\s*\{[^{}]*textTransform/g)) names.add(m[1]);
  return [...names];
}

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** True when the file takes `Text` from react-native (named import) or renders Animated.Text. */
function rendersNativeText(src: string): boolean {
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native'/g)) {
    if (m[1].split(',').some((s) => s.trim() === 'Text')) return true;
  }
  return /<Animated\.Text\b/.test(src);
}

describe('case-changing styles go through the locale Text', () => {
  const presets = casingPresets();

  it('finds the upper-casing presets in theme.ts', () => {
    expect(presets).toEqual(expect.arrayContaining(['calmLabel', 'calmHeading', 'loudKicker', 'loudHeadline', 'loudBody']));
  });

  it('no file with such a style renders React Native Text directly', () => {
    const casing = new RegExp(`voice\\.(${presets.join('|')})\\b|textTransform\\s*:`);
    const allowed = new Set(['src/ui/theme.ts', 'src/ui/locale/Text.tsx', 'src/ui/locale/casing.ts']);
    const offenders = [...sources(path.join(ROOT, 'src', 'ui')), ...sources(path.join(ROOT, 'app'))]
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
      .filter((f) => !allowed.has(f))
      .filter((f) => {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
        return casing.test(src) && rendersNativeText(src);
      });
    // Fix: import { Text } from '<relative>/locale/Text' instead of react-native's Text.
    expect(offenders).toEqual([]);
  });
});

// --- 2. Rendered in Turkish ------------------------------------------------------------

function render(el: ReactElement): Root {
  const root = createRoot();
  act(() => root.render(el));
  return root;
}

function hostTexts(root: Root): { text: string; style: TextStyle }[] {
  const out: { text: string; style: TextStyle }[] = [];
  const walk = (n: TestInstance | string) => {
    if (typeof n === 'string') return;
    if (n.type === 'RCTText' || n.type === 'Text') {
      const own = n.children.filter((c): c is string => typeof c === 'string').join('');
      out.push({ text: own, style: (StyleSheet.flatten(n.props.style) ?? {}) as TextStyle });
    }
    n.children.forEach(walk);
  };
  root.container.children.forEach(walk);
  return out;
}

const upperCasing = (s: TextStyle) => s.textTransform === 'uppercase' || s.textTransform === 'capitalize' || s.textTransform === 'lowercase';

describe('locale Text in Turkish', () => {
  beforeEach(() => setCurrentLocale('tr'));
  afterEach(() => setCurrentLocale('en'));

  it('cases a voice preset with the Turkish i rules and drops the style transform', () => {
    const texts = hostTexts(render(<Text style={voice.loudKicker}>bilgi ışık</Text>));
    expect(texts).toEqual([expect.objectContaining({ text: 'BİLGİ IŞIK' })]);
    expect(texts[0].style.textTransform).toBe('none');
  });

  it('nested Texts inherit the transform, arrays of strings are cased', () => {
    const texts = hostTexts(
      render(
        <Text style={{ textTransform: 'uppercase' }}>
          {'istanbul '}
          {3}
          <Text>{['ilk', ' iş']}</Text>
        </Text>,
      ),
    );
    expect(texts.map((x) => x.text)).toEqual(['İSTANBUL 3', 'İLK İŞ']);
    expect(texts.some((x) => upperCasing(x.style))).toBe(false);
  });

  it('leaves text without a transform alone', () => {
    const texts = hostTexts(render(<Text style={voice.body}>bilgi</Text>));
    expect(texts[0].text).toBe('bilgi');
  });

  it('shared components: stamp, modal title and button', () => {
    const stamp = hostTexts(render(<Stamp text="Son dakika" />));
    expect(stamp.map((x) => x.text)).toContain('SON DAKİKA');
    const modal = hostTexts(
      render(
        <ModalCard visible title="Lab taşındı: Gizil Uzay">
          <Text style={voice.calmLabel}>yenilikler</Text>
        </ModalCard>,
      ),
    );
    const all = [...stamp, ...modal];
    expect(modal.map((x) => x.text)).toContain('YENİLİKLER');
    if (upperCasing(StyleSheet.flatten(voice.calmHeading) ?? {})) expect(modal.map((x) => x.text)).toContain('LAB TAŞINDI: GİZİL UZAY');
    const button = hostTexts(render(<Button label="Eğitim turu başlat" variant="primary" onPress={() => undefined} />));
    all.push(...button);
    expect(button.map((x) => x.text).join(' ')).toMatch(/EĞİTİM TURU BAŞLAT|Eğitim turu başlat/);
    expect(all.filter((x) => upperCasing(x.style)).map((x) => x.text)).toEqual([]);
    for (const x of all) expect(x.text).not.toMatch(/[A-ZÇĞÖŞÜ]I[A-ZÇĞÖŞÜ]*i|BILG|DAKIKA/);
  });
});

describe('locale Text in English', () => {
  it('renders React Native Text untouched (the platform cases it)', () => {
    const texts = hostTexts(render(<Text style={voice.loudKicker}>breaking</Text>));
    expect(texts[0].text).toBe('breaking');
    expect(texts[0].style.textTransform).toBe('uppercase');
  });
});
