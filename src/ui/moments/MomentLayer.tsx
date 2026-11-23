import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';
import { getMomentProgress, getMoments, type GameState, type MomentDef } from '@/engine';

import { logLifecycle } from '../diagnostics/log';
import { t } from '../i18n';
import { cased } from '../locale/casing';
import { hasIcon } from '../icons';
import { fallbackGlyph, registry } from '../icons/registry';
import { useAmbientClock, wave } from '../motion/ambient';
import { AnchorPlane, EDGE_INSET, MOVING, edgePoint, local, project, useProjection, type MapProjection } from '../map/live/projection';
import { allFinite, nonNegative, unitInterval } from '../map/svgSafe';
import { useGameStore, type GameStore } from '../store/game';
import { Mascot } from '../mascot';
import { colors, fonts, radius, spacing, type, voice } from '../theme';
import { useCoachStore } from './coach';
import { installMapLiveDebug } from './debug';
import { collectHaptic, landHaptic } from './haptics';
import { BUBBLE, BUBBLE_HIT, BUBBLE_RISE, assignSlots, bubbleOffset, collectLines, effectLines, snapshot, type DeltaLine } from './logic';
import { placeEdgeMarkers, pointAngle, relaxBubbles } from './relax';
import { useTabStore } from '../shell/tabActive';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Phase = 'live' | 'collected' | 'expired';

export interface BubbleItem {
  uid: string;
  defId: string;
  kind: MomentDef['kind'];
  icon: string;
  regionId: string;
  /** Marker point (map units). */
  x: number;
  y: number;
  slot: number;
  spawnTick: number;
  expiresTick: number;
  phase: Phase;
  lines: DeltaLine[];
  caption?: string;
  avoided?: boolean;
}

const RING_R = 17.5;
const RING_W = 3.2;
const DISC_R = 14.5;
const CIRC = 2 * Math.PI * RING_R;
const STEM = BUBBLE_RISE - BUBBLE / 2 - 2;
const ICON = 20;
const APPEAR_MS = 340;
const POP_MS = 320;
const EXPIRE_MS = 760;
const FLOAT_MS = 2100;
const EDGE = 30;
const RING_STEP_MS = 140;

/** While true, looping motion rests (paused, an event card or its result is up). */
const selectStill = (s: GameStore) => !s.state || s.state.status !== 'running' || s.speed === 0 || !!s.state.pendingEvent || s.eventResult !== null;

/**
 * Moment bubbles over the map. One per active moment of the player, at its region's
 * marker point (floating above the data-centre racks), drawn at a constant size. The ring
 * drains with the moment's lifetime (getMomentProgress, eased between ticks on the UI
 * thread); boosts are the theme's good colour with the accent ring, threats are alarm red
 * and pulse faster in their last third. A tap is resolved by the map's touch view (the
 * bubble registers a tap target that wins over the regions) and dispatches collectMoment:
 * the bubble pops and a short line floats up with what was gained (measured) or avoided.
 * Left alone, a boost fades and a threat shakes, bursts and shows what it cost. Bubbles in
 * regions off the visible map get a small indicator at the edge pointing to them (tap it
 * to bring the region into view). Nothing here takes touches.
 */
export const MomentLayer = memo(function MomentLayer({ geometry }: { geometry: MapGeometry }) {
  const p = useProjection();
  const reduced = useReducedMotion();
  const [items, setItems] = useState<BubbleItem[]>([]);
  const collected = useRef(new Set<string>());
  const slots = useRef(new Map<string, number>());
  const coach = useCoachStore((s) => s.active);
  /** Timers that remove collected bubbles; cleared when the layer unmounts. */
  const popTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = popTimers.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);
  useEffect(() => {
    installMapLiveDebug();
    void useCoachStore.getState().load();
    return () => useCoachStore.getState().end();
  }, []);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (ms: number, fn: () => void) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    };
    let live = new Map<string, BubbleItem>();
    let seed: number | null = null;
    const sync = (state: GameState | null, pack: GameStore['pack']) => {
      if (!state) return;
      if (seed !== state.seed) {
        seed = state.seed;
        live = new Map();
        slots.current = new Map();
        collected.current.clear();
        setItems([]);
      }
      const now = state.status === 'running' ? getMoments(state, state.playerLabId).filter((m) => state.tick < m.expiresTick) : [];
      const sameSet = now.length === live.size && now.every((m) => live.has(m.uid));
      if (sameSet) return;
      const nextSlots = assignSlots(now, slots.current);
      slots.current = nextSlots;
      const added: BubbleItem[] = [];
      const nextLive = new Map<string, BubbleItem>();
      for (const m of now) {
        const prev = live.get(m.uid);
        if (prev) {
          nextLive.set(m.uid, prev);
          continue;
        }
        const def = pack.moments.find((d) => d.id === m.defId);
        const g = geometry.regions[m.regionId];
        if (!def || !g || !allFinite(g.centroid[0], g.centroid[1])) continue;
        const item: BubbleItem = {
          uid: m.uid,
          defId: def.id,
          kind: def.kind,
          icon: def.icon,
          regionId: m.regionId,
          x: g.centroid[0],
          y: g.centroid[1],
          slot: nextSlots.get(m.uid) ?? 0,
          spawnTick: m.spawnTick,
          expiresTick: m.expiresTick,
          phase: 'live',
          lines: [],
        };
        nextLive.set(m.uid, item);
        added.push(item);
      }
      const gone = [...live.values()].filter((b) => !nextLive.has(b.uid));
      live = nextLive;
      // Gone without our collect: expired (a collect already moved its bubble on).
      const expired = gone.filter((b) => !collected.current.has(b.uid));
      setItems((current) => {
        let out = current;
        if (expired.length > 0) {
          const ids = new Set(expired.map((e) => e.uid));
          out = out.map((b) => (ids.has(b.uid) && b.phase === 'live' ? { ...b, phase: 'expired' as const, lines: expiryLinesFor(pack, b.defId) } : b));
        }
        return added.length > 0 ? [...out, ...added] : out;
      });
      for (const b of added) logLifecycle('moment spawned', { uid: b.uid, moment: b.defId, kind: b.kind, region: b.regionId });
      for (const b of expired) {
        logLifecycle('moment expired', { uid: b.uid, moment: b.defId, kind: b.kind, region: b.regionId });
        if (b.kind === 'threat') landHaptic();
        later(b.kind === 'threat' ? FLOAT_MS : EXPIRE_MS, () => setItems((c) => c.filter((x) => x.uid !== b.uid)));
      }
      for (const b of added) useCoachStore.getState().consider(b.kind, b.uid);
    };
    const { state, pack } = useGameStore.getState();
    sync(state, pack);
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.state !== prev.state) sync(s.state, s.pack);
    });
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [geometry]);

  const collect = useCallback((uid: string) => {
    const store = useGameStore.getState();
    const state = store.state;
    if (!state) return;
    const moment = state.moments.find((m) => m.uid === uid);
    const def = moment ? store.pack.moments.find((d) => d.id === moment.defId) : undefined;
    const before = snapshot(state, store.pack);
    collected.current.add(uid);
    const result = store.dispatch({ type: 'collectMoment', labId: state.playerLabId, uid });
    logLifecycle('moment tapped', { uid, moment: moment?.defId, ok: result.ok, reason: result.ok ? undefined : result.reason });
    if (!result.ok) {
      collected.current.delete(uid);
      return;
    }
    const after = useGameStore.getState().state;
    const { lines, avoided } = after ? collectLines(def, before, snapshot(after, store.pack)) : { lines: [], avoided: false };
    const caption = def?.collectTextKey ? t(def.collectTextKey) : undefined;
    collectHaptic();
    useCoachStore.getState().resolved(uid);
    setItems((c) => c.map((b) => (b.uid === uid ? { ...b, phase: 'collected', lines, caption, avoided } : b)));
    const timer = setTimeout(() => {
      popTimers.current.delete(timer);
      setItems((c) => c.filter((x) => x.uid !== uid));
    }, FLOAT_MS + 100);
    popTimers.current.add(timer);
  }, []);

  if (!p || items.length === 0) return null;
  return <MomentItems p={p} items={items} reduced={reduced} coachUid={coach?.uid ?? null} onCollect={collect} />;
});

/** The bubbles, their floating lines, edge markers and the coach line, placed together each frame. */
function MomentItems({ p, items, reduced, coachUid, onCollect }: { p: MapProjection; items: BubbleItem[]; reduced: boolean; coachUid: string | null; onCollect: (uid: string) => void }) {
  const placement = usePlacement(p, items);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="moment-layer">
      {/* Floating lines under the bubbles, so a line never hides a bubble still to tap. */}
      {items.map((b) => (b.phase !== 'live' && (b.lines.length > 0 || b.caption) ? <Floater key={`f-${b.uid}`} p={p} item={b} reduced={reduced} /> : null))}
      <AnchorPlane p={p}>
        {items.map((b, i) => (
          <Bubble key={b.uid} p={p} item={b} index={i} placement={placement} reduced={reduced} onCollect={onCollect} />
        ))}
      </AnchorPlane>
      {items.map((b, i) => (b.phase === 'live' ? <EdgeIndicator key={`e-${b.uid}`} item={b} index={i} placement={placement} /> : null))}
      {coachUid ? items.map((b) => (b.uid === coachUid && b.phase === 'live' ? <CoachCaption key={`c-${b.uid}`} p={p} item={b} /> : null)) : null}
    </View>
  );
}

/** Where each bubble is drawn this frame: its nudge (points) and, when it is off screen, its edge marker. */
export interface Placed {
  /** Nudge added to the bubble's slot position (src/ui/moments/relax.ts). */
  nx: number;
  ny: number;
  /** Centre of the edge marker standing for it, or -1 when it is on screen. */
  ex: number;
  ey: number;
  /** Where the bubble would be (container coordinates), for the marker's arrow. */
  bx: number;
  by: number;
}

/**
 * One worklet per frame for all bubbles: projects each, keeps them apart and clear of the
 * controls and the standings strip, and places edge markers for those off screen. At most
 * a few bubbles, so the pairwise relaxation costs next to nothing.
 */
function usePlacement(p: MapProjection, items: readonly BubbleItem[]): SharedValue<Placed[]> {
  const specs = useMemo(
    () =>
      items.map((b) => {
        const [dx, dy] = bubbleOffset(b.slot);
        return { mx: b.x, my: b.y, dx, dy };
      }),
    [items],
  );
  const { scale, tx, ty, frame, obstacles } = p;
  const placed = useDerivedValue(() => {
    const f = frame.get();
    const s = scale.get();
    const x = tx.get();
    const y = ty.get();
    const right = Math.max(1, f.cw - f.insetRight);
    const pts: [number, number][] = [];
    const anchors: [number, number][] = [];
    const on: boolean[] = [];
    const edges: ([number, number] | null)[] = [];
    for (let i = 0; i < specs.length; i++) {
      const sp = specs[i];
      const [sx, sy] = project(f, s, x, y, sp.mx, sp.my);
      const bx = sx + sp.dx;
      const by = sy + sp.dy;
      const e = edgePoint(bx, by, right, f.ch);
      pts.push([bx, by]);
      anchors.push([sx, sy]);
      on.push(!e);
      edges.push(e);
    }
    const rects = obstacles.get();
    const nudges = relaxBubbles(pts, on, rects, right, f.ch, BUBBLE / 2, anchors, BUBBLE_HIT + 2);
    const marks = placeEdgeMarkers(edges, rects, right, f.ch, EDGE, EDGE_INSET);
    const out: Placed[] = [];
    for (let i = 0; i < specs.length; i++) {
      const m = marks[i];
      out.push({ nx: nudges[i][0], ny: nudges[i][1], ex: m ? m[0] : -1, ey: m ? m[1] : -1, bx: pts[i][0], by: pts[i][1] });
    }
    return out;
  }, [specs]);
  return placed;
}

/** Lines an expired threat shows: the cost read from its pack definition. */
export function expiryLinesFor(pack: GameStore['pack'], defId: string): DeltaLine[] {
  const def = pack.moments.find((d) => d.id === defId);
  return def && def.kind === 'threat' ? effectLines(def.onExpire) : [];
}

function bubbleColors(kind: MomentDef['kind']) {
  return kind === 'threat'
    ? { disc: colors.alarm, icon: colors.newsPaper, ring: colors.newsPaper, track: colors.newsInk, edge: colors.newsPaper }
    : { disc: colors.good, icon: colors.onPlayer, ring: colors.player, track: colors.newsInk, edge: colors.outline };
}

/**
 * The ring's progress (getMomentProgress), set once per tick on the UI side with a short
 * ease: no React render per tick, and no SVG redraw on every frame between ticks (a ring
 * step per tick reads as a steady drain and costs a fraction of a continuous tween).
 */
function useLifetime(uid: string, live: boolean): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      cancelAnimation(progress);
      return;
    }
    const update = (s: GameStore, animate: boolean) => {
      const state = s.state;
      if (!state) return;
      const now = getMomentProgress(state, uid);
      progress.set(animate ? withTiming(now, { duration: RING_STEP_MS, easing: Easing.out(Easing.quad) }) : now);
    };
    update(useGameStore.getState(), false);
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.state?.tick !== prev.state?.tick) update(s, true);
    });
    return () => {
      unsubscribe();
      cancelAnimation(progress);
    };
  }, [uid, live, progress]);
  return progress;
}

const Bubble = memo(function Bubble({
  p,
  item,
  index,
  placement,
  reduced,
  onCollect,
}: {
  p: MapProjection;
  item: BubbleItem;
  index: number;
  placement: SharedValue<Placed[]>;
  reduced: boolean;
  onCollect: (uid: string) => void;
}) {
  const live = item.phase === 'live';
  const [dx, dy] = bubbleOffset(item.slot);
  const still = useTabStore(selectStill);
  const clock = useAmbientClock(live && !still);
  const progress = useLifetime(item.uid, live);
  const appear = useSharedValue(reduced ? 1 : 0);
  const leave = useSharedValue(0);
  const threat = item.kind === 'threat';
  const phase = item.phase === 'collected' ? 1 : item.phase === 'expired' ? (threat ? 3 : 2) : 0;

  useEffect(() => {
    if (!reduced) appear.set(withTiming(1, { duration: APPEAR_MS, easing: Easing.out(Easing.back(2.2)) }));
    return () => cancelAnimation(appear);
  }, [appear, reduced]);
  useEffect(() => {
    if (item.phase === 'live') return;
    const ms = item.phase === 'collected' ? POP_MS : EXPIRE_MS;
    leave.set(reduced ? 1 : withTiming(1, { duration: ms, easing: item.phase === 'collected' ? Easing.out(Easing.cubic) : Easing.linear }));
    return () => cancelAnimation(leave);
  }, [item.phase, leave, reduced]);

  // The tap target: the bubble while it is live, or its edge indicator when it is off screen.
  useEffect(() => {
    if (!live) return;
    // The hit test uses where the bubble (or its edge marker) is actually drawn after the relaxation.
    const place = () => {
      const pl = placement.get()[index];
      if (!pl) return null;
      return { nudge: [pl.nx, pl.ny] as [number, number], edge: pl.ex >= 0 ? ([pl.ex, pl.ey] as [number, number]) : null };
    };
    p.targets.set(item.uid, { mx: item.x, my: item.y, dx, dy, r: BUBBLE_HIT, onTap: () => onCollect(item.uid), onEdgeTap: () => p.focus(item.regionId), place });
    return () => p.targets.delete(item.uid);
  }, [live, p, item.uid, item.x, item.y, item.regionId, dx, dy, onCollect, placement, index]);

  const { scale, frame } = p;
  const mx = item.x;
  const my = item.y;
  // Inside the moment layer's anchor plane: only the zoom (and the pulse) move the bubble itself.
  const style = useAnimatedStyle(() => {
    const [lx, ly] = local(frame.get(), scale.get(), mx, my);
    const pl = placement.get()[index];
    const sx = lx + (pl ? pl.nx : 0);
    const sy = ly + (pl ? pl.ny : 0);
    const k = leave.get();
    const t = clock ? clock.get() : 0;
    const pr = progress.get();
    const urgent = threat && pr > 2 / 3;
    let s = appear.get();
    let o = 1;
    let shake = 0;
    if (phase === 0) {
      // One pulse per bubble (a single style write per frame): gentle for boosts, urgent for a threat's last third.
      s *= 1 + (threat ? (urgent ? 0.13 * wave(t, 0.5) : 0.06 * wave(t, 1.5)) : 0.07 * wave(t, 1.8));
    } else if (phase === 1) {
      s *= 1 + 0.55 * k;
      o = 1 - k;
    } else if (phase === 2) {
      s *= 1 - 0.35 * k;
      o = 1 - k;
    } else {
      // Threat lands: a short shake, then it bursts.
      if (k < 0.45) shake = Math.sin(k * 60) * 4.5;
      else {
        const b = (k - 0.45) / 0.55;
        s *= 1 + 0.7 * b;
        o = 1 - b;
      }
    }
    return { opacity: unitInterval(o), transform: [{ translateX: sx + dx - BUBBLE / 2 + shake }, { translateY: sy + dy - BUBBLE / 2 }, { scale: nonNegative(s) }] };
  });
  const burstStyle = useAnimatedStyle(() => {
    const k = leave.get();
    const b = phase === 3 ? Math.max(0, (k - 0.45) / 0.55) : k;
    return { opacity: unitInterval(phase === 1 || phase === 3 ? (1 - b) * 0.9 : 0), transform: [{ scale: 1 + b * 1.6 }] };
  });
  // The stem points at the region's marker: only while the bubble sits in its own slot.
  const stemStyle = useAnimatedStyle(() => {
    const pl = placement.get()[index];
    return { opacity: pl && Math.abs(pl.nx) + Math.abs(pl.ny) > 3 ? 0 : 1 };
  });
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * unitInterval(progress.get()) }));

  const c = bubbleColors(item.kind);
  const Glyph = hasIcon(item.icon) ? registry[item.icon] : fallbackGlyph;
  const iconScale = ICON / 24;
  const o = (BUBBLE - ICON) / 2;
  return (
    <Animated.View style={[styles.bubble, MOVING, style]} pointerEvents="none" testID={`moment-${item.kind}-${item.uid}`}>
      <View style={[styles.halo, { backgroundColor: threat ? colors.alarm : colors.good, opacity: threat ? 0.35 : 0.25 }]} />
      <Animated.View style={[styles.burst, { borderColor: threat ? colors.alarm : colors.player }, burstStyle]} />
      {item.slot === 0 ? <Animated.View style={[styles.stem, { backgroundColor: c.edge }, stemStyle]} /> : null}
      <Svg width={BUBBLE} height={BUBBLE} viewBox={`0 0 ${BUBBLE} ${BUBBLE}`}>
        <Circle cx={BUBBLE / 2} cy={BUBBLE / 2} r={RING_R} fill={c.track} fillOpacity={0.55} stroke={c.track} strokeOpacity={0.5} strokeWidth={RING_W} />
        <AnimatedCircle
          cx={BUBBLE / 2}
          cy={BUBBLE / 2}
          r={RING_R}
          fill="none"
          stroke={c.ring}
          strokeWidth={RING_W}
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeLinecap="butt"
          transform={`rotate(-90 ${BUBBLE / 2} ${BUBBLE / 2})`}
          animatedProps={ringProps}
        />
        <Circle cx={BUBBLE / 2} cy={BUBBLE / 2} r={DISC_R} fill={c.disc} stroke={c.edge} strokeWidth={1} />
        <G transform={`translate(${o} ${o}) scale(${iconScale})`} stroke={c.icon} strokeWidth={2.1} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Glyph c={c.icon} a={c.icon} w={2.1} />
        </G>
      </Svg>
    </Animated.View>
  );
});

/**
 * A small marker at the visible map's edge standing for a bubble that is off screen (on the
 * side nearest to it, slid clear of the controls and other markers; tap it to go there),
 * with a small arrow pointing towards the bubble.
 */
const EdgeIndicator = memo(function EdgeIndicator({ item, index, placement }: { item: BubbleItem; index: number; placement: SharedValue<Placed[]> }) {
  const style = useAnimatedStyle(() => {
    const pl = placement.get()[index];
    if (!pl || pl.ex < 0) return { opacity: 0, transform: [{ translateX: -999 }, { translateY: -999 }] };
    return { opacity: 1, transform: [{ translateX: pl.ex - EDGE / 2 }, { translateY: pl.ey - EDGE / 2 }] };
  });
  const arrowStyle = useAnimatedStyle(() => {
    const pl = placement.get()[index];
    const a = pl && pl.ex >= 0 ? pointAngle(pl.ex, pl.ey, pl.bx, pl.by) : 0;
    return { transform: [{ rotate: `${a}rad` }] };
  });
  const c = bubbleColors(item.kind);
  const Glyph = hasIcon(item.icon) ? registry[item.icon] : fallbackGlyph;
  return (
    <Animated.View style={[styles.edge, style]} pointerEvents="none" testID={`moment-edge-${item.uid}`}>
      <View style={[styles.edgeRing, { borderColor: c.disc }]} />
      <Animated.View style={[styles.edgeArrowTrack, arrowStyle]}>
        <View style={[styles.edgeArrow, { borderLeftColor: c.disc }]} />
      </Animated.View>
      <View style={[styles.edgeDisc, { backgroundColor: c.disc, borderColor: c.edge }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <G stroke={c.icon} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <Glyph c={c.icon} a={c.icon} w={2.4} />
          </G>
        </Svg>
      </View>
    </Animated.View>
  );
});

const FLOAT_W = 210;
const FLOAT_H = 120;

/** The line that floats up from a collected or landed moment (below it when there is no room above). */
const Floater = memo(function Floater({ p, item, reduced }: { p: MapProjection; item: BubbleItem; reduced: boolean }) {
  const [dx, dy] = bubbleOffset(item.slot);
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.set(withTiming(1, { duration: FLOAT_MS, easing: Easing.out(Easing.quad) }));
    return () => cancelAnimation(rise);
  }, [rise]);
  const { scale, tx, ty, frame } = p;
  const mx = item.x;
  const my = item.y;
  // Decided once, where the bubble is now: above it, or below its region's marks near the top edge.
  const [below] = useState(() => {
    const l = p.layout();
    const v = p.view();
    const [, sy] = project({ cw: l.cw, ch: l.ch, mw: l.mw, mh: l.mh, insetRight: l.insetRight ?? 0 }, v.s, v.tx, v.ty, mx, my);
    return sy + dy - BUBBLE / 2 < FLOAT_H - 30;
  });
  const motion = reduced ? 0 : 1;
  const style = useAnimatedStyle(() => {
    const f = frame.get();
    const [sx, sy] = project(f, scale.get(), tx.get(), ty.get(), mx, my);
    const k = rise.get();
    const right = Math.max(FLOAT_W + 8, f.cw - f.insetRight);
    const x = Math.min(Math.max(sx + dx - FLOAT_W / 2, 4), right - FLOAT_W - 4);
    const top = below ? sy + 34 : sy + dy - BUBBLE / 2 - FLOAT_H + 6;
    const o = k < 0.06 ? k / 0.06 : k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
    return { opacity: unitInterval(o), transform: [{ translateX: x }, { translateY: top + (below ? 1 : -1) * motion * k * 22 }] };
  });
  const lost = item.phase === 'expired';
  return (
    <Animated.View style={[styles.floater, below && styles.floaterBelow, MOVING, style]} pointerEvents="none" testID={`moment-float-${item.phase}`}>
      {item.avoided || lost ? <Text style={[styles.kicker, lost ? styles.kickerLost : styles.kickerAvoided]}>{t(lost ? 'ui.moments.landed' : 'ui.moments.avoided')}</Text> : null}
      <View style={styles.lines}>
        {item.lines.slice(0, 3).map((l, i) => (
          <Text key={i} style={[styles.line, lost ? styles.lineLost : item.avoided ? styles.lineAvoided : l.good ? styles.lineGood : styles.lineBad]} numberOfLines={1}>
            {cased(styles.line, l.text)}
          </Text>
        ))}
      </View>
      {item.caption ? (
        <Text style={styles.caption} numberOfLines={2}>
          {item.caption}
        </Text>
      ) : null}
    </Animated.View>
  );
});

const COACH_W = 236;

/** The first-run coach line under a bubble ("Tap it before it fades"), in the tutorial's caption style. */
const CoachCaption = memo(function CoachCaption({ p, item }: { p: MapProjection; item: BubbleItem }) {
  const { scale, tx, ty, frame } = p;
  const mx = item.x;
  const my = item.y;
  // Bring the bubble into view first if it is off the visible map.
  useEffect(() => {
    const l = p.layout();
    const v = p.view();
    const [sx, sy] = project({ cw: l.cw, ch: l.ch, mw: l.mw, mh: l.mh, insetRight: l.insetRight ?? 0 }, v.s, v.tx, v.ty, mx, my);
    if (edgePoint(sx, sy - BUBBLE_RISE, l.cw - (l.insetRight ?? 0), l.ch)) p.focus(item.regionId);
  }, [p, mx, my, item.regionId]);
  const style = useAnimatedStyle(() => {
    const f = frame.get();
    const [sx, sy] = project(f, scale.get(), tx.get(), ty.get(), mx, my);
    const right = Math.max(COACH_W + 8, f.cw - f.insetRight);
    const x = Math.min(Math.max(sx - COACH_W / 2, 6), right - COACH_W - 6);
    // Below the racks, or above the bubble when there is no room below.
    const below = sy + 34;
    const y = below + 70 < f.ch ? below : sy - BUBBLE_RISE - BUBBLE / 2 - 78;
    return { transform: [{ translateX: x }, { translateY: y }] };
  });
  return (
    <Animated.View style={[styles.coach, MOVING, style]} pointerEvents="none" testID="moment-coach">
      <Mascot mood={item.kind === 'threat' ? 'sweating' : 'pleased'} size={30} blinks={false} />
      <Text style={styles.coachText}>{t(item.kind === 'threat' ? 'ui.moments.coach.threat' : 'ui.moments.coach.boost')}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  coach: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: COACH_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
    borderTopColor: colors.player,
    padding: spacing.m,
  },
  coachText: { ...voice.calmHeading, flex: 1, color: colors.text, fontSize: type.m, lineHeight: 20 },
  bubble: { position: 'absolute', left: 0, top: 0, width: BUBBLE, height: BUBBLE, overflow: 'visible' },
  halo: { position: 'absolute', left: -5, top: -5, width: BUBBLE + 10, height: BUBBLE + 10, borderRadius: BUBBLE / 2 + 5 },
  burst: { position: 'absolute', left: 0, top: 0, width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, borderWidth: 3 },
  stem: { position: 'absolute', left: BUBBLE / 2 - 1, top: BUBBLE / 2 + RING_R, width: 2, height: STEM - RING_R + BUBBLE / 2 },
  edge: { position: 'absolute', left: 0, top: 0, width: EDGE, height: EDGE, alignItems: 'center', justifyContent: 'center' },
  edgeRing: { position: 'absolute', left: 0, top: 0, width: EDGE, height: EDGE, borderRadius: EDGE / 2, borderWidth: 2, borderStyle: 'dashed' },
  // The arrow: a fixed-size track the size of the marker, rotated towards the bubble, with a triangle at its right end.
  edgeArrowTrack: { position: 'absolute', left: 0, top: 0, width: EDGE, height: EDGE },
  edgeArrow: {
    position: 'absolute',
    left: EDGE - 1,
    top: EDGE / 2 - 5,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 7,
    borderTopColor: colors.transparent,
    borderBottomColor: colors.transparent,
  },
  edgeDisc: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  floater: { position: 'absolute', left: 0, top: 0, width: FLOAT_W, height: FLOAT_H, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  floaterBelow: { justifyContent: 'flex-start' },
  kicker: { ...voice.loudKicker, fontSize: 11, paddingHorizontal: 5, overflow: 'hidden' },
  kickerLost: { color: colors.newsPaper, backgroundColor: colors.newsRed },
  kickerAvoided: { color: colors.newsPaper, backgroundColor: colors.newsInk },
  lines: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  line: { fontFamily: fonts.newsHeavy, fontSize: 19, lineHeight: 22, paddingHorizontal: 6, textTransform: 'uppercase', overflow: 'hidden' },
  lineGood: { color: colors.newsGood, backgroundColor: colors.newsPaper },
  lineBad: { color: colors.newsPaper, backgroundColor: colors.newsRed },
  lineLost: { color: colors.newsPaper, backgroundColor: colors.newsRed },
  lineAvoided: { color: colors.newsPaper, backgroundColor: colors.newsInk, textDecorationLine: 'line-through' },
  caption: {
    ...voice.body,
    fontSize: 12,
    lineHeight: 15,
    color: colors.newsInk,
    backgroundColor: colors.newsPaper,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    textAlign: 'center',
    overflow: 'hidden',
  },
});

