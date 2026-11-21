/** Reach tree: getting the product in front of people. */
import { Circle, Path, Rect } from 'react-native-svg';

import { arc } from '../shapes';
import type { GlyphProps } from '../types';

/** Chat App: a phone with a chat bubble on screen. */
export function ReachApp({ a }: GlyphProps) {
  return (
    <>
      <Rect x={6} y={2.5} width={12} height={19} rx={2.5} />
      <Path d="M10.5 18.5h3" />
      <Path d="M9.5 8h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-2.5l-2 1.75V13h-.5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke={a} />
    </>
  );
}

/** Developer API: code brackets around a slash. */
export function ReachApi({ a }: GlyphProps) {
  return (
    <>
      <Path d="M8 6.5 3 12l5 5.5M16 6.5l5 5.5-5 5.5" />
      <Path d="M13.5 5 10.5 19" stroke={a} />
    </>
  );
}

/** Social Media Team: a speech bubble with a heart in it. */
export function ReachSocial({ a }: GlyphProps) {
  return (
    <>
      <Path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5v-8A2.5 2.5 0 0 1 6.5 4Z" />
      <Path
        d="M12 14c-2.6-1.6-3.75-3-3.75-4.4 0-1.05.85-1.85 1.85-1.85.8 0 1.45.4 1.9 1.05.45-.65 1.1-1.05 1.9-1.05 1 0 1.85.8 1.85 1.85 0 1.4-1.15 2.8-3.75 4.4Z"
        fill={a}
        stroke={a}
        strokeWidth={1}
      />
    </>
  );
}

/** Localisation: Español: two speech bubbles, the front one with a tilde. */
export function LocSpanish({ a }: GlyphProps) {
  return (
    <>
      <Path d="M14 6.5v-1A2 2 0 0 0 12 3.5H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h.5V15l3-2.5" />
      <Path d="M11 8.5h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.5v2.75L15.5 17.5H11a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" />
      <Path d="M12.25 13.4c.9-1.1 1.85-1.1 2.75 0s1.85 1.1 2.75 0" stroke={a} />
    </>
  );
}

/** Localisation: Asia & Africa: a globe with a speech bubble. */
export function LocAsia({ c, a }: GlyphProps) {
  return (
    <>
      <Circle cx={9.25} cy={14.25} r={6.75} />
      <Path d="M2.5 14.25h13.5M9.25 7.5a3 6.75 0 0 0 0 13.5M9.25 7.5a3 6.75 0 0 1 0 13.5" />
      <Path d="M15.5 2.5h5A1.5 1.5 0 0 1 22 4v3.5A1.5 1.5 0 0 1 20.5 9h-3l-2 1.75V9A1.5 1.5 0 0 1 14 7.5V4a1.5 1.5 0 0 1 1.5-1.5Z" stroke={a} />
      <Circle cx={16.5} cy={5.75} r={0.7} fill={c} stroke="none" />
      <Circle cx={19.5} cy={5.75} r={0.7} fill={c} stroke="none" />
    </>
  );
}

/** Enterprise Sales: a briefcase. */
export function ReachEnterprise({ a }: GlyphProps) {
  return (
    <>
      <Rect x={3} y={7.5} width={18} height={12.5} rx={2} />
      <Path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2" />
      <Path d="M3 12.5h7.5M13.5 12.5H21" />
      <Rect x={10.5} y={11} width={3} height={3} rx={0.75} fill={a} stroke={a} />
    </>
  );
}

/** Media Partnerships: a television with rabbit-ear antennas. */
export function ReachMedia({ a }: GlyphProps) {
  return (
    <>
      <Rect x={3} y={8} width={18} height={12.5} rx={2} />
      <Path d="M8 3.5 12 8l4-4.5" />
      <Path d="M10.5 11.5v5.5l4.5-2.75Z" fill={a} stroke={a} />
    </>
  );
}

const ringGap = 24;
/** Strategic Partnerships: two linked rings. */
export function ReachPartnerships({ a }: GlyphProps) {
  return (
    <>
      <Path d={arc(8.75, 12, 5.75, 56 + ringGap, 56 - ringGap)} />
      <Path d={arc(15.25, 12, 5.75, 236 + ringGap, 236 - ringGap)} stroke={a} />
    </>
  );
}

/** Crisis PR Firm: a fire extinguisher. */
export function ReachPr({ a }: GlyphProps) {
  return (
    <>
      <Rect x={7.5} y={9} width={7} height={12} rx={2.5} />
      <Path d="M9.5 9V6.5h3V9M8 4.75h5.5M12.5 6.5H16l3.5 3.5" />
      <Path d="M7.5 13.5h7" stroke={a} />
      <Path d="M20 13v.01M21.5 11.5v.01" stroke={a} />
    </>
  );
}

/** Compliance Office: a clipboard of ticked items. */
export function ReachCompliance({ a }: GlyphProps) {
  return (
    <>
      <Path d="M8.5 4H7a2 2 0 0 0-2 2v13.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.5" />
      <Rect x={8.5} y={2.5} width={7} height={3.5} rx={1} />
      <Path d="M8 11l1.5 1.5 2.5-3M8 16.5 9.5 18l2.5-3" stroke={a} />
      <Path d="M14 11h2M14 16.5h2" />
    </>
  );
}

/** Government Contracts: a building with columns. */
export function ReachGovernment({ a }: GlyphProps) {
  return (
    <>
      <Path d="M2.5 9h19L12 3.5Z" />
      <Path d="M5.5 11.5v6M9.75 11.5v6M14.25 11.5v6M18.5 11.5v6M3.5 20.5h17" />
      <Circle cx={12} cy={6.85} r={1} fill={a} stroke="none" />
    </>
  );
}

/** The Everything App: a phone full of app tiles. */
export function ReachSuperapp({ c, a }: GlyphProps) {
  const tiles = [] as { x: number; y: number }[];
  for (const y of [6, 9.5, 13]) for (const x of [8, 11, 14]) tiles.push({ x, y });
  return (
    <>
      <Rect x={5.5} y={2.5} width={13} height={19} rx={2.5} />
      {tiles.map((t, i) => (
        <Rect key={i} x={t.x} y={t.y} width={2} height={2} rx={0.4} fill={i === 4 ? a : c} stroke="none" />
      ))}
      <Path d="M10.5 18.5h3" />
    </>
  );
}
