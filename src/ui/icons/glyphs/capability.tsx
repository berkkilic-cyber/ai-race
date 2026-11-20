/**
 * Capability tree. The five model generations are one series: each carries the spark,
 * and the structure around it grows from a single typed line to a full orbit.
 */
import { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { spark } from '../shapes';
import type { GlyphProps } from '../types';

/** Gen 1, Autocomplete Deluxe: a text box with a typed line, a caret, a ghost completion and a sparkle. */
export function Model1({ a, w }: GlyphProps) {
  return (
    <>
      <Rect x={2.5} y={9.5} width={19} height={10} rx={2} />
      <Path d="M5.5 14.5h4M12 12v5" />
      <Path d="M14.75 14.5h.01M18 14.5h.01" stroke={a} strokeWidth={w * 1.3} />
      <Path d={spark(19, 4.5, 3.25)} fill={a} stroke="none" />
    </>
  );
}

/** Gen 2, Now With Reasoning: a thought bubble with the spark inside. */
export function Model2({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M8 15.5a3.5 3.5 0 0 1-.6-6.95A5 5 0 0 1 16.5 6.6 3.75 3.75 0 0 1 17.5 15.5Z" />
      <Circle cx={6} cy={18.75} r={1.4} fill={c} stroke="none" />
      <Circle cx={3.25} cy={21} r={1} fill={c} stroke="none" />
      <Path d={spark(12.75, 10.75, 3.25)} fill={a} stroke="none" />
    </>
  );
}

/** Gen 3, Multimodal: a circle, a square and a triangle around the spark. */
export function Model3({ a }: GlyphProps) {
  return (
    <>
      <Rect x={3.5} y={3.5} width={7} height={7} rx={1.5} />
      <Circle cx={17} cy={7} r={3.5} />
      <Path d="M7 13.5l3.75 7h-7.5Z" />
      <Path d={spark(17, 17, 4.25)} fill={a} stroke="none" />
    </>
  );
}

/** Gen 4, Agentic: a large spark acting through a pointer. */
export function Model4({ a }: GlyphProps) {
  return (
    <>
      <Path d={spark(9, 9, 6.5)} fill={a} stroke="none" />
      <Path d="M13 13 21 16l-3.5 1.5L16 21Z" />
      <Path d="M17.5 9.5l1-2M20.5 12.25l2-.75" />
    </>
  );
}

/** Gen 5, Frontier: the spark at the centre of two orbits. */
export function Model5({ c, a }: GlyphProps) {
  return (
    <>
      <Ellipse cx={12} cy={12} rx={10} ry={4.25} transform="rotate(-30 12 12)" />
      <Ellipse cx={12} cy={12} rx={10} ry={4.25} transform="rotate(30 12 12)" />
      <Path d={spark(12, 12, 5.25)} fill={a} stroke="none" />
      <Circle cx={20.66} cy={7} r={1.25} fill={c} stroke="none" />
    </>
  );
}

/** A graphics card: two fans, an edge connector. */
function GpuCard({ x, y, a }: { x: number; y: number; a: string }) {
  return (
    <>
      <Rect x={x} y={y} width={17} height={9} rx={1.5} />
      <Circle cx={x + 4.75} cy={y + 4.5} r={2.6} stroke={a} />
      <Circle cx={x + 12.25} cy={y + 4.5} r={2.6} stroke={a} />
      <Path d={`M${x + 4} ${y + 9}v2h7v-2`} />
    </>
  );
}

/** Rented GPUs: a graphics card with a rental tag tied to it. */
export function GpuLease({ c, a }: GlyphProps) {
  return (
    <>
      <GpuCard x={2.5} y={10} a={a} />
      <Path d="M14 6l2.5-3H21v6h-4.5Z" />
      <Circle cx={16.75} cy={6} r={0.9} fill={c} stroke="none" />
      <Path d="M14 6c-2.5 0-3.5 1.5-3.5 4" />
    </>
  );
}

/** GPU Megadeal: a stack of graphics cards. */
export function GpuMegadeal({ a }: GlyphProps) {
  return (
    <>
      <Path d="M7 3.5h13a1.5 1.5 0 0 1 1.5 1.5v6.5M5 6.5h13a1.5 1.5 0 0 1 1.5 1.5v1.5" />
      <GpuCard x={2.5} y={9.5} a={a} />
    </>
  );
}

/** Safety Team: a hard hat. */
export function SafetyTeam({ a }: GlyphProps) {
  return (
    <>
      <Path d="M4.5 16a7.5 7.5 0 0 1 15 0" />
      <Rect x={2.5} y={16} width={19} height={3.5} rx={1.75} />
      <Path d="M10.5 9v4.5M13.5 9v4.5" stroke={a} />
    </>
  );
}

/** Interpretability Lab: a magnifying glass over a small network. */
export function Interpretability({ c, a }: GlyphProps) {
  return (
    <>
      <Circle cx={10} cy={10} r={6.75} />
      <Path d="M15 15l5.5 5.5" />
      <Path d="M7.5 8.5h5M7.5 8.5l2.5 4M12.5 8.5l-2.5 4" stroke={a} />
      <Circle cx={7.5} cy={8.5} r={1.25} fill={c} stroke="none" />
      <Circle cx={12.5} cy={8.5} r={1.25} fill={c} stroke="none" />
      <Circle cx={10} cy={12.5} r={1.25} fill={c} stroke="none" />
    </>
  );
}

/** Custom Silicon: a wafer of dies, one picked out. */
export function OwnChips({ a }: GlyphProps) {
  return (
    <>
      <Path d="M8.08 20.1A9 9 0 1 1 15.92 20.1Z" />
      <Path d="M9 3.51V20.1M15 3.51V20.1M3.51 9H20.49M3.51 15H20.49" />
      <Rect x={10.25} y={10.25} width={3.5} height={3.5} rx={0.5} fill={a} stroke={a} />
    </>
  );
}

/** Alignment Moonshot: a dotted trajectory curving up to a crescent moon. */
export function Alignment({ a }: GlyphProps) {
  return (
    <>
      <Path d="M20.5 10A5.75 5.75 0 1 1 14 3.5a4.5 4.5 0 0 0 6.5 6.5Z" />
      <Path d="M3.5 20.5C4.5 16 7 13 10.5 12" strokeDasharray="0.01 3.25" stroke={a} />
      <Path d="M10 9.5l3 2.25-2.25 3" stroke={a} />
    </>
  );
}

/** Robotics Division: a robot arm with a gripper. */
export function Robotics({ a }: GlyphProps) {
  return (
    <>
      <Path d="M3.5 20.5h10M6 20.5v-1.75a2.5 2.5 0 0 1 5 0v1.75" />
      <Path d="M8.25 15.5 6.5 9.25M8.25 7.5l6.75-1.75" />
      <Circle cx={6.75} cy={7.5} r={1.9} stroke={a} />
      <Path d="M15 5.75l2.5-2.25h2.5M15 5.75l2.5 2.75h2.5" />
    </>
  );
}
