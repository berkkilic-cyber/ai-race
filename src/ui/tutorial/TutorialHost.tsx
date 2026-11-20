import { usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';

import { canApply, type ContentPack } from '@/engine';

import { Button } from '../components/Button';
import { Overlay } from '../components/Overlay';
import { useInsets } from '../hooks/useInsets';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { t } from '../i18n';
import { requestMapFocus } from '../map/mapFocus';
import { isDrawablePath } from '../map/svgSafe';
import { Mascot, type MascotMood } from '../mascot';
import { wideShellLayout } from '../shell/shellLayout';
import { useGameStore } from '../store/game';
import { colors, layer, layout, radius, spacing, touch, type, voice } from '../theme';
import { COUNTED_STEPS, view, type Observation, type StepId, type TutorialView } from './machine';
import { blockersAround, dimPath, holeFor, placeCaption } from './placement';
import { useTutorialStore } from './store';
import { hasTarget, measureTarget, useTargetsVersion, validRect, type TargetRect } from './targets';

/** How often the cut-outs are re-measured while a step shows (sheets slide, the map pans). */
const REMEASURE_MS = 400;
const CARD_MAX_WIDTH = 320;
const CARD_EST_HEIGHT = 112;

const MOOD: Record<StepId, MascotMood> = {
  home: 'pleased',
  strip: 'calm',
  buyModel: 'smug',
  buildDc: 'calm',
  compute: 'calm',
  meters: 'uneasy',
  speed: 'calm',
  event: 'sweating',
  outro: 'smug',
};

/** The first model node: the root of the capability tree (first node there with no requirements). */
function rootNodeId(pack: ContentPack): string | null {
  return pack.nodes.find((n) => n.tree === 'capability' && n.requires.length === 0)?.id ?? null;
}

function routeOf(pathname: string): Observation['route'] {
  if (pathname === '/game' || pathname === '/game/' || pathname === '/game/index') return 'map';
  if (pathname.startsWith('/game/trees')) return 'trees';
  if (pathname.startsWith('/game/news')) return 'news';
  return 'other';
}

const IDLE_GAME = {
  running: false,
  seed: null as number | null,
  eventPending: false,
  eventShowing: false,
  rootOwned: false,
  canBuyRoot: false,
  dataCentres: 0,
  canBuildHome: false,
  home: null as string | null,
  rootId: null as string | null,
};

/**
 * What the tutorial needs from the game, read through the store and engine selectors
 * (canApply), never changed. Computed only while the tutorial may show.
 */
function useGameObservation(enabled: boolean) {
  return useGameStore(
    useShallow((s) => {
      const state = s.state;
      if (!enabled || !state) return IDLE_GAME;
      const id = state.playerLabId;
      const lab = state.labs[id];
      const rootId = rootNodeId(s.pack);
      const eventPending = !!state.pendingEvent && state.pendingEvent.labId === id;
      return {
        running: state.status === 'running',
        seed: state.seed,
        eventPending,
        eventShowing: eventPending || s.eventResult !== null,
        rootOwned: rootId ? lab.ownedNodes.includes(rootId) : true,
        canBuyRoot: rootId ? canApply(state, s.pack, { type: 'buyNode', labId: id, nodeId: rootId }).ok : false,
        dataCentres: lab.dataCentres.length,
        canBuildHome: canApply(state, s.pack, { type: 'buildDataCentre', labId: id, regionId: lab.homeRegion }).ok,
        home: lab.homeRegion,
        rootId,
      };
    }),
  );
}

/** Target ids in a view resolved to registered ids ("a|b": the first registered). */
function resolveTarget(spec: string, rootId: string | null, home: string | null): string | null {
  for (const alt of spec.split('|')) {
    let id = alt;
    if (alt === 'tree.root') id = `node:${rootId}`;
    else if (alt === 'tree.buy') id = `node.buy:${rootId}`;
    else if (alt === 'region.build.home') id = `region.build:${home}`;
    if (hasTarget(id)) return id;
  }
  return null;
}

/** Pauses the run while `pause` is true and puts the previous speed back afterwards. */
function usePauseWhile(pause: boolean) {
  const saved = useRef<number | null>(null);
  useEffect(() => {
    const store = useGameStore.getState();
    if (pause) {
      if (store.speed > 0) {
        saved.current = store.speed;
        store.setSpeed(0);
      }
      return;
    }
    if (saved.current !== null) {
      if (useGameStore.getState().speed === 0) useGameStore.getState().setSpeed(saved.current as 1 | 2 | 3);
      saved.current = null;
    }
  }, [pause]);
  // Leaving the shell mid-step: give the speed back.
  useEffect(
    () => () => {
      if (saved.current !== null && useGameStore.getState().speed === 0) useGameStore.getState().setSpeed(saved.current as 1 | 2 | 3);
    },
    [],
  );
}

/** Measures the view's targets now and every REMEASURE_MS while it shows. */
function useTargetRects(ids: (string | null)[]): (TargetRect | null)[] {
  const key = ids.join(',');
  const [rects, setRects] = useState<(TargetRect | null)[]>([]);
  useEffect(() => {
    let alive = true;
    const list = key ? key.split(',') : [];
    const measureAll = () => {
      Promise.all(list.map((id) => (id ? measureTarget(id) : Promise.resolve(null))))
        .then((next) => {
          if (!alive) return;
          setRects((prev) => (sameRects(prev, next) ? prev : next));
        })
        .catch(() => undefined);
    };
    measureAll();
    if (list.length === 0) return () => undefined;
    const timer = setInterval(measureAll, REMEASURE_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key]);
  return rects;
}

function sameRects(a: (TargetRect | null)[], b: (TargetRect | null)[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => {
    const s = b[i];
    if (!r || !s) return r === s;
    return Math.abs(r.x - s.x) < 0.5 && Math.abs(r.y - s.y) < 0.5 && Math.abs(r.width - s.width) < 0.5 && Math.abs(r.height - s.height) < 0.5;
  });
}

/**
 * The first-run tutorial, mounted once in the game shell (app/game/_layout.tsx). Observes
 * the store and the UI through the tutorial state machine; draws coach marks (a dim layer
 * with cut-outs and a caption card with the mascot) as an in-tree overlay; pauses the run
 * while a step shows unless the step is waiting for something to happen. Dispatches
 * nothing but speed changes. Also draws the small help button that replays it.
 */
export function TutorialHost() {
  const tutorial = useTutorialStore((s) => s.tutorial);
  const store = useTutorialStore;
  const mayShow = tutorial.status === 'pending' || tutorial.status === 'active';
  const game = useGameObservation(mayShow);
  const pathname = usePathname();
  const targetsVersion = useTargetsVersion();

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  const obs: Observation = useMemo(
    () => ({
      running: game.running,
      seed: game.seed,
      eventPending: game.eventPending,
      eventShowing: game.eventShowing,
      route: routeOf(pathname),
      rootVisible: hasTarget(`node:${game.rootId}`),
      rootSheetOpen: hasTarget(`node.buy:${game.rootId}`),
      rootOwned: game.rootOwned,
      canBuyRoot: game.canBuyRoot,
      dataCentres: game.dataCentres,
      canBuildHome: game.canBuildHome,
      homeSheetOpen: hasTarget(`region.build:${game.home}`),
    }),
    // targetsVersion: target presence feeds rootVisible, rootSheetOpen and homeSheetOpen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, pathname, targetsVersion],
  );

  useEffect(() => {
    if (mayShow) store.getState().observe(obs);
  }, [obs, mayShow, store]);

  const v = view(tutorial, obs);
  usePauseWhile(!!v?.pause);
  const showing = !!v;
  useEffect(() => {
    store.getState().setShowing(showing);
  }, [showing, store]);
  useEffect(() => () => store.getState().setShowing(false), [store]);

  // "Tap your home region": first bring it into easy reach (the map zooms in only if it is small on screen).
  // The step moves on as soon as the home panel is open, however it was opened.
  const wantsHomeTap = v?.step === 'buildDc' && v.targets[0] === 'map.home';
  useEffect(() => {
    if (wantsHomeTap && game.home) requestMapFocus(game.home);
  }, [wantsHomeTap, game.home]);

  const ids = useMemo(() => (v ? v.targets.map((spec) => resolveTarget(spec, game.rootId, game.home)) : []), [v, game.rootId, game.home, targetsVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const rects = useTargetRects(ids);

  const onNext = useCallback(() => store.getState().next(obs), [obs, store]);
  const onSkip = useCallback(() => store.getState().skip(), [store]);

  if (!v) return <HelpButton />;
  // Targets inside the side panel or the event card: put the caption beside them, over the dimmed rest.
  const side = v.overEvent || /^(node\.buy|region\.build):/.test(ids[0] ?? '');
  return <CoachMark view={v} rects={rects} home={game.home} side={side} onNext={onNext} onSkip={onSkip} />;
}

interface CoachMarkProps {
  view: TutorialView;
  rects: (TargetRect | null)[];
  home: string | null;
  /** Prefer a place beside the target over one above or below it. */
  side: boolean;
  onNext: () => void;
  onSkip: () => void;
}

function CoachMark({ view: v, rects, home, side, onNext, onSkip }: CoachMarkProps) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const screen = useMemo(() => ({ width, height }), [width, height]);
  const [cardHeight, setCardHeight] = useState(CARD_EST_HEIGHT);
  const holes = rects.filter(validRect).map((r) => holeFor(r, screen));
  const primary = rects[0] && validRect(rects[0]) ? holeFor(rects[0], screen) : null;
  const cardWidth = Math.max(200, Math.min(CARD_MAX_WIDTH, width - insets.left - insets.right - 2 * spacing.m));
  const pos = placeCaption({ holes, screen, insets, card: { width: cardWidth, height: cardHeight }, prefer: side ? 'side' : 'vertical', sideAlign: v.overEvent ? 'end' : 'centre' });
  const d = dimPath(screen, holes);
  const blockers = v.action === 'do' && primary ? blockersAround(primary, screen) : [{ x: 0, y: 0, width, height }];
  const onCardLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - cardHeight) > 1) setCardHeight(h);
  };

  const params = {
    region: home ?? '',
    hype: t('term.hype'),
    cash: t('term.cash'),
    compute: t('term.compute'),
    dataCentre: t('term.dataCentre').toLowerCase(),
    capabilityTree: t('term.tree.capability'),
    regulation: t('term.regulation'),
    backlash: t('term.backlash'),
    rival: t('term.rival'),
  };
  const buttonLabel = v.action === 'finish' ? t('ui.tutorial.finish') : v.overEvent ? t('ui.tutorial.gotIt') : t('ui.tutorial.next');
  const showButton = v.action === 'next' || v.action === 'finish';
  const counted = v.step !== 'outro';

  return (
    <Overlay visible layer={v.overEvent ? layer.tutorialOverEvent : layer.tutorial} pointerEvents="box-none" trapFocus={showButton} testID="tutorial">
      {/* Dim with cut-outs; draws only (touches are handled by the blockers below). */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {isDrawablePath(d) ? (
          <Svg width={width} height={height}>
            <Path d={d} fill={v.action === 'wait' ? colors.scrimLight : colors.scrim} fillRule="evenodd" />
            {holes.map((h, i) => (
              <Rect key={i} x={h.x} y={h.y} width={h.width} height={h.height} rx={Math.min(10, h.width / 2, h.height / 2)} fill="none" stroke={colors.player} strokeWidth={i === 0 ? 2 : 1.25} />
            ))}
          </Svg>
        ) : null}
      </View>
      {/* Touch blockers around the cut-out (or over everything): real native views that take the touch
          (collapsable={false}: a transparent View is otherwise flattened away on native and blocks nothing).
          Inside the cut-out nothing of the tutorial sits above the screen, so touches reach it. */}
      {blockers.map((b, i) => (
        <View key={i} collapsable={false} onStartShouldSetResponder={takeTouch} style={[styles.blocker, { left: b.x, top: b.y, width: b.width, height: b.height }]} testID="tutorial-blocker" />
      ))}
      <Animated.View entering={FadeIn.duration(180)} key={`${v.step}-${v.captionKey}`} style={[styles.card, { left: pos.left, top: pos.top, width: cardWidth }]} onLayout={onCardLayout} testID="tutorial-card">
        <View style={styles.cardRow}>
          <Mascot mood={v.action === 'wait' ? 'asleep' : MOOD[v.step]} size={34} blinks={false} />
          <View style={styles.texts}>
            {counted ? (
              <Text style={styles.kicker}>
                {t('ui.tutorial.progress', { n: v.index + 1, total: COUNTED_STEPS })}
                {v.action === 'do' ? ` · ${t('ui.tutorial.doIt')}` : v.action === 'wait' ? ` · ${t('ui.tutorial.waiting')}` : ''}
              </Text>
            ) : null}
            <Text style={styles.caption} testID="tutorial-caption">
              {t(v.captionKey, params)}
            </Text>
          </View>
        </View>
        <View style={styles.buttons}>
          {v.action !== 'finish' ? (
            <Pressable onPress={onSkip} accessibilityRole="button" style={styles.skip} hitSlop={8} testID="tutorial-skip">
              <Text style={styles.skipText}>{t('ui.tutorial.skip')}</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {showButton ? <Button label={buttonLabel} compact onPress={onNext} testID="tutorial-next" style={styles.next} /> : null}
        </View>
      </Animated.View>
    </Overlay>
  );
}

const takeTouch = () => true;

/** Small "?" that replays the tutorial: at the foot of the rail (wide) or above the ticker on the right (narrow). */
function HelpButton() {
  const mode = useLayoutMode();
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const seed = useGameStore((s) => s.state?.seed ?? null);
  const blocked = useGameStore((s) => !s.state || s.state.status !== 'running' || !!s.state.pendingEvent || s.eventResult !== null);
  if (blocked) return null;
  const replay = () => useTutorialStore.getState().replayNow(seed);
  const frame =
    mode === 'wide'
      ? (() => {
          const w = wideShellLayout(width, height, insets);
          return { left: w.rail.paddingLeft + (layout.railWidth - touch) / 2, bottom: w.ticker.height + spacing.s };
        })()
      : { right: insets.right + spacing.s, bottom: insets.bottom + touch * 2 + spacing.m };
  return (
    <Pressable onPress={replay} accessibilityRole="button" accessibilityLabel={t('ui.tutorial.help')} style={[styles.help, frame]} testID="tutorial-help">
      <View style={styles.helpDot}>
        <Text style={styles.helpGlyph}>?</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blocker: { position: 'absolute' },
  card: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    borderTopColor: colors.player,
    padding: spacing.m,
    gap: spacing.s,
    shadowColor: colors.newsInk,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cardRow: { flexDirection: 'row', gap: spacing.m, alignItems: 'flex-start' },
  texts: { flex: 1, gap: 2 },
  kicker: { ...voice.calmLabel, color: colors.dim },
  caption: { ...voice.calmHeading, color: colors.text, fontSize: type.m, lineHeight: 20 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  skip: { minHeight: touch, justifyContent: 'center' },
  skipText: { color: colors.dim, fontSize: type.s, textDecorationLine: 'underline' },
  next: { minWidth: 96 },
  help: { position: 'absolute', width: touch, height: touch, alignItems: 'center', justifyContent: 'center', zIndex: layer.sheet - 1 },
  helpDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpGlyph: { ...voice.calmHeading, color: colors.dim, fontSize: 15, lineHeight: 18 },
});
