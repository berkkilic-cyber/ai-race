/** Channels: the ways the lab spreads from one region to the next. */
import { Circle, Path, Rect } from 'react-native-svg';

import { spark } from '../shapes';
import type { GlyphProps } from '../types';

/** Ocean: a small ship riding the waves. */
export function Ocean({ a }: GlyphProps) {
  return (
    <>
      <Path d="M4 13.5h16l-2.25 3.75H6.25Z" />
      <Path d="M8 13.5V9.5h6v4M10.5 9.5V6.5h1.5" />
      <Path d="M2.5 20.5c1.6 0 1.6-1.25 3.2-1.25s1.6 1.25 3.2 1.25 1.6-1.25 3.1-1.25 1.6 1.25 3.2 1.25 1.6-1.25 3.2-1.25 1.6 1.25 3.1 1.25" stroke={a} />
    </>
  );
}

/** Language: two speech bubbles, one with dots, the other with a wavy line. */
export function Language({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M4.5 3h8A1.5 1.5 0 0 1 14 4.5v5A1.5 1.5 0 0 1 12.5 11H8l-3 2.5V11h-.5A1.5 1.5 0 0 1 3 9.5v-5A1.5 1.5 0 0 1 4.5 3Z" />
      <Circle cx={6.25} cy={7} r={0.9} fill={c} stroke="none" />
      <Circle cx={8.5} cy={7} r={0.9} fill={c} stroke="none" />
      <Circle cx={10.75} cy={7} r={0.9} fill={c} stroke="none" />
      <Path d="M11.5 10.5h8A1.5 1.5 0 0 1 21 12v5a1.5 1.5 0 0 1-1.5 1.5H19V21l-3-2.5h-4.5A1.5 1.5 0 0 1 10 17v-5a1.5 1.5 0 0 1 1.5-1.5Z" stroke={a} />
      <Path d="M12.75 14.75c.9-1 1.8-1 2.75 0s1.85 1 2.75 0" stroke={a} />
    </>
  );
}

/** Strict: a permit sheet with a round approval stamp. */
export function Strict({ a }: GlyphProps) {
  return (
    <>
      <Path d="M17 10V4.5A1.5 1.5 0 0 0 15.5 3h-10A1.5 1.5 0 0 0 4 4.5v15A1.5 1.5 0 0 0 5.5 21H10" />
      <Path d="M7 7.5h7M7 11h5M7 14.5h2.5" />
      <Circle cx={16.25} cy={16.25} r={4.75} stroke={a} />
      <Path d="M14.25 16.4l1.4 1.4 2.6-2.9" stroke={a} />
    </>
  );
}

/** Viral: one share arrow forking into three. */
export function Viral({ c, a }: GlyphProps) {
  return (
    <>
      <Circle cx={5} cy={12} r={2.25} fill={c} stroke="none" />
      <Path d="M7 12h3.5M10.5 12C13 12 14 6 18 6M10.5 12C13 12 14 18 18 18M10.5 12H18" />
      <Path d="M16.5 3.75 19 6l-2.5 2.25M16.5 9.75 19 12l-2.5 2.25M16.5 15.75 19 18l-2.5 2.25" stroke={a} />
    </>
  );
}

/** Open: an unlocked padlock with a spark beside it. */
export function Open({ a }: GlyphProps) {
  return (
    <>
      <Path d="M7 11.5V7.5a3.75 3.75 0 0 1 7.25-1.4" />
      <Rect x={3.5} y={11.5} width={13} height={9.5} rx={2} />
      <Path d="M10 15v2.5" />
      <Path d={spark(19, 6, 3.25)} fill={a} stroke="none" />
    </>
  );
}
