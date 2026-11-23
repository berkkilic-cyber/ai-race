import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { Icon } from '../icons';
import { allFinite, finiteOr } from '../map/svgSafe';
import { useAmbientClock, wave } from '../motion/ambient';
import { colors } from '../theme';

/**
 * The lab as a room: back wall, floor, the stage's furniture, desks with interns, racks
 * that blink and the big later purchases on a shelf. Drawn in px from the measured size;
 * counts arrive as small buckets so the node count stays low (about 60 SVG nodes at most)
 * and the drawing re-renders only when a bucket, the stage or the size changes. The LEDs
 * blink on the shared ambient clock in two alternating layers (no per-frame React work).
 */

export interface RoomBuckets {
  /** Desks with an intern (0..5). */
  desks: number;
  /** Server racks (0..8). */
  racks: number;
  /** Icons of the later tiers owned (at most five). */
  shelf: string[];
}

const DESK_STEPS = [1, 5, 15, 40, 80];
const RACK_STEPS = [1, 4, 10, 25, 50, 100, 200, 400];

function bucket(n: number, steps: number[]): number {
  let b = 0;
  for (const s of steps) if (n >= s) b += 1;
  return b;
}

/** Buckets from generator counts (ids from the content; unknown ids count nothing). */
export function roomBuckets(generators: Record<string, number>, deskIds: string[], rackIds: string[], shelf: { id: string; icon: string }[]): RoomBuckets {
  const sum = (ids: string[]) => ids.reduce((a, id) => a + (generators[id] ?? 0), 0);
  return { desks: bucket(sum(deskIds), DESK_STEPS), racks: bucket(sum(rackIds), RACK_STEPS), shelf: shelf.filter((g) => (generators[g.id] ?? 0) > 0).map((g) => g.icon).slice(0, 5) };
}

export const bucketKey = (b: RoomBuckets) => `${b.desks}|${b.racks}|${b.shelf.join(',')}`;

/** Where the floor starts, as a share of the height. */
const FLOOR = 0.6;

/** A happening's spot in the room, in px (centre). `jx`/`jy` (0..1) nudge it a little. */
export function spotPosition(spot: string, jx: number, jy: number, w: number, h: number): { x: number; y: number } {
  const j = (v: number) => (finiteOr(v, 0.5) - 0.5) * 0.08;
  const at = (x: number, y: number) => ({ x: (x + j(jx)) * w, y: (y + j(jy)) * h });
  switch (spot) {
    case 'door':
      return at(0.14, 0.5);
    case 'desk':
      return at(0.27, 0.74);
    case 'rack':
      return at(0.8, 0.5);
    default:
      return at(0.5, 0.35);
  }
}

interface Geometry {
  w: number;
  h: number;
  floor: number;
  rack: (i: number) => { x: number; y: number; rw: number; rh: number };
  desk: (i: number) => { x: number; y: number };
}

function geometry(w: number, h: number, scene: string): Geometry {
  const floor = h * FLOOR;
  const big = scene !== 'garage' && scene !== 'office';
  const rw = Math.max(10, Math.min(big ? 24 : 20, w * (big ? 0.05 : 0.042)));
  const rh = Math.max(30, Math.min(h * (big ? 0.44 : 0.32), big ? 120 : 84));
  return {
    w,
    h,
    floor,
    // Racks stand on the right: a front row on the floor, then a smaller back row behind it.
    rack: (i) => {
      const perRow = 4;
      const back = i >= perRow;
      const col = i % perRow;
      const scale = back ? 0.8 : 1;
      const x = w * (back ? 0.69 : 0.66) + col * (rw * scale + 4);
      const bottom = back ? floor - h * 0.02 : floor + h * 0.07;
      return { x, y: bottom - rh * scale, rw: rw * scale, rh: rh * scale };
    },
    // Desks along the left of the floor, staggered.
    desk: (i) => ({ x: w * 0.06 + (i % 3) * w * 0.11, y: floor + h * 0.06 + Math.floor(i / 3) * h * 0.14 + (i % 2) * h * 0.03 }),
  };
}

function rectPath(x: number, y: number, rw: number, rh: number): string {
  return allFinite(x, y, rw, rh) ? `M${x.toFixed(1)} ${y.toFixed(1)}h${rw.toFixed(1)}v${rh.toFixed(1)}h${(-rw).toFixed(1)}z` : '';
}

/** The stage's backdrop: what makes the garage a garage and the data centre a data centre. */
function Backdrop({ scene, g }: { scene: string; g: Geometry }) {
  const { w, h, floor } = g;
  const line = colors.border;
  switch (scene) {
    case 'garage': {
      // A roll-up door on the left wall, a bare bulb, a tool board.
      const dx = w * 0.04;
      const dw = w * 0.2;
      const dy = h * 0.14;
      const slats = Array.from({ length: 5 }, (_, i) => `M${dx} ${dy + ((floor - dy) * (i + 1)) / 6}h${dw}`).join('');
      return (
        <G>
          <Rect x={dx} y={dy} width={dw} height={floor - dy} fill={colors.raised} stroke={line} strokeWidth={1} />
          <Path d={slats} stroke={line} strokeWidth={1} />
          <Line x1={w * 0.45} y1={0} x2={w * 0.45} y2={h * 0.12} stroke={line} strokeWidth={1} />
          <Circle cx={w * 0.45} cy={h * 0.14} r={5} fill={colors.amber} opacity={0.85} />
          <Rect x={w * 0.3} y={h * 0.2} width={w * 0.18} height={h * 0.16} fill="none" stroke={line} strokeWidth={1} strokeDasharray="3 3" />
        </G>
      );
    }
    case 'office': {
      // Windows with a city view and a whiteboard nobody may erase.
      const win = (x: number) => (
        <G key={x}>
          <Rect x={x} y={h * 0.1} width={w * 0.1} height={h * 0.24} fill={colors.chrome} stroke={line} strokeWidth={1} />
          <Path d={`M${x + w * 0.05} ${h * 0.1}v${h * 0.24}M${x} ${h * 0.22}h${w * 0.1}`} stroke={line} strokeWidth={1} />
        </G>
      );
      return (
        <G>
          {win(w * 0.05)}
          {win(w * 0.17)}
          <Rect x={w * 0.32} y={h * 0.12} width={w * 0.2} height={h * 0.2} fill={colors.text} opacity={0.9} />
          <Path d={`M${w * 0.34} ${h * 0.2}q${w * 0.03} ${-h * 0.05} ${w * 0.06} 0t${w * 0.06} 0M${w * 0.35} ${h * 0.26}h${w * 0.1}`} stroke={colors.info} strokeWidth={1.5} fill="none" />
        </G>
      );
    }
    case 'datacentre': {
      // Raised floor tiles and a cold-aisle stripe; no windows.
      const tiles = Array.from({ length: 6 }, (_, i) => `M${(w * i) / 6} ${floor}L${w * 0.5 + (w * (i - 2.5)) / 3} ${h}`).join('') + `M0 ${floor + (h - floor) * 0.45}H${w}`;
      return (
        <G>
          <Path d={tiles} stroke={line} strokeWidth={1} opacity={0.7} />
          <Rect x={0} y={floor - 3} width={w} height={3} fill={colors.info} opacity={0.35} />
          <Rect x={w * 0.05} y={h * 0.12} width={w * 0.14} height={h * 0.08} fill="none" stroke={colors.info} strokeWidth={1} />
        </G>
      );
    }
    case 'town': {
      // A wide window onto the town you bought: rooftops and a water tower.
      const top = h * 0.08;
      const bottom = h * 0.4;
      const sky = `M${w * 0.04} ${bottom}V${bottom - h * 0.12}h${w * 0.05}v${-h * 0.08}h${w * 0.05}v${h * 0.05}h${w * 0.06}v${-h * 0.14}h${w * 0.04}v${h * 0.1}h${w * 0.07}v${-h * 0.06}h${w * 0.06}V${bottom}z`;
      return (
        <G>
          <Rect x={w * 0.03} y={top} width={w * 0.5} height={bottom - top} fill={colors.chrome} stroke={line} strokeWidth={1} />
          <Path d={sky} fill={colors.raised} stroke={line} strokeWidth={1} />
          <Circle cx={w * 0.45} cy={top + h * 0.1} r={h * 0.035} fill="none" stroke={colors.playerText} strokeWidth={1} />
          <Path d={`M${w * 0.43} ${top + h * 0.13}L${w * 0.42} ${bottom}M${w * 0.47} ${top + h * 0.13}L${w * 0.48} ${bottom}`} stroke={colors.playerText} strokeWidth={1} />
        </G>
      );
    }
    case 'latent': {
      // Inside the model: a lattice of nodes and a floor that runs off to infinity.
      const pts = [0.08, 0.2, 0.32, 0.44].flatMap((x, i) => [0.12, 0.26, 0.4].map((y) => [w * x, h * (y + (i % 2) * 0.05)] as const));
      const links = pts
        .map(([x, y], i) => {
          const next = pts[i + 3];
          return next ? `M${x} ${y}L${next[0]} ${next[1]}` : '';
        })
        .join('');
      const grid = Array.from({ length: 7 }, (_, i) => `M${(w * i) / 6} ${h}L${w * 0.5} ${floor}`).join('') + Array.from({ length: 3 }, (_, i) => `M0 ${floor + ((h - floor) * (i + 1)) / 4}H${w}`).join('');
      return (
        <G>
          <Path d={grid} stroke={colors.playerText} strokeWidth={0.75} opacity={0.35} />
          <Path d={links} stroke={colors.playerText} strokeWidth={0.75} opacity={0.5} />
          {pts.map(([x, y]) => (
            <Circle key={`${x}:${y}`} cx={x} cy={y} r={3} fill={colors.player} opacity={0.7} />
          ))}
        </G>
      );
    }
    default:
      return null;
  }
}

/** The static drawing: walls, floor, backdrop, desks with interns, rack bodies. */
const RoomDrawing = memo(function RoomDrawing({ scene, buckets, w, h }: { scene: string; buckets: RoomBuckets; w: number; h: number }) {
  const g = geometry(w, h, scene);
  const deskPath: string[] = [];
  const heads: { x: number; y: number }[] = [];
  for (let i = 0; i < buckets.desks; i++) {
    const d = g.desk(i);
    const dw = Math.max(26, w * 0.08);
    deskPath.push(rectPath(d.x, d.y, dw, 4), `M${(d.x + 3).toFixed(1)} ${(d.y + 4).toFixed(1)}v10M${(d.x + dw - 3).toFixed(1)} ${(d.y + 4).toFixed(1)}v10`, rectPath(d.x + dw * 0.45, d.y - 9, dw * 0.35, 8));
    heads.push({ x: d.x + dw * 0.2, y: d.y - 9 });
  }
  const racksFront: string[] = [];
  const racksBack: string[] = [];
  for (let i = 0; i < buckets.racks; i++) {
    const r = g.rack(i);
    (i >= 4 ? racksBack : racksFront).push(rectPath(r.x, r.y, r.rw, r.rh));
  }
  const rackLines: string[] = [];
  for (let i = 0; i < buckets.racks; i++) {
    const r = g.rack(i);
    for (let k = 1; k < 5; k++) rackLines.push(`M${(r.x + 2).toFixed(1)} ${(r.y + (r.rh * k) / 5).toFixed(1)}h${(r.rw - 4).toFixed(1)}`);
  }
  if (!allFinite(w, h) || w <= 0 || h <= 0) return null;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={w} height={g.floor} fill={colors.surface} />
      <Rect x={0} y={g.floor} width={w} height={h - g.floor} fill={colors.bg} />
      <Line x1={0} y1={g.floor} x2={w} y2={g.floor} stroke={colors.outline} strokeWidth={1} />
      <Backdrop scene={scene} g={g} />
      {racksBack.length ? <Path d={racksBack.join('')} fill={colors.raised} stroke={colors.border} strokeWidth={1} /> : null}
      {racksFront.length ? <Path d={racksFront.join('')} fill={colors.chrome} stroke={colors.outline} strokeWidth={1} /> : null}
      {rackLines.length ? <Path d={rackLines.join('')} stroke={colors.border} strokeWidth={1} /> : null}
      {deskPath.length ? <Path d={deskPath.join('')} fill={colors.raised} stroke={colors.outline} strokeWidth={1} /> : null}
      {heads.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={4.5} fill={colors.dim} />
      ))}
    </Svg>
  );
});

/** LED dots on the racks, as one path for each of two alternating sets. */
function ledPaths(g: Geometry, racks: number): [string, string] {
  const a: string[] = [];
  const b: string[] = [];
  for (let i = 0; i < racks; i++) {
    const r = g.rack(i);
    for (let k = 0; k < 5; k++) {
      const x = r.x + 3 + ((k * 3) % Math.max(1, r.rw - 6));
      const y = r.y + (r.rh * (k + 0.5)) / 5 - 1;
      ((i + k) % 2 ? a : b).push(rectPath(x, y, 2.5, 2.5));
    }
  }
  return [a.join(''), b.join('')];
}

const Leds = memo(function Leds({ w, h, racks, scene }: { w: number; h: number; racks: number; scene: string }) {
  const reduced = useReducedMotion();
  const clock = useAmbientClock(!reduced && racks > 0);
  const [a, b] = ledPaths(geometry(w, h, scene), racks);
  const styleA = useAnimatedStyle(() => ({ opacity: clock ? 0.35 + 0.65 * Math.max(0, wave(clock.get(), 1.3)) : 1 }));
  const styleB = useAnimatedStyle(() => ({ opacity: clock ? 0.35 + 0.65 * Math.max(0, -wave(clock.get(), 1.7)) : 0.6 }));
  if (racks === 0 || !a || !allFinite(w, h)) return null;
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styleA]} pointerEvents="none">
        <Svg width={w} height={h}>
          <Path d={a} fill={colors.player} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styleB]} pointerEvents="none">
        <Svg width={w} height={h}>{b ? <Path d={b} fill={colors.info} /> : null}</Svg>
      </Animated.View>
    </>
  );
});

/** The later purchases on a shelf at the top right of the back wall. */
const Shelf = memo(function Shelf({ icons, w, h }: { icons: string[]; w: number; h: number }) {
  if (icons.length === 0) return null;
  const size = Math.max(16, Math.min(24, h * 0.07));
  return (
    <View style={[styles.shelf, { bottom: h * 0.05, right: w * 0.03 }]} pointerEvents="none">
      {icons.map((name) => (
        <View key={name} style={styles.shelfItem}>
          <Icon name={name} size={size} color={colors.text} accent={colors.player} />
        </View>
      ))}
    </View>
  );
});

/** The whole room behind the stage's controls. */
export const LabRoom = memo(function LabRoom({ scene, buckets, w, h }: { scene: string; buckets: RoomBuckets; w: number; h: number }) {
  if (!(w > 0 && h > 0)) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID={`garage-room-${scene}`}>
      <RoomDrawing scene={scene} buckets={buckets} w={w} h={h} />
      <Leds w={w} h={h} racks={buckets.racks} scene={scene} />
      <Shelf icons={buckets.shelf} w={w} h={h} />
    </View>
  );
});

const styles = StyleSheet.create({
  shelf: { position: 'absolute', flexDirection: 'row', gap: 4, borderBottomWidth: 2, borderColor: colors.outline, paddingHorizontal: 4, paddingBottom: 2 },
  shelfItem: { alignItems: 'center', justifyContent: 'center' },
});
