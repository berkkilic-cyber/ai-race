/**
 * The game shell on the Map tab, rendered with the real layout file (app/game/_layout.tsx),
 * MapScreen and the overlay hosts. Asserts by walking the rendered host tree that nothing
 * that could take a touch covers the map's touch view, with no overlay active and with the
 * region panel open, and drives the touch view with synthetic responder events (the same
 * shape React Native delivers) to check the coordinate space end to end.
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root, type TestInstance } from 'test-renderer';

import { createHitTester } from '../map/hitTest';
import { getPackEntry } from '../packs';
import { useGameStore } from '../store/game';
import { useTutorialStore } from '../tutorial/store';
import { toScreenPoint, type Layout } from '../map/viewTransform';

// A minimal Reanimated for a host-tree walk: animated components are plain host components,
// shared values are boxes, animations jump to their end value.
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(function layoutAnimation() {}, { get: () => () => chain() });
  const identity = (v: unknown) => v;
  const easing = new Proxy({}, { get: () => () => identity });
  const sharedValue = (v: unknown) => {
    const box = {
      value: v,
      get: () => box.value,
      set: (n: unknown) => {
        box.value = n;
      },
    };
    return box;
  };
  const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, createAnimatedComponent: (c: unknown) => c };
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    Easing: easing,
    FadeIn: chain(),
    SlideInLeft: chain(),
    SlideInRight: chain(),
    SlideOutLeft: chain(),
    cancelAnimation: () => undefined,
    interpolate: () => 0,
    interpolateColor: (_v: unknown, _i: unknown, out: string[]) => out[0],
    useAnimatedProps: () => ({}),
    useAnimatedStyle: () => ({}),
    useReducedMotion: () => false,
    useSharedValue: (v: unknown) => jest.requireActual('react').useState(() => sharedValue(v))[0],
    withRepeat: identity,
    withSequence: (...a: unknown[]) => a[a.length - 1],
    withSpring: identity,
    withTiming: identity,
  };
});

jest.mock('expo-router', () => ({
  usePathname: () => '/game',
  useIsFocused: () => true,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-router/ui', () => {
  const { View } = jest.requireActual('react-native');
  const { MapScreen } = jest.requireActual('../map/MapScreen');
  const passthrough = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return {
    Tabs: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => <View style={style}>{children}</View>,
    TabList: passthrough,
    TabTrigger: passthrough,
    // The Map tab is the focused screen.
    TabSlot: ({ style }: { style?: unknown }) => (
      <View style={style}>
        <MapScreen />
      </View>
    ),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 47, bottom: 21, left: 47 };
  return {
    SafeAreaInsetsContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
    useSafeAreaInsets: () => insets,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 926, height: 428, scale: 3, fontScale: 1 }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GameLayout = require('../../../app/game/_layout').default as () => ReactElement;

const { pack, geometry } = getPackEntry();

type Style = Record<string, unknown>;

function flat(style: unknown): Style {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce<Style>((acc, s) => ({ ...acc, ...flat(s) }), {});
  if (typeof style === 'object') return style as Style;
  return {};
}

function find(node: TestInstance, pred: (n: TestInstance) => boolean): TestInstance | null {
  if (pred(node)) return node;
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return null;
}

const TOUCH_PROPS = ['onStartShouldSetResponder', 'onMoveShouldSetResponder', 'onPress', 'onPressIn', 'onClick', 'onResponderGrant', 'onTouchStart'];

/** Covers the whole parent (an absolute fill), as far as its style says. */
function fillsParent(s: Style): boolean {
  if (s.position !== 'absolute') return false;
  const edges = s.top === 0 && s.left === 0 && s.right === 0 && s.bottom === 0;
  const full = s.width === '100%' && s.height === '100%';
  return edges || full;
}

/**
 * Host views painted above the touch view (later in tree order, outside its own subtree, or
 * with a positive zIndex) whose effective pointerEvents let them take a touch, and that
 * either fill their parent or handle touches over a full-area box.
 */
function blockersAbove(root: TestInstance, touchView: TestInstance): string[] {
  // Ancestors of the touch view: their area includes the map's.
  const ancestors = new Set<TestInstance>();
  const pathTo = (node: TestInstance, trail: TestInstance[]): boolean => {
    if (node === touchView) {
      for (const a of trail) ancestors.add(a);
      return true;
    }
    return node.children.some((c) => typeof c !== 'string' && pathTo(c, [...trail, node]));
  };
  pathTo(root, []);

  const out: string[] = [];
  let seenTouch = false;
  // `covers`: this node's box includes the whole map area (an ancestor of the touch view, or
  // an absolute fill of such a box, recursively).
  const walk = (node: TestInstance, inherited: 'auto' | 'none', parentCovers: boolean, path: string) => {
    if (node === touchView) {
      seenTouch = true;
      return;
    }
    const props = node.props as Record<string, unknown>;
    const s = flat(props.style);
    const pe = (props.pointerEvents as string | undefined) ?? (s.pointerEvents as string | undefined) ?? 'auto';
    const self = inherited === 'none' || pe === 'none' || pe === 'box-none' ? 'none' : 'auto';
    const childInherited = inherited === 'none' || pe === 'none' ? 'none' : 'auto';
    const covers = ancestors.has(node) || (parentCovers && fillsParent(s));
    const label = `${path}/${String(props.testID ?? node.type)}`;
    const above = seenTouch || (typeof s.zIndex === 'number' && s.zIndex > 0);
    if (typeof node.type === 'string' && !ancestors.has(node) && covers && above && self === 'auto') {
      const handles = TOUCH_PROPS.some((k) => typeof props[k] === 'function');
      out.push(`${label}${handles ? ' (handles touches)' : ''}`);
    }
    for (const c of node.children) if (typeof c !== 'string') walk(c, childInherited, covers, label);
  };
  walk(root, 'auto', true, '');
  return out;
}

/** Presses a Pressable's host view (its click handler, as a pointer or accessibility activation does). */
async function press(node: TestInstance) {
  const onClick = (node.props as { onClick?: (e: unknown) => void }).onClick;
  await act(async () => onClick?.({ nativeEvent: { pageX: 1, pageY: 1, locationX: 1, locationY: 1, timestamp: Date.now() }, persist: () => undefined, isDefaultPrevented: () => false }));
}

let root: Root;

async function renderShell() {
  root = createRoot();
  await act(async () => {
    root.render(<GameLayout />);
  });
  const touchView = find(root.container, (n) => (n.props as { testID?: string }).testID === 'map-touch');
  if (!touchView) throw new Error('map touch view not rendered');
  return touchView;
}

beforeEach(() => {
  jest.useFakeTimers();
  useTutorialStore.setState({ tutorial: { status: 'done', step: 0, dcBaseline: null, runSeed: null }, showing: false });
  const home = pack.regions[0].id;
  useGameStore.getState().newGame({ playerName: 'Test Lab', founderId: pack.founders[0].id, homeRegion: home, seed: 3 });
  useGameStore.getState().setSpeed(0);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  jest.useRealTimers();
});

describe('nothing covers the map touch view', () => {
  it('on the Map tab with no overlay active', async () => {
    const touchView = await renderShell();
    expect((touchView.props as { collapsable?: boolean }).collapsable).toBe(false);
    expect(typeof (touchView.props as { onStartShouldSetResponder?: unknown }).onStartShouldSetResponder).toBe('function');
    expect(blockersAbove(root.container, touchView)).toEqual([]);
    // No overlay host is mounted while idle.
    for (const id of ['tutorial', 'event-overlay', 'sheet-outside', 'region-sheet', 'regions-sheet', 'help-sheet', 'achievement-toast', 'map-debug']) {
      expect(find(root.container, (n) => (n.props as { testID?: string }).testID === id)).toBeNull();
    }
  });

  it('with the map laid out, a synthetic tap on the home region opens its panel; the map stays uncovered beside it', async () => {
    const touchView = await renderShell();
    const container = find(root.container, (n) => (n.props as { testID?: string }).testID === 'world-map')!;
    const W = 776;
    const H = 339;
    await act(async () => {
      (container.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: W, height: H } } });
    });
    const home = useGameStore.getState().state!.labs[useGameStore.getState().state!.playerLabId].homeRegion;
    // Wide mode: the whole-world view (scale 1), map fitted and centred.
    const l: Layout = { cw: W, ch: H, mw: geometry.width, mh: geometry.height };
    const tester = createHitTester(geometry, 150, 7);
    const c = geometry.regions[home].centroid;
    expect(tester.at(c[0], c[1])).toBe(home);
    const [x, y] = toScreenPoint(l, 1, 0, 0, c[0], c[1]);
    // The view sits at page (103, 40) in the shell; locationX is relative to the touch view.
    const ox = 103;
    const oy = 40;
    const touch = { identifier: 1, pageX: ox + x, pageY: oy + y, locationX: x, locationY: y, timestamp: 1000 };
    const p = touchView.props as Record<string, (e: unknown) => void>;
    await act(async () => {
      p.onResponderGrant({ nativeEvent: { ...touch, touches: [touch], changedTouches: [touch] } });
      p.onResponderRelease({ nativeEvent: { ...touch, timestamp: 1080, touches: [], changedTouches: [touch] } });
    });
    expect(find(root.container, (n) => (n.props as { testID?: string }).testID === 'region-sheet')).not.toBeNull();
    // The region panel has no outside-tap layer: the map beside it is still the top touch target.
    expect(find(root.container, (n) => (n.props as { testID?: string }).testID === 'sheet-outside')).toBeNull();
    expect(blockersAbove(root.container, touchView)).toEqual([]);
  });

  it('the Regions list leaves the map uncovered too', async () => {
    const touchView = await renderShell();
    const button = find(root.container, (n) => (n.props as { testID?: string }).testID === 'map-regions')!;
    await press(button);
    expect(find(root.container, (n) => (n.props as { testID?: string }).testID === 'regions-sheet')).not.toBeNull();
    expect(blockersAbove(root.container, touchView)).toEqual([]);
  });

  it('the walk does flag a full-area touch layer above the map (an ordinary sheet\'s outside-tap layer)', async () => {
    const { View } = jest.requireActual('react-native');
    const { Sheet } = jest.requireActual('../components/Sheet');
    root = createRoot();
    await act(async () => {
      root.render(
        <View style={{ flex: 1 }}>
          <View testID="map-touch" collapsable={false} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onStartShouldSetResponder={() => true} />
          <Sheet visible onClose={() => undefined} title="x" />
        </View>,
      );
    });
    const touchView = find(root.container, (n) => (n.props as { testID?: string }).testID === 'map-touch')!;
    expect(blockersAbove(root.container, touchView).some((s) => s.includes('sheet-outside') && s.includes('handles touches'))).toBe(true);
  });
});
