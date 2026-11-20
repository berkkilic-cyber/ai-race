/** Map objects: things that sit on the world map. */
import { Circle, Path, Rect } from 'react-native-svg';

import type { GlyphProps } from '../types';

/** A shipping crate stencilled with a chip. */
export function GpuCrate({ a }: GlyphProps) {
  return (
    <>
      <Rect x={3} y={5} width={18} height={15.5} rx={1.5} />
      <Path d="M3 9h18" />
      <Rect x={9.75} y={12} width={4.5} height={4.5} rx={0.75} fill={a} stroke={a} />
      <Path d="M11 12v-1.5M13 12v-1.5M11 16.5V18M13 16.5V18M9.75 13.25h-1.5M9.75 15.25h-1.5M14.25 13.25h1.5M14.25 15.25h1.5" stroke={a} />
    </>
  );
}

/** One rack cabinet. */
export function Rack1({ a }: GlyphProps) {
  return (
    <>
      <Rect x={7.5} y={3} width={9} height={18} rx={1.5} />
      <Path d="M7.5 9h9M7.5 15h9M12.5 6H14M12.5 12H14M12.5 18H14" />
      <Circle cx={10} cy={6} r={1} fill={a} stroke="none" />
      <Circle cx={10} cy={12} r={1} fill={a} stroke="none" />
      <Circle cx={10} cy={18} r={1} fill={a} stroke="none" />
    </>
  );
}

/** A hall: a row of three cabinets under one roof. */
export function Rack2({ a }: GlyphProps) {
  return (
    <>
      <Path d="M2 20.5h20M3 20.5V9l9-5 9 5v11.5" />
      <Path d="M6 20.5V11.5h3v9M10.5 20.5V11.5h3v9M15 20.5V11.5h3v9" />
      <Circle cx={7.5} cy={14} r={0.9} fill={a} stroke="none" />
      <Circle cx={12} cy={14} r={0.9} fill={a} stroke="none" />
      <Circle cx={16.5} cy={14} r={0.9} fill={a} stroke="none" />
    </>
  );
}

/** A campus: two halls of cabinets and a mast. */
export function Rack3({ a }: GlyphProps) {
  return (
    <>
      <Path d="M1.5 20.5h21" />
      <Path d="M2.5 20.5V11l5-2.75 5 2.75v9.5" />
      <Path d="M5.25 20.5V14h1.5v6.5M8.25 20.5V14h1.5v6.5" />
      <Path d="M12.5 20.5V14l4.5-2.5 4.5 2.5v6.5" />
      <Path d="M15.25 20.5V16.5h1.5v4M18.25 20.5V16.5h1.5v4" />
      <Path d="M17 11.5V5" />
      <Path d="M14.5 4.5a3.5 3.5 0 0 1 5 0" stroke={a} />
      <Circle cx={17} cy={4.25} r={1} fill={a} stroke="none" />
    </>
  );
}

/** A small robot with a visor. */
export function Robot({ a }: GlyphProps) {
  return (
    <>
      <Path d="M12 5V3" />
      <Circle cx={12} cy={2.5} r={1} fill={a} stroke="none" />
      <Rect x={7} y={5} width={10} height={6.5} rx={2} />
      <Rect x={9} y={7.25} width={6} height={2} rx={1} fill={a} stroke="none" />
      <Path d="M12 11.5v2" />
      <Rect x={6.5} y={13.5} width={11} height={7} rx={2} />
      <Path d="M6.5 15.5H4v3.5M17.5 15.5H20v3.5" />
    </>
  );
}

/** A figure in a suit carrying a briefcase. */
export function Lobbyist({ a }: GlyphProps) {
  return (
    <>
      <Circle cx={9.5} cy={6} r={3} />
      <Path d="M4.5 20.5V16a5 5 0 0 1 10 0v4.5" />
      <Path d="M9.5 11.25v4" />
      <Rect x={15.5} y={15} width={6} height={5.5} rx={1} stroke={a} />
      <Path d="M17 15v-1.5h3V15" stroke={a} />
    </>
  );
}

/** A wave over a cable on the sea floor. */
export function UnderseaCable({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M2.5 7.5c1.6 0 1.6-1.75 3.2-1.75S7.3 7.5 8.9 7.5s1.6-1.75 3.2-1.75 1.6 1.75 3.2 1.75 1.6-1.75 3.2-1.75 1.6 1.75 3 1.75" />
      <Path d="M2.5 17.5h19" stroke={a} />
      <Rect x={6.5} y={15.5} width={4} height={4} rx={1} fill={c} stroke="none" />
      <Rect x={13.5} y={15.5} width={4} height={4} rx={1} fill={c} stroke="none" />
    </>
  );
}

/** An arrow taking off, with speed lines behind it. */
export function Launch({ a }: GlyphProps) {
  return (
    <>
      <Path d="M9 15 19 5M12 5h7v7" />
      <Path d="M3 15.5l3-3M5 20l4.5-4.5M8.5 21l3-3" stroke={a} />
    </>
  );
}
