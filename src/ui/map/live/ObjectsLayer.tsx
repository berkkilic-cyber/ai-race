import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';
import { getCompute, getReachableRegions, type GameState } from '@/engine';

import { readableLabColor, t } from '../../i18n';
import { Icon } from '../../icons';
import { useKeyedSelector } from '../../hooks/useKeyedSelector';
import { useGameStore, type GameStore } from '../../store/game';
import { colors, fonts, spacing, voice } from '../../theme';
import { sitesKey } from '../mapColors';
import { allFinite } from '../svgSafe';
import { barrierIcon, mapLiveConfig } from './config';
import { MAX_RACKS, OBJECT, RACK, objectItems, objectOffset, objectsKey, parseObjectsKey, placeSites, rackIcon, type SiteItem } from './objects';
import { AnchorPlane, MOVING, project, useAnchorStyle, useProjection, type MapProjection } from './projection';

const ident = (s: string) => s;

const selectSites = (s: GameStore) => (s.state ? sitesKey(s.state) : '');
const selectObjects = (s: GameStore) => (s.state ? objectsKey(objectItems(s.state, s.pack, mapLiveConfig(s.pack.id))) : '');

/** Barriers blocking the player's spread into the selected region ("" when none). */
function blockedKey(state: GameState | null, pack: GameStore['pack'], regionId: string | null): string {
  if (!state || !regionId) return '';
  const row = getReachableRegions(state, pack, state.playerLabId).find((r) => r.regionId === regionId);
  return row && !row.present && row.blockedBy ? row.blockedBy.join('|') : '';
}

interface RegionStuff {
  sites: SiteItem[];
  objects: string[];
  barriers: string[];
}

/**
 * Things standing on the map at a constant size: data centres as rack chips by level (the
 * player's filled with the accent, rivals outlined in their colour, offline ones grey), the
 * objects of owned nodes (robots in the strongest regions, lobbyists in the strictest), the
 * barrier mark of a selected region the player cannot spread into yet, and crates of GPUs
 * flying in when the player's compute rises. All draw only (pointerEvents none).
 */
export const ObjectsLayer = memo(function ObjectsLayer({ geometry, selected }: { geometry: MapGeometry; selected: string | null }) {
  const p = useProjection();
  const sites = useKeyedSelector(selectSites, ident);
  const objects = useKeyedSelector(selectObjects, ident);
  const selectBlocked = useMemo(() => (s: GameStore) => blockedKey(s.state, s.pack, selected), [selected]);
  const blocked = useKeyedSelector(selectBlocked, ident);
  const packId = useGameStore((s) => s.pack.id);

  const byRegion = useMemo(() => {
    const out = new Map<string, RegionStuff>();
    const get = (id: string) => {
      let r = out.get(id);
      if (!r) out.set(id, (r = { sites: [], objects: [], barriers: [] }));
      return r;
    };
    const playerId = useGameStore.getState().state?.playerLabId;
    if (sites) {
      for (const part of sites.split(';')) {
        const [labId, dcId, regionId, level, on] = part.split(',');
        get(regionId).sites.push({ key: `${labId}:${dcId}`, labId, level: Number(level), online: on === '1', mine: labId === playerId });
      }
    }
    for (const o of parseObjectsKey(objects)) get(o.regionId).objects.push(o.icon);
    if (selected && blocked) get(selected).barriers = blocked.split('|');
    return out;
  }, [sites, objects, blocked, selected]);

  if (!p) return null;
  const config = mapLiveConfig(packId);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="map-objects">
      <AnchorPlane p={p}>
        {[...byRegion.entries()].map(([regionId, stuff]) => {
          const g = geometry.regions[regionId];
          if (!g || !allFinite(g.centroid[0], g.centroid[1])) return null;
          return <RegionThings key={regionId} p={p} x={g.centroid[0]} y={g.centroid[1]} stuff={stuff} barrierIcons={stuff.barriers.map((b) => barrierIcon(config, b))} />;
        })}
      </AnchorPlane>
      <CrateFlights geometry={geometry} p={p} />
    </View>
  );
});

const RegionThings = memo(function RegionThings({ p, x, y, stuff, barrierIcons }: { p: MapProjection; x: number; y: number; stuff: RegionStuff; barrierIcons: string[] }) {
  const style = useAnchorStyle(p, x, y, 0, 0, 0, 0);
  const labs = useGameStore.getState().state?.labs;
  const { placed, more } = placeSites(stuff.sites);
  return (
    <Animated.View style={[styles.anchor, style]} pointerEvents="none">
      {placed.map((s) => {
        const lab = labs?.[s.labId];
        const tint = !s.online ? colors.offline : lab ? readableLabColor(lab) : colors.dim;
        const filled = s.mine && s.online;
        return (
          <View
            key={s.key}
            style={[styles.rack, { left: s.dx - RACK / 2, top: s.dy - RACK / 2, borderColor: filled ? colors.onPlayer : tint, backgroundColor: filled ? colors.player : colors.surface }]}
            testID={`rack-${s.key}-l${s.level}${s.online ? '' : '-off'}`}
          >
            <Icon name={rackIcon(s.level)} size={RACK - 3} color={filled ? colors.onPlayer : tint} accent={filled ? colors.onPlayer : tint} strokeWidth={2} />
          </View>
        );
      })}
      {more > 0 ? <Text style={[styles.more, { left: placed[placed.length - 1].dx + RACK / 2 + 1, top: placed[0].dy - 7 }]}>+{more}</Text> : null}
      {stuff.objects.map((icon, i) => {
        const [dx, dy] = objectOffset(i, Math.min(MAX_RACKS, placed.length));
        return (
          <View key={`${icon}-${i}`} style={[styles.object, { left: dx - OBJECT / 2, top: dy - OBJECT / 2 }]} testID={`map-object-${icon}`}>
            <Icon name={icon} size={OBJECT - 2} color={colors.onPlayer} accent={colors.onPlayer} strokeWidth={2.2} />
          </View>
        );
      })}
      {barrierIcons.map((icon, i) => (
        <View key={`b-${i}`} style={[styles.barrier, { left: -12 + (i - (barrierIcons.length - 1) / 2) * 26, top: -36 }]} testID="map-barrier">
          <Icon name={icon} size={16} color={colors.newsPaper} accent={colors.newsPaper} strokeWidth={2} />
        </View>
      ))}
    </Animated.View>
  );
});

interface Crate {
  id: number;
  x: number;
  y: number;
  amount: number;
}

const CRATE = 22;
const CRATE_MS = 1300;

/** GPU crates flying in from the map edge to the player's biggest data centre (or home) when compute rises. */
function CrateFlights({ geometry, p }: { geometry: MapGeometry; p: MapProjection }) {
  const reduced = useReducedMotion();
  const [crates, setCrates] = useState<Crate[]>([]);
  const next = useRef(1);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let lastCompute: number | null = null;
    let lastLevels = -1;
    let lastSeed = -1;
    const unsubscribe = useGameStore.subscribe((s) => {
      const state = s.state;
      if (!state || state.status !== 'running') return;
      const lab = state.labs[state.playerLabId];
      const compute = getCompute(state, s.pack, lab.id);
      const levels = lab.dataCentres.reduce((n, dc) => n + dc.level * (dc.disabledUntilTick === undefined || state.tick >= dc.disabledUntilTick ? 1 : 0), 0);
      const rose = lastCompute !== null && lastSeed === state.seed && compute > lastCompute + 1e-6 && levels === lastLevels;
      const amount = lastCompute === null ? 0 : compute - lastCompute;
      lastCompute = compute;
      lastLevels = levels;
      lastSeed = state.seed;
      if (!rose || reduced) return;
      const best = lab.dataCentres.slice().sort((a, b) => b.level - a.level)[0];
      const g = geometry.regions[best?.regionId ?? lab.homeRegion];
      if (!g) return;
      const crate = { id: next.current++, x: g.centroid[0], y: g.centroid[1], amount };
      setCrates((c) => [...c, crate].slice(-3));
      const timer = setTimeout(() => {
        timers.delete(timer);
        setCrates((c) => c.filter((x) => x.id !== crate.id));
      }, CRATE_MS + 900);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [geometry, reduced]);
  return (
    <>
      {crates.map((c) => (
        <CrateFlight key={c.id} p={p} crate={c} />
      ))}
    </>
  );
}

function CrateFlight({ p, crate }: { p: MapProjection; crate: Crate }) {
  const progress = useSharedValue(0);
  // Start at the nearest edge of the visible map, outside it, measured once.
  const start = useMemo(() => {
    const l = p.layout();
    const v = p.view();
    const f = { cw: l.cw, ch: l.ch, mw: l.mw, mh: l.mh, insetRight: l.insetRight ?? 0 };
    const [sx, sy] = project(f, v.s, v.tx, v.ty, crate.x, crate.y);
    const right = l.cw - (l.insetRight ?? 0);
    const edges: [number, number, number][] = [
      [sx, -CRATE, sy],
      [-CRATE, sy, sx],
      [right + CRATE, sy, right - sx],
    ];
    edges.sort((a, b) => a[2] - b[2]);
    return [edges[0][0], edges[0][1]] as const;
  }, [p, crate.x, crate.y]);
  useEffect(() => {
    progress.set(withTiming(1, { duration: CRATE_MS, easing: Easing.inOut(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [progress]);
  const { scale, tx, ty, frame } = p;
  const [x0, y0] = start;
  const cx = crate.x;
  const cy = crate.y;
  const style = useAnimatedStyle(() => {
    const [ex, ey] = project(frame.get(), scale.get(), tx.get(), ty.get(), cx, cy);
    const k = progress.get();
    // A slight arc: the crate rises in the middle of the trip.
    const lift = Math.sin(k * Math.PI) * 30;
    const x = x0 + (ex - x0) * k;
    const y = y0 + (ey - 8 - y0) * k - lift;
    const land = k > 0.92 ? (k - 0.92) / 0.08 : 0;
    return { opacity: 1 - land * 0.9, transform: [{ translateX: x - CRATE / 2 }, { translateY: y - CRATE / 2 }, { scale: 1 + land * 0.4 }, { rotate: `${(1 - k) * -18}deg` }] };
  });
  const labelStyle = useAnimatedStyle(() => {
    const [ex, ey] = project(frame.get(), scale.get(), tx.get(), ty.get(), cx, cy);
    const k = progress.get();
    const show = k > 0.85 ? Math.min(1, (k - 0.85) / 0.15) : 0;
    return { opacity: show, transform: [{ translateX: ex - 40 }, { translateY: Math.max(4, ey - 40 - show * 10) }] };
  });
  return (
    <>
      <Animated.View style={[styles.crate, MOVING, style]} pointerEvents="none" testID="gpu-crate">
        <Icon name="gpu-crate" size={CRATE - 4} color={colors.onPlayer} accent={colors.onPlayer} strokeWidth={2} />
      </Animated.View>
      <Animated.View style={[styles.crateLabel, labelStyle]} pointerEvents="none">
        <Text style={styles.crateText} numberOfLines={1}>
          {t('ui.map.computeGain', { amount: Math.round(crate.amount * 10) / 10, compute: t('term.compute') })}
        </Text>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  rack: {
    position: 'absolute',
    width: RACK,
    height: RACK,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: { position: 'absolute', ...voice.calmLabel, color: colors.text, fontSize: 10 },
  object: {
    position: 'absolute',
    width: OBJECT,
    height: OBJECT,
    borderRadius: OBJECT / 2,
    backgroundColor: colors.player,
    borderWidth: 1,
    borderColor: colors.onPlayer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barrier: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.alarm,
    borderWidth: 1.5,
    borderColor: colors.newsPaper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crate: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CRATE,
    height: CRATE,
    backgroundColor: colors.player,
    borderWidth: 1,
    borderColor: colors.onPlayer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crateLabel: { position: 'absolute', left: 0, top: 0, width: 80, alignItems: 'center' },
  crateText: { fontFamily: fonts.newsHeavy, fontSize: 14, color: colors.player, textShadowColor: colors.bg, textShadowRadius: 3, paddingHorizontal: spacing.xs },
});
