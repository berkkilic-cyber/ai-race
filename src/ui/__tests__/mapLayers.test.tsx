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
import { useCoachStore } from '../moments/coach';
import { bubbleOffset } from '../moments/logic';
import { useStripPanel } from '../shell/panels/store';
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
    // Runs the worklet on every render (the bubble placement really runs in this test).
    useDerivedValue: (fn: () => unknown) => sharedValue(fn()),
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

  it('with live layers up (bubbles, a banner, a route, racks, objects, standings) nothing covers the map; a bubble tap collects it and a region tap still opens the region', async () => {
    const touchView = await renderShell();
    const container = find(root.container, (n) => (n.props as { testID?: string }).testID === 'world-map')!;
    const W = 776;
    const H = 339;
    await act(async () => {
      (container.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: W, height: H } } });
    });
    const store = useGameStore.getState();
    const s0 = store.state!;
    const me = s0.labs[s0.playerLabId];
    const home = me.homeRegion;
    const rival = s0.labOrder.find((id) => id !== s0.playerLabId)!;
    const boost = pack.moments.find((d) => d.kind === 'boost' && d.onCollect.some((e) => e.type === 'resource' && e.resource === 'cash'))!;
    const capNode = pack.nodes.find((n) => (n.capabilityLevel ?? 0) > 0)!;
    const neighbour = pack.regions.find((r) => r.id === home)!.neighbors[0];
    await act(async () => {
      useGameStore.setState({
        state: {
          ...s0,
          labs: {
            ...s0.labs,
            [me.id]: { ...me, ownedNodes: [...me.ownedNodes, 'cap-robotics'], dataCentres: [{ id: 't-dc1', regionId: home, level: 2 }], adoption: { ...me.adoption, [home]: 0.2 } },
          },
          moments: [{ uid: 'test-m1', defId: boost.id, labId: me.id, regionId: home, spawnTick: s0.tick, expiresTick: s0.tick + 30 }],
          news: [
            ...s0.news,
            { tick: s0.tick, kind: 'launch', tier: 1, nodeId: capNode.id, textKey: 'engine.news.launch.rival', tone: 'bad', params: { lab: rival, model: capNode.nameKey, tier: 1 }, labId: rival, regionId: s0.labs[rival].homeRegion },
            { tick: s0.tick, kind: 'entry', textKey: 'engine.news.entry.channel', tone: 'good', params: { lab: me.id, region: neighbour, from: home, channel: 'viral' }, labId: me.id, regionId: neighbour },
          ],
        },
      });
    });
    const has = (id: string) => find(root.container, (n) => (n.props as { testID?: string }).testID === id) !== null;
    for (const id of ['moment-layer', 'moment-boost-test-m1', 'launch-banner', 'map-objects', 'map-object-robot', 'map-leaderboard', 'route-runner-viral', 'rack-player:t-dc1-l2']) expect([id, has(id)]).toEqual([id, true]);
    expect(blockersAbove(root.container, touchView)).toEqual([]);

    // A tap on the bubble collects it and opens no region panel.
    const l: Layout = { cw: W, ch: H, mw: geometry.width, mh: geometry.height };
    const c = geometry.regions[home].centroid;
    const [mx, my] = toScreenPoint(l, 1, 0, 0, c[0], c[1]);
    const [dx, dy] = bubbleOffset(0);
    const p = touchView.props as Record<string, (e: unknown) => void>;
    const tapAt = async (x: number, y: number, t: number) => {
      const touch = { identifier: 1, pageX: 103 + x, pageY: 40 + y, locationX: x, locationY: y, timestamp: t };
      await act(async () => {
        p.onResponderGrant({ nativeEvent: { ...touch, touches: [touch], changedTouches: [touch] } });
        p.onResponderRelease({ nativeEvent: { ...touch, timestamp: t + 60, touches: [], changedTouches: [touch] } });
      });
    };
    const cashBefore = useGameStore.getState().state!.labs[me.id].cash;
    await tapAt(mx + dx, my + dy, 1000);
    const after = useGameStore.getState().state!;
    expect(after.moments.find((m) => m.uid === 'test-m1')).toBeUndefined();
    expect(after.labs[me.id].stats.momentsCollected).toBe(1);
    expect(after.labs[me.id].cash).toBeGreaterThan(cashBefore);
    expect(has('region-sheet')).toBe(false);
    expect(has('moment-float-collected')).toBe(true);
    // The region under the marker point still opens on a tap (outside the double-tap window).
    await tapAt(mx, my, 2000);
    expect(has('region-sheet')).toBe(true);
    expect(blockersAbove(root.container, touchView)).toEqual([]);
  });

  it('the fully merged Map tab (bubbles, banner, standings, coach line) with each panel: only a panel\'s own outside-tap layer covers the map', async () => {
    const touchView = await renderShell();
    const container = find(root.container, (n) => (n.props as { testID?: string }).testID === 'world-map')!;
    await act(async () => {
      (container.props as { onLayout: (e: unknown) => void }).onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 776, height: 339 } } });
    });
    const s0 = useGameStore.getState().state!;
    const me = s0.labs[s0.playerLabId];
    const rival = s0.labOrder.find((id) => id !== s0.playerLabId)!;
    const capNode = pack.nodes.find((n) => (n.capabilityLevel ?? 0) > 0)!;
    const boost = pack.moments.find((d) => d.kind === 'boost')!;
    const threat = pack.moments.find((d) => d.kind === 'threat')!;
    const near = pack.regions.find((r) => r.id === me.homeRegion)!.neighbors[0];
    await act(async () => {
      useGameStore.setState({
        state: {
          ...s0,
          labs: { ...s0.labs, [me.id]: { ...me, adoption: { ...me.adoption, [near]: 0.1 } } },
          moments: [
            { uid: 'm-a', defId: boost.id, labId: me.id, regionId: me.homeRegion, spawnTick: s0.tick, expiresTick: s0.tick + 30 },
            { uid: 'm-b', defId: threat.id, labId: me.id, regionId: near, spawnTick: s0.tick, expiresTick: s0.tick + 30 },
          ],
          news: [...s0.news, { tick: s0.tick, kind: 'launch', tier: 1, nodeId: capNode.id, textKey: 'engine.news.launch.rival', tone: 'bad', params: { lab: rival, model: capNode.nameKey, tier: 1 }, labId: rival, regionId: s0.labs[rival].homeRegion }],
        },
      });
      useCoachStore.setState({ active: { uid: 'm-a', kind: 'boost' } });
    });
    const has = (id: string) => find(root.container, (n) => (n.props as { testID?: string }).testID === id) !== null;
    for (const id of ['moment-boost-m-a', 'moment-threat-m-b', 'launch-banner', 'map-leaderboard', 'moment-coach']) expect([id, has(id)]).toEqual([id, true]);
    expect(blockersAbove(root.container, touchView)).toEqual([]);

    // The strip's panels close on an outside tap: their outside layer is the only thing above the map.
    for (const panel of ['hype', 'cash', 'model'] as const) {
      await act(async () => useStripPanel.getState().show(panel));
      const blockers = blockersAbove(root.container, touchView);
      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers.filter((b) => !b.includes('sheet-outside'))).toEqual([]);
      await act(async () => useStripPanel.getState().close());
      expect(blockersAbove(root.container, touchView)).toEqual([]);
    }
    // The Regions list and the region panel keep the map live beside them.
    await press(find(root.container, (n) => (n.props as { testID?: string }).testID === 'map-regions')!);
    expect(has('regions-sheet')).toBe(true);
    expect(blockersAbove(root.container, touchView)).toEqual([]);
    // The help panel (the "?" button) closes on an outside tap too.
    await press(find(root.container, (n) => (n.props as { testID?: string }).testID === 'tutorial-help')!);
    expect(has('help-sheet')).toBe(true);
    expect(blockersAbove(root.container, touchView).filter((b) => !b.includes('sheet-outside'))).toEqual([]);
    await act(async () => useCoachStore.setState({ active: null }));
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
