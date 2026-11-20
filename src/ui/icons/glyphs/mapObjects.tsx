/** Map objects: things that sit on the world map. */
import { Circle, Path, Rect } from 'react-native-svg';

import type { GlyphProps } from '../types';

/** A shipping crate with a graphics card stencilled on its side. */
export function GpuCrate({ a }: GlyphProps) {
  return (
    <>
      <Rect x={2.5} y={5.5} width={19} height={15} rx={1.5} />
      <Path d="M2.5 9.5h19" />
      <Circle cx={8.75} cy={15} r={2.5} stroke={a} />
      <Circle cx={15.25} cy={15} r={2.5} stroke={a} />
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

/** A hall: one building with two cabinets inside. */
export function Rack2({ a }: GlyphProps) {
  return (
    <>
      <Path d="M1.5 20.5h21M3 20.5V10l9-5.5 9 5.5v10.5" />
      <Rect x={6.5} y={12} width={4} height={8.5} rx={0.75} />
      <Rect x={13.5} y={12} width={4} height={8.5} rx={0.75} />
      <Circle cx={8.5} cy={14.75} r={0.95} fill={a} stroke="none" />
      <Circle cx={15.5} cy={14.75} r={0.95} fill={a} stroke="none" />
    </>
  );
}

/** A campus: two halls side by side and a mast. */
export function Rack3({ a }: GlyphProps) {
  return (
    <>
      <Path d="M1 20.5h22" />
      <Path d="M2 20.5V13l4.75-3 4.75 3v7.5" />
      <Path d="M12.5 20.5V12l4.75-3L22 12v8.5" />
      <Rect x={5.25} y={15} width={3} height={5.5} rx={0.5} />
      <Rect x={15.75} y={14} width={3} height={6.5} rx={0.5} />
      <Path d="M17.25 9V4.5" />
      <Path d="M14.75 4a3.5 3.5 0 0 1 5 0" stroke={a} />
      <Circle cx={17.25} cy={4.25} r={1} fill={a} stroke="none" />
      <Circle cx={6.75} cy={12.75} r={0.9} fill={a} stroke="none" />
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

/** Waves on top, a cable along the sea floor with one repeater. */
export function UnderseaCable({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M2.5 6.5c1.6 0 1.6-1.75 3.2-1.75S7.3 6.5 8.9 6.5s1.6-1.75 3.2-1.75 1.6 1.75 3.2 1.75 1.6-1.75 3.2-1.75 1.6 1.75 3 1.75" />
      <Path d="M2.5 18h19" stroke={a} />
      <Rect x={9.25} y={15.5} width={5.5} height={5} rx={1.25} fill={c} stroke="none" />
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
