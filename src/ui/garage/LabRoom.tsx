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
 * counts arrive as small buckets so the node count stays low (about 60 SVG nodes at most;
 * a test counts them) and the HUD sits on a ceiling band above the wall, so no furniture
 * shows behind it;
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
const FLOOR = 0.64;

/** A happening's spot in the room, in px (centre). `jx`/`jy` (0..1) nudge it a little. */
export function spotPosition(spot: string, jx: number, jy: number, w: number, h: number): { x: number; y: number } {
  const j = (v: number) => (finiteOr(v, 0.5) - 0.5) * 0.06;
  const at = (x: number, y: number) => ({ x: (x + j(jx)) * w, y: (y + j(jy)) * h });
  switch (spot) {
    case 'door':
      return at(0.14, 0.52);
    case 'desk':
      return at(0.2, 0.76);
    case 'rack':
      // On the floor in front of the racks, so its label never sits across them.
      return at(0.85, 0.79);
    default:
      return at(0.5, 0.35);
  }
}

/** A rectangle in the stage, in px (the tap target's outer ring, for the bubbles to keep clear of). */
export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The horizontal span a bubble at `x` may use without crossing the tap target: the side of
 * the stage it is on (with a small gap), or the whole width when it is above or below it.
 */
export function clearSpan(x: number, w: number, avoid: StageRect | null, gap = 4): { lo: number; hi: number } {
  if (!avoid || !allFinite(avoid.x, avoid.w)) return { lo: 2, hi: w - 2 };
  if (x < avoid.x) return { lo: 2, hi: Math.max(2, avoid.x - gap) };
  if (x > avoid.x + avoid.w) return { lo: Math.min(w - 2, avoid.x + avoid.w + gap), hi: w - 2 };
  return { lo: 2, hi: w - 2 };
}

/** Whether two rectangles overlap. */
export function overlaps(a: StageRect, b: StageRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

interface Geometry {
  w: number;
  h: number;
  /** The wall starts here: above it is the ceiling band the HUD sits on. */
  top: number;
  floor: number;
  rack: (i: number) => { x: number; y: number; rw: number; rh: number };
  desk: (i: number) => { x: number; y: number };
}

function geometry(w: number, h: number, scene: string, ceiling: number): Geometry {
  const floor = h * FLOOR;
  const top = Math.min(floor - 30, Math.max(h * 0.1, finiteOr(ceiling, 0) + 4));
  const big = scene !== 'garage' && scene !== 'office';
  const rw = Math.max(10, Math.min(big ? 24 : 20, w * (big ? 0.05 : 0.042)));
  // Racks stand on the floor and never reach into the ceiling band.
  const frontBottom = floor + h * 0.07;
  const rh = Math.max(24, Math.min(h * (big ? 0.44 : 0.32), big ? 120 : 84, frontBottom - top - 14));
  return {
    w,
    h,
    top,
    floor,
    // Racks stand on the right: a front row on the floor, then a smaller back row behind it.
    rack: (i) => {
      const perRow = 4;
      const back = i >= perRow;
      const col = i % perRow;
      const scale = back ? 0.8 : 1;
      const x = w * (back ? 0.69 : 0.66) + col * (rw * scale + 4);
      const bottom = back ? floor - h * 0.02 : frontBottom;
      return { x, y: bottom - rh * scale, rw: rw * scale, rh: rh * scale };
    },
    // Desks along the left of the floor, staggered.
    desk: (i) => ({ x: w * 0.04 + (i % 3) * w * 0.1, y: floor + h * 0.07 + Math.floor(i / 3) * h * 0.13 + (i % 2) * h * 0.025 }),
  };
}

function rectPath(x: number, y: number, rw: number, rh: number): string {
  return allFinite(x, y, rw, rh) ? `M${x.toFixed(1)} ${y.toFixed(1)}h${rw.toFixed(1)}v${rh.toFixed(1)}h${(-rw).toFixed(1)}z` : '';
}

const n1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '0');

/**
 * The stage's backdrop: what makes the garage a garage and the data centre a data centre.
 * Everything sits on the visible wall (between the ceiling band and the floor) at the left,
 * where the model and the racks do not cover it, or on the floor.
 */
function Backdrop({ scene, g }: { scene: string; g: Geometry }) {
  const { w, h, floor, top } = g;
  const line = colors.border;
  const wall = floor - top;
  switch (scene) {
    case 'garage': {
      // A roll-up door on the left wall, a bare bulb hanging from the ceiling, moving boxes, an oil stain.
      const dx = w * 0.03;
      const dw = w * 0.22;
      const dy = top + wall * 0.08;
      const dh = floor - dy;
      const slats = Array.from({ length: 5 }, (_, i) => `M${n1(dx)} ${n1(dy + (dh * (i + 1)) / 6)}h${n1(dw)}`).join('');
      const bx = w * 0.7;
      const by = top + wall * 0.28;
      const box = (x: number, y: number, s: number) => `M${n1(x)} ${n1(y)}h${n1(s)}v${n1(-s * 0.8)}h${n1(-s)}z`;
      const bs = Math.max(12, w * 0.06);
      return (
        <G>
          <Rect x={dx} y={dy} width={dw} height={dh} fill={colors.raised} stroke={line} strokeWidth={1} />
          <Path d={`${slats}M${n1(dx + dw / 2 - 6)} ${n1(floor - dh / 6 + 3)}h12`} stroke={colors.outline} strokeWidth={1} />
          <Line x1={bx} y1={0} x2={bx} y2={by} stroke={line} strokeWidth={1} />
          <Circle cx={bx} cy={by + 4} r={14} fill={colors.amber} opacity={0.12} />
          <Circle cx={bx} cy={by + 4} r={4.5} fill={colors.amber} opacity={0.9} />
          <Path d={`${box(w * 0.82, floor + h * 0.05, bs * 1.2)}${box(w * 0.82 + bs * 1.25, floor + h * 0.05, bs)}${box(w * 0.82 + bs * 0.3, floor + h * 0.05 - bs * 0.96, bs)}`} fill={colors.chrome} stroke={line} strokeWidth={1} />
          <Path d={`M${n1(w * 0.55)} ${n1(floor + (h - floor) * 0.62)}a${n1(w * 0.07)} ${n1((h - floor) * 0.06)} 0 1 0 0.1 0z`} fill={colors.raised} opacity={0.7} />
        </G>
      );
    }
    case 'office': {
      // Two windows with a skyline and a whiteboard nobody may erase.
      const wy = top + wall * 0.12;
      const wh = wall * 0.5;
      const ww = w * 0.1;
      const win = (x: number) => (
        <G key={x}>
          <Rect x={x} y={wy} width={ww} height={wh} fill={colors.chrome} stroke={line} strokeWidth={1} />
          <Path d={`M${n1(x)} ${n1(wy + wh)}v${n1(-wh * 0.3)}h${n1(ww * 0.3)}v${n1(-wh * 0.2)}h${n1(ww * 0.3)}v${n1(wh * 0.12)}h${n1(ww * 0.4)}V${n1(wy + wh)}z`} fill={colors.raised} />
          <Path d={`M${n1(x + ww / 2)} ${n1(wy)}v${n1(wh)}`} stroke={line} strokeWidth={1} />
        </G>
      );
      const bx = w * 0.04;
      const by = wy + wh + wall * 0.08;
      const bw = w * 0.22;
      const bh = Math.max(10, floor - by - wall * 0.06);
      return (
        <G>
          {win(w * 0.04)}
          {win(w * 0.16)}
          {bh > 14 ? (
            <G>
              <Rect x={bx} y={by} width={bw} height={bh} fill={colors.text} opacity={0.88} />
              <Path d={`M${n1(bx + 4)} ${n1(by + bh * 0.55)}q${n1(bw * 0.12)} ${n1(-bh * 0.5)} ${n1(bw * 0.25)} 0t${n1(bw * 0.25)} 0M${n1(bx + bw * 0.62)} ${n1(by + bh * 0.35)}h${n1(bw * 0.3)}M${n1(bx + bw * 0.62)} ${n1(by + bh * 0.65)}h${n1(bw * 0.22)}`} stroke={colors.info} strokeWidth={1.5} fill="none" />
            </G>
          ) : null}
        </G>
      );
    }
    case 'datacentre': {
      // Raised floor tiles, a cold-aisle stripe, a lit status panel and a cable tray along the ceiling.
      const tiles = Array.from({ length: 6 }, (_, i) => `M${n1((w * i) / 6)} ${n1(floor)}L${n1(w * 0.5 + (w * (i - 2.5)) / 3)} ${n1(h)}`).join('') + `M0 ${n1(floor + (h - floor) * 0.45)}H${n1(w)}`;
      const px = w * 0.04;
      const py = top + wall * 0.18;
      const pw = w * 0.2;
      const ph = wall * 0.42;
      return (
        <G>
          <Path d={tiles} stroke={line} strokeWidth={1} opacity={0.7} />
          <Rect x={0} y={floor - 3} width={w} height={3} fill={colors.info} opacity={0.35} />
          <Path d={`M0 ${n1(top + 5)}H${n1(w)}M0 ${n1(top + 9)}H${n1(w)}`} stroke={line} strokeWidth={1} />
          <Rect x={px} y={py} width={pw} height={ph} fill={colors.chrome} stroke={colors.info} strokeWidth={1} />
          <Path d={`M${n1(px + 5)} ${n1(py + ph * 0.7)}l${n1(pw * 0.2)} ${n1(-ph * 0.3)}l${n1(pw * 0.2)} ${n1(ph * 0.15)}l${n1(pw * 0.2)} ${n1(-ph * 0.35)}l${n1(pw * 0.25)} ${n1(ph * 0.1)}`} stroke={colors.good} strokeWidth={1.5} fill="none" />
        </G>
      );
    }
    case 'town': {
      // A wide window onto the town you bought: rooftops, a water tower and the mayor's chatbot billboard.
      const x0 = w * 0.03;
      const x1 = w * 0.27;
      const y0 = top + wall * 0.08;
      const y1 = floor - wall * 0.08;
      const fw = x1 - x0;
      const fh = y1 - y0;
      const sky = `M${n1(x0)} ${n1(y1)}V${n1(y1 - fh * 0.3)}h${n1(fw * 0.14)}v${n1(-fh * 0.18)}h${n1(fw * 0.14)}v${n1(fh * 0.1)}h${n1(fw * 0.16)}v${n1(-fh * 0.28)}h${n1(fw * 0.12)}v${n1(fh * 0.22)}h${n1(fw * 0.2)}v${n1(-fh * 0.12)}H${n1(x1)}V${n1(y1)}z`;
      const tx = x0 + fw * 0.8;
      return (
        <G>
          <Rect x={x0} y={y0} width={fw} height={fh} fill={colors.chrome} stroke={line} strokeWidth={1} />
          <Path d={sky} fill={colors.raised} />
          <Circle cx={tx} cy={y0 + fh * 0.28} r={Math.max(3, fh * 0.1)} fill="none" stroke={colors.playerText} strokeWidth={1} />
          <Path d={`M${n1(tx - 3)} ${n1(y0 + fh * 0.36)}L${n1(tx - 5)} ${n1(y1 - fh * 0.15)}M${n1(tx + 3)} ${n1(y0 + fh * 0.36)}L${n1(tx + 5)} ${n1(y1 - fh * 0.15)}`} stroke={colors.playerText} strokeWidth={1} />
          <Rect x={x0 + fw * 0.1} y={y0 + fh * 0.12} width={fw * 0.36} height={fh * 0.2} fill={colors.player} opacity={0.75} />
          <Path d={`M${n1(x0 + fw * 0.5)} ${n1(y0)}v${n1(fh)}`} stroke={line} strokeWidth={1} />
          <Path d={`M${n1(w * 0.3)} ${n1(floor)}l${n1(w * 0.02)} -18l${n1(w * 0.02)} 18`} stroke={line} strokeWidth={1} fill="none" />
        </G>
      );
    }
    case 'latent': {
      // Inside the model: a lattice of nodes on the wall and a floor that runs off to infinity.
      const xs = [0.04, 0.12, 0.2, 0.28];
      const pts = xs.flatMap((x, i) => [0.2, 0.5, 0.8].map((y) => [w * x, top + wall * (y + (i % 2) * 0.08 - 0.04)] as const));
      const links = pts
        .map(([x, y], i) => {
          const next = pts[i + 3];
          const diag = pts[i + 4];
          return (next ? `M${n1(x)} ${n1(y)}L${n1(next[0])} ${n1(next[1])}` : '') + (diag && i % 3 !== 2 ? `M${n1(x)} ${n1(y)}L${n1(diag[0])} ${n1(diag[1])}` : '');
        })
        .join('');
      const grid = Array.from({ length: 7 }, (_, i) => `M${n1((w * i) / 6)} ${n1(h)}L${n1(w * 0.5)} ${n1(floor)}`).join('') + Array.from({ length: 3 }, (_, i) => `M0 ${n1(floor + ((h - floor) * (i + 1)) / 4)}H${n1(w)}`).join('');
      const nodes = pts.map(([x, y]) => `M${n1(x - 3)} ${n1(y)}a3 3 0 1 0 6 0a3 3 0 1 0 -6 0`).join('');
      return (
        <G>
          <Path d={grid} stroke={colors.playerText} strokeWidth={0.75} opacity={0.35} />
          <Path d={links} stroke={colors.playerText} strokeWidth={0.75} opacity={0.5} />
          <Path d={nodes} fill={colors.player} opacity={0.75} />
        </G>
      );
    }
    default:
      return null;
  }
}

/** The static drawing: walls, floor, backdrop, desks with interns, rack bodies. */
export const RoomDrawing = memo(function RoomDrawing({ scene, buckets, w, h, ceiling }: { scene: string; buckets: RoomBuckets; w: number; h: number; ceiling: number }) {
  const g = geometry(w, h, scene, ceiling);
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
      <Rect x={0} y={0} width={w} height={g.top} fill={colors.chrome} />
      <Rect x={0} y={g.top} width={w} height={g.floor - g.top} fill={colors.surface} />
      <Rect x={0} y={g.floor} width={w} height={h - g.floor} fill={colors.bg} />
      <Path d={`M0 ${n1(g.top)}H${n1(w)}M0 ${n1(g.floor)}H${n1(w)}`} stroke={colors.outline} strokeWidth={1} />
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

const Leds = memo(function Leds({ w, h, racks, scene, ceiling }: { w: number; h: number; racks: number; scene: string; ceiling: number }) {
  const reduced = useReducedMotion();
  const clock = useAmbientClock(!reduced && racks > 0);
  const [a, b] = ledPaths(geometry(w, h, scene, ceiling), racks);
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
export const LabRoom = memo(function LabRoom({ scene, buckets, w, h, ceiling = 0 }: { scene: string; buckets: RoomBuckets; w: number; h: number; ceiling?: number }) {
  if (!(w > 0 && h > 0)) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID={`garage-room-${scene}`}>
      <RoomDrawing scene={scene} buckets={buckets} w={w} h={h} ceiling={ceiling} />
      <Leds w={w} h={h} racks={buckets.racks} scene={scene} ceiling={ceiling} />
      <Shelf icons={buckets.shelf} w={w} h={h} />
    </View>
  );
});

const styles = StyleSheet.create({
  shelf: { position: 'absolute', flexDirection: 'row', gap: 4, borderBottomWidth: 2, borderColor: colors.outline, paddingHorizontal: 4, paddingBottom: 2 },
  shelfItem: { alignItems: 'center', justifyContent: 'center' },
});
