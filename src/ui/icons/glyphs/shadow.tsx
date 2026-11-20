/** Shadow tree: the things a lab does when nobody is looking. Each is a small visual joke. */
import { Circle, Path, Rect } from 'react-native-svg';

import { arc, star } from '../shapes';
import type { GlyphProps } from '../types';

/** Benchmark Tuning: a bar chart whose best bar has an extra block propped on top. */
export function Benchmarks({ a }: GlyphProps) {
  return (
    <>
      <Path d="M2.5 20.5h19" />
      <Rect x={4.5} y={14.5} width={3.5} height={6} rx={0.75} />
      <Rect x={10.25} y={11.5} width={3.5} height={9} rx={0.75} />
      <Rect x={16} y={10} width={3.5} height={10.5} rx={0.75} />
      <Rect x={16} y={3} width={3.5} height={4.25} rx={0.75} fill={a} stroke={a} />
    </>
  );
}

/** Lobbying Office: a column with a briefcase leaning on it. */
export function Lobbying({ a }: GlyphProps) {
  return (
    <>
      <Path d="M3 3.5h10M4 6h8M5.5 6v12M10.5 6v12M8 6v12M4 18h8M3 20.5h10" />
      <Rect x={14.5} y={14} width={7} height={6.5} rx={1.25} stroke={a} />
      <Path d="M16.5 14v-1.75h3V14" stroke={a} />
    </>
  );
}

/** Grassroots Fans (Paid): a tuft of grass with a price tag hanging off it. */
export function Astroturf({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M3 20.5h12" />
      <Path d="M9 20.5V9M9 20.5c0-3.5-1.5-6.5-4.5-8M9 20.5c0-3.5 1.5-6.5 4.5-8" />
      <Path d="M15 3h5a1 1 0 0 1 1 1v5.5L17.5 13 14 9.5V4a1 1 0 0 1 1-1Z" stroke={a} />
      <Circle cx={17.5} cy={6.25} r={1} fill={c} stroke="none" />
    </>
  );
}

/** Talent Poaching: a fishing hook with a star dangling from it. */
export function Poaching({ a }: GlyphProps) {
  return (
    <>
      <Path d="M14.5 2.5v10a4.5 4.5 0 0 1-9 0V10l2.5 2.5" />
      <Path d={star(17.5, 18, 4, 1.8)} fill={a} stroke={a} />
    </>
  );
}

/** Political Donations: a coin dropping into a ballot box. */
export function Donations({ a }: GlyphProps) {
  return (
    <>
      <Path d="M8.5 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-3" />
      <Path d="M9 16h6" />
      <Circle cx={12} cy={7} r={3.5} stroke={a} />
      <Path d="M12 5.5v3" stroke={a} />
    </>
  );
}

/** Staged Demos: a camera on a tripod and a finger pressing the button off-camera. */
export function Demos({ a }: GlyphProps) {
  return (
    <>
      <Rect x={2.5} y={4.5} width={9} height={6.5} rx={1.5} />
      <Path d="M11.5 6.75 14.5 5v5.5l-3-1.75" />
      <Path d="M7 11v3.5M7 14.5l-3.5 6M7 14.5l3.5 6" />
      <Path d="M15.5 21v-3.5a1.5 1.5 0 0 1 1.5-1.5V11a1.25 1.25 0 0 1 2.5 0v4.25l1.25.4a1.5 1.5 0 0 1 1 1.4V21" stroke={a} />
    </>
  );
}

/** Ironclad NDAs: a document sealed with a stamped padlock. */
export function Nda({ a }: GlyphProps) {
  return (
    <>
      <Path d="M10 20H5.5A1.5 1.5 0 0 1 4 18.5v-14A1.5 1.5 0 0 1 5.5 3H11l4 4v3" />
      <Path d="M11 3v4h4" />
      <Path d="M7 9.5h4M7 13h4.5M7 16.5h2" />
      <Circle cx={16.25} cy={16.25} r={5} stroke={a} />
      <Rect x={14.25} y={16} width={4} height={3} rx={0.5} fill={a} stroke="none" />
      <Path d="M15.25 15.5v-.5a1 1 0 0 1 2 0v.5" stroke={a} />
    </>
  );
}

/** Revolving Door: the drum seen from above, its wings and a turning arrow. */
export function RevolvingDoor({ a }: GlyphProps) {
  return (
    <>
      <Path d={arc(12, 12, 8.5, 215, 325)} />
      <Path d={arc(12, 12, 8.5, 35, 145)} />
      <Path d="M5.5 8.25l13 7.5M8.25 18.5l7.5-13" stroke={a} />
      <Path d="M17.75 3.6 19 5.05l-1.9.4M6.25 20.4 5 18.95l1.9-.4" />
    </>
  );
}

/** Bot Farm: a row of phones, each with an antenna. */
export function BotFarm({ a }: GlyphProps) {
  return (
    <>
      {[2.5, 9.25, 16].map((x) => (
        <Rect key={x} x={x} y={9} width={5.5} height={11} rx={1.25} />
      ))}
      <Path d="M5.25 9V6.5M12 9V6.5M18.75 9V6.5" />
      {[5.25, 12, 18.75].map((x) => (
        <Circle key={x} cx={x} cy={5} r={1.1} fill={a} stroke="none" />
      ))}
      <Path d="M4.5 17.5h1.5M11.25 17.5h1.5M18 17.5h1.5" />
    </>
  );
}

/** M&A Team: a big fish about to swallow a small one. */
export function MaTeam({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M5 12C6.5 8 9.5 6.5 12 6.5c1.75 0 3 .75 4 1.75L12.25 12 16 15.75c-1 1-2.25 1.75-4 1.75-2.5 0-5.5-1.5-7-5.5Z" />
      <Path d="M5 12 2.5 8.5v7Z" />
      <Circle cx={10.25} cy={9.75} r={1} fill={c} stroke="none" />
      <Path d="M17.75 12c.75-1.25 1.75-1.75 2.6-1.75 1 0 1.4.8 1.65 1.75-.25.95-.65 1.75-1.65 1.75-.85 0-1.85-.5-2.6-1.75Z" stroke={a} />
      <Path d="M17.75 12 16.25 10.75v2.5Z" stroke={a} />
    </>
  );
}

/** Regulatory Capture: a puppet hanging from a control bar. */
export function Capture({ a }: GlyphProps) {
  return (
    <>
      <Path d="M5 3h14M12 3v2" stroke={a} />
      <Path d="M6 3v9M18 3v9" stroke={a} strokeDasharray="0.01 2.5" />
      <Circle cx={12} cy={7.75} r={2.25} />
      <Path d="M12 10v6M6 12l6 1.5 6-1.5M12 16l-3 5M12 16l3 5" />
    </>
  );
}

/** Hostile Takeovers: a pennant planted on top of someone else's tower. */
export function Hostile({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M3 20.5h18" />
      <Rect x={6.5} y={9} width={9} height={11.5} rx={1} />
      {[11.75, 14.75, 17.75].map((y) => (
        <Rect key={y} x={8.75} y={y} width={4.5} height={1.25} rx={0.4} fill={c} stroke="none" />
      ))}
      <Path d="M11 9V2.5" />
      <Path d="M11 3h7l-2 2.25 2 2.25h-7Z" fill={a} stroke={a} />
    </>
  );
}
