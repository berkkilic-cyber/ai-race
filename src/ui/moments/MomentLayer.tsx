import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';
import { getMomentProgress, getMoments, type GameState, type MomentDef } from '@/engine';

import { BASE_TICK_MS } from '../hooks/useGameLoop';
import { t } from '../i18n';
import { hasIcon } from '../icons';
import { fallbackGlyph, registry } from '../icons/registry';
import { useAmbientClock, wave } from '../motion/ambient';
import { edgePoint, project, useProjection, type MapProjection } from '../map/live/projection';
import { allFinite, nonNegative, unitInterval } from '../map/svgSafe';
import { useGameStore, type GameStore } from '../store/game';
import { Mascot } from '../mascot';
import { colors, fonts, radius, spacing, type, voice } from '../theme';
import { useCoachStore } from './coach';
import { collectHaptic, landHaptic } from './haptics';
import { BUBBLE, BUBBLE_HIT, BUBBLE_RISE, assignSlots, bubbleOffset, collectLines, effectLines, snapshot, type DeltaLine } from './logic';

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
  useEffect(() => {
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
      for (const b of expired) {
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
    setTimeout(() => setItems((c) => c.filter((x) => x.uid !== uid)), FLOAT_MS + 100);
  }, []);

  if (!p || items.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="moment-layer">
      {items.map((b) => (
        <Bubble key={b.uid} p={p} item={b} reduced={reduced} onCollect={collect} />
      ))}
      {items.map((b) => (b.phase === 'live' ? <EdgeIndicator key={`e-${b.uid}`} p={p} item={b} /> : null))}
      {items.map((b) => (b.phase !== 'live' && (b.lines.length > 0 || b.caption) ? <Floater key={`f-${b.uid}`} p={p} item={b} reduced={reduced} /> : null))}
      {coach ? items.map((b) => (b.uid === coach.uid && b.phase === 'live' ? <CoachCaption key={`c-${b.uid}`} p={p} item={b} /> : null)) : null}
    </View>
  );
});

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

/** The ring's progress, eased towards the next tick while the game runs (UI thread; no React render per tick). */
function useLifetime(uid: string, spawnTick: number, expiresTick: number, live: boolean): SharedValue<number> {
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      cancelAnimation(progress);
      return;
    }
    const life = Math.max(1, expiresTick - spawnTick);
    const update = (s: GameStore) => {
      const state = s.state;
      if (!state) return;
      const now = getMomentProgress(state, uid);
      const running = s.speed > 0 && !state.pendingEvent && s.eventResult === null && state.status === 'running';
      if (!running) {
        cancelAnimation(progress);
        progress.set(now);
        return;
      }
      progress.set(now);
      progress.set(withTiming(Math.min(1, now + 1 / life), { duration: BASE_TICK_MS / s.speed, easing: Easing.linear }));
    };
    update(useGameStore.getState());
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.state?.tick !== prev.state?.tick || s.speed !== prev.speed || s.state?.pendingEvent !== prev.state?.pendingEvent || s.eventResult !== prev.eventResult) update(s);
    });
    return () => {
      unsubscribe();
      cancelAnimation(progress);
    };
  }, [uid, spawnTick, expiresTick, live, progress]);
  return progress;
}

const Bubble = memo(function Bubble({ p, item, reduced, onCollect }: { p: MapProjection; item: BubbleItem; reduced: boolean; onCollect: (uid: string) => void }) {
  const live = item.phase === 'live';
  const [dx, dy] = bubbleOffset(item.slot);
  const still = useGameStore(selectStill);
  const clock = useAmbientClock(live && !still);
  const progress = useLifetime(item.uid, item.spawnTick, item.expiresTick, live);
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
    p.targets.set(item.uid, { mx: item.x, my: item.y, dx, dy, r: BUBBLE_HIT, onTap: () => onCollect(item.uid), onEdgeTap: () => p.focus(item.regionId) });
    return () => p.targets.delete(item.uid);
  }, [live, p, item.uid, item.x, item.y, item.regionId, dx, dy, onCollect]);

  const { scale, tx, ty, frame } = p;
  const mx = item.x;
  const my = item.y;
  const style = useAnimatedStyle(() => {
    const [sx, sy] = project(frame.get(), scale.get(), tx.get(), ty.get(), mx, my);
    const k = leave.get();
    const t = clock ? clock.get() : 0;
    const pr = progress.get();
    const urgent = threat && pr > 2 / 3;
    let s = appear.get();
    let o = 1;
    let shake = 0;
    let bob = 0;
    if (phase === 0) {
      s *= 1 + (threat ? (urgent ? 0.11 * wave(t, 0.5) : 0.05 * wave(t, 1.5)) : 0.04 * wave(t, 2.2));
      bob = threat ? 0 : -2.5 * wave(t, 2.2);
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
    return { opacity: unitInterval(o), transform: [{ translateX: sx + dx - BUBBLE / 2 + shake }, { translateY: sy + dy - BUBBLE / 2 + bob }, { scale: nonNegative(s) }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const t = clock ? clock.get() : 0;
    const urgent = threat && progress.get() > 2 / 3;
    const w = urgent ? wave(t, 0.5) : wave(t, threat ? 1.5 : 2.2);
    return { opacity: unitInterval((threat ? (urgent ? 0.55 : 0.3) : 0.22) * (1 - w * 0.6)), transform: [{ scale: 1 + w * (urgent ? 0.5 : 0.28) }] };
  });
  const burstStyle = useAnimatedStyle(() => {
    const k = leave.get();
    const b = phase === 3 ? Math.max(0, (k - 0.45) / 0.55) : k;
    return { opacity: unitInterval(phase === 1 || phase === 3 ? (1 - b) * 0.9 : 0), transform: [{ scale: 1 + b * 1.6 }] };
  });
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * unitInterval(progress.get()) }));

  const c = bubbleColors(item.kind);
  const Glyph = hasIcon(item.icon) ? registry[item.icon] : fallbackGlyph;
  const iconScale = ICON / 24;
  const o = (BUBBLE - ICON) / 2;
  return (
    <Animated.View style={[styles.bubble, style]} pointerEvents="none" testID={`moment-${item.kind}-${item.uid}`}>
      <Animated.View style={[styles.halo, { backgroundColor: threat ? colors.alarm : colors.good }, haloStyle]} />
      <Animated.View style={[styles.burst, { borderColor: threat ? colors.alarm : colors.player }, burstStyle]} />
      {item.slot === 0 ? <View style={[styles.stem, { backgroundColor: c.edge }]} /> : null}
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

/** A small marker at the visible map's edge pointing to a bubble that is off screen. */
const EdgeIndicator = memo(function EdgeIndicator({ p, item }: { p: MapProjection; item: BubbleItem }) {
  const [dx, dy] = bubbleOffset(item.slot);
  const { scale, tx, ty, frame } = p;
  const mx = item.x;
  const my = item.y;
  const style = useAnimatedStyle(() => {
    const f = frame.get();
    const [sx, sy] = project(f, scale.get(), tx.get(), ty.get(), mx, my);
    const right = Math.max(1, f.cw - f.insetRight);
    const at = edgePoint(sx + dx, sy + dy, right, f.ch);
    if (!at) return { opacity: 0, transform: [{ translateX: -999 }, { translateY: -999 }] };
    return { opacity: 1, transform: [{ translateX: at[0] - EDGE / 2 }, { translateY: at[1] - EDGE / 2 }] };
  });
  const arrowStyle = useAnimatedStyle(() => {
    const f = frame.get();
    const [sx, sy] = project(f, scale.get(), tx.get(), ty.get(), mx, my);
    const right = Math.max(1, f.cw - f.insetRight);
    const at = edgePoint(sx + dx, sy + dy, right, f.ch) ?? [sx + dx, sy + dy];
    const angle = Math.atan2(sy + dy - at[1], sx + dx - at[0]);
    return { transform: [{ rotate: `${Number.isFinite(angle) ? angle : 0}rad` }] };
  });
  const c = bubbleColors(item.kind);
  const Glyph = hasIcon(item.icon) ? registry[item.icon] : fallbackGlyph;
  return (
    <Animated.View style={[styles.edge, style]} pointerEvents="none" testID={`moment-edge-${item.uid}`}>
      <Animated.View style={[StyleSheet.absoluteFill, arrowStyle]}>
        <View style={[styles.arrow, { borderLeftColor: c.disc }]} />
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

const FLOAT_W = 230;
const FLOAT_H = 120;

/** The line that floats up from a collected or landed moment. */
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
  const motion = reduced ? 0 : 1;
  const style = useAnimatedStyle(() => {
    const f = frame.get();
    const [sx, sy] = project(f, scale.get(), tx.get(), ty.get(), mx, my);
    const k = rise.get();
    const right = Math.max(FLOAT_W + 8, f.cw - f.insetRight);
    const x = Math.min(Math.max(sx + dx - FLOAT_W / 2, 4), right - FLOAT_W - 4);
    const top = Math.max(4 - FLOAT_H + 60, sy + dy - BUBBLE / 2 - FLOAT_H + 6);
    const o = k < 0.06 ? k / 0.06 : k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
    return { opacity: unitInterval(o), transform: [{ translateX: x }, { translateY: top - motion * k * 26 }] };
  });
  const lost = item.phase === 'expired';
  return (
    <Animated.View style={[styles.floater, style]} pointerEvents="none" testID={`moment-float-${item.phase}`}>
      {item.avoided || lost ? <Text style={[styles.kicker, lost ? styles.kickerLost : styles.kickerAvoided]}>{t(lost ? 'ui.moments.landed' : 'ui.moments.avoided')}</Text> : null}
      <View style={styles.lines}>
        {item.lines.slice(0, 3).map((l, i) => (
          <Text key={i} style={[styles.line, lost ? styles.lineLost : item.avoided ? styles.lineAvoided : l.good ? styles.lineGood : styles.lineBad]} numberOfLines={1}>
            {l.text}
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
    <Animated.View style={[styles.coach, style]} pointerEvents="none" testID="moment-coach">
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
  halo: { position: 'absolute', left: 0, top: 0, width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2 },
  burst: { position: 'absolute', left: 0, top: 0, width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, borderWidth: 3 },
  stem: { position: 'absolute', left: BUBBLE / 2 - 1, top: BUBBLE / 2 + RING_R, width: 2, height: STEM - RING_R + BUBBLE / 2 },
  edge: { position: 'absolute', left: 0, top: 0, width: EDGE, height: EDGE, alignItems: 'center', justifyContent: 'center' },
  arrow: {
    position: 'absolute',
    right: -7,
    top: EDGE / 2 - 6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 9,
    borderTopColor: colors.transparent,
    borderBottomColor: colors.transparent,
  },
  edgeDisc: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  floater: { position: 'absolute', left: 0, top: 0, width: FLOAT_W, height: FLOAT_H, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
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

