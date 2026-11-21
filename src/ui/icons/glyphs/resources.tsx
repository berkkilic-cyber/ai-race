/** Resources and stats: what the top strip and meters show. */
import { Circle, Path, Rect } from 'react-native-svg';

import { spark } from '../shapes';
import type { GlyphProps } from '../types';

/** Megaphone with two sound waves. */
export function Hype({ a }: GlyphProps) {
  return (
    <>
      <Path d="M3 10.5v3A1.5 1.5 0 0 0 4.5 15H7l7 4V5L7 9H4.5A1.5 1.5 0 0 0 3 10.5Z" />
      <Path d="M7 15l1.5 4.5" />
      <Path d="M17.5 9.5a3.5 3.5 0 0 1 0 5M19.75 7a7 7 0 0 1 0 10" stroke={a} />
    </>
  );
}

/** A banknote on top of a second one. */
export function Cash({ a }: GlyphProps) {
  return (
    <>
      <Path d="M6 6h13.5a2 2 0 0 1 2 2v8" />
      <Rect x={2.5} y={9} width={16} height={10} rx={2} />
      <Circle cx={10.5} cy={14} r={2.4} stroke={a} />
    </>
  );
}

/** A server rack: three units, each with a status light. */
export function Compute({ a }: GlyphProps) {
  return (
    <>
      <Rect x={4.5} y={3} width={15} height={18} rx={2} />
      <Path d="M4.5 9h15M4.5 15h15M12 6h4.5M12 12h4.5M12 18h4.5" />
      <Circle cx={8} cy={6} r={1.15} fill={a} stroke="none" />
      <Circle cx={8} cy={12} r={1.15} fill={a} stroke="none" />
      <Circle cx={8} cy={18} r={1.15} fill={a} stroke="none" />
    </>
  );
}

/** Stacked layers with a spark above them. */
export function ModelTier({ a }: GlyphProps) {
  return (
    <>
      <Path d="M11 6l7.5 3.5L11 13 3.5 9.5Z" />
      <Path d="M3.5 13.25 11 16.75l7.5-3.5M3.5 17 11 20.5l7.5-3.5" />
      <Path d={spark(19, 4.5, 3)} fill={a} stroke="none" />
    </>
  );
}

/** Two people, one in front of the other. */
export function Users({ a }: GlyphProps) {
  return (
    <>
      <Circle cx={9} cy={8} r={3.25} />
      <Path d="M2.75 19.5a6.25 6.25 0 0 1 12.5 0" />
      <Path d="M15.25 4.9a3.1 3.1 0 0 1 0 6.2M17.5 13.75a5.75 5.75 0 0 1 3.75 5.75" stroke={a} />
    </>
  );
}

/** A low, wide hall on the ground: a cooling unit on the roof, rows of server slots with lights. */
export function DataCentre({ a }: GlyphProps) {
  return (
    <>
      <Path d="M1.5 20.5h21" />
      <Path d="M3 20.5V10.5A1.5 1.5 0 0 1 4.5 9h15a1.5 1.5 0 0 1 1.5 1.5v10" />
      <Path d="M13 9V6.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V9" />
      <Path d="M9.5 13h8M9.5 16.75h8" />
      <Circle cx={6.5} cy={13} r={1.1} fill={a} stroke="none" />
      <Circle cx={6.5} cy={16.75} r={1.1} fill={a} stroke="none" />
    </>
  );
}

/** A gavel striking its block. */
export function Regulation({ a }: GlyphProps) {
  return (
    <>
      <Rect x={8.25} y={3} width={8.5} height={5} rx={1.25} transform="rotate(45 12 12)" />
      <Path d="M12.5 8v10" transform="rotate(45 12 12)" />
      <Rect x={13.5} y={17.75} width={8} height={2.75} rx={1} stroke={a} />
    </>
  );
}

/** An angry crowd: two people with a pitchfork raised between them. */
export function Backlash({ a }: GlyphProps) {
  return (
    <>
      <Circle cx={5.75} cy={11.5} r={2.5} />
      <Circle cx={18.25} cy={11.5} r={2.5} />
      <Path d="M1.5 20.5a4.25 4.25 0 0 1 8.5 0M14 20.5a4.25 4.25 0 0 1 8.5 0" />
      <Path d="M12 21V8M9 3v5h6V3M12 8V3" stroke={a} />
    </>
  );
}

/** A chequered racing flag over a mind (a node with a spark). */
export function RivalAgi({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M5 21V3" />
      <Rect x={5} y={3} width={14} height={8} rx={0.75} />
      <Rect x={5} y={3} width={7} height={4} fill={c} stroke="none" />
      <Rect x={12} y={7} width={7} height={4} fill={c} stroke="none" />
      <Circle cx={15.5} cy={17.25} r={3.75} stroke={a} />
      <Path d={spark(15.5, 17.25, 2)} fill={a} stroke="none" />
    </>
  );
}

/** A globe with one quarter pulled out. */
export function WorldShare({ a }: GlyphProps) {
  return (
    <>
      <Path d="M11 13V5A8 8 0 1 0 19 13Z" />
      <Path d="M3 13h8M11 5a3.5 8 0 0 0 0 16M11 21a3.5 8 0 0 0 3.5-8" />
      <Path d="M12.75 11.25V3.25A8 8 0 0 1 20.75 11.25Z" fill={a} stroke={a} />
    </>
  );
}
