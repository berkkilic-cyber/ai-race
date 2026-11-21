/** Interface: tabs, buttons and badges. */
import { Circle, Path, Rect } from 'react-native-svg';

import { spark } from '../shapes';
import type { GlyphProps } from '../types';

/** A folded map. */
export function MapIcon({ a }: GlyphProps) {
  return (
    <>
      <Path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20Z" />
      <Path d="M9 4v13.5M15 6.5V20" stroke={a} />
    </>
  );
}

/** An upgrade tree: one node branching into two. */
export function Trees({ c, a }: GlyphProps) {
  return (
    <>
      <Circle cx={12} cy={5.5} r={2.5} fill={a} stroke={a} />
      <Path d="M12 8v3.5M6 16v-2.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2V16" />
      <Circle cx={6} cy={18.5} r={2.5} />
      <Circle cx={18} cy={18.5} r={2.5} fill={c} />
    </>
  );
}

/** A folded newspaper. */
export function News({ a }: GlyphProps) {
  return (
    <>
      <Path d="M4.5 20h13.5a2 2 0 0 0 2-2V5.5A1.5 1.5 0 0 0 18.5 4h-10A1.5 1.5 0 0 0 7 5.5V18a2 2 0 0 1-2 2 2 2 0 0 1-2-2V9.5h4" />
      <Rect x={10} y={7.5} width={7} height={4} rx={0.5} fill={a} stroke={a} />
      <Path d="M10 14.75h7M10 17.25h4.5" />
    </>
  );
}

/** A podium with a spark over first place. */
export function Race({ a }: GlyphProps) {
  return (
    <>
      <Path d="M2.5 20.5h19M3.5 20.5V15h5.5v5.5M9 20.5V11h6v9.5M15 20.5V16.5h5.5v4" />
      <Path d={spark(12, 5.75, 3.25)} fill={a} stroke="none" />
    </>
  );
}

/** Regions: a list of rows with a map pin on the first. */
export function Regions({ c, a }: GlyphProps) {
  return (
    <>
      <Path d="M12 6.5h9M12 12h9M12 17.5h9" />
      <Path d="M6 12.5C4 10.5 2.75 8.9 2.75 7.25a3.25 3.25 0 0 1 6.5 0C9.25 8.9 8 10.5 6 12.5Z" stroke={a} />
      <Circle cx={6} cy={7.25} r={1.1} fill={a} stroke="none" />
      <Circle cx={6} cy={17.5} r={1.25} fill={c} stroke="none" />
    </>
  );
}

export function Info({ c }: GlyphProps) {
  return (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Circle cx={12} cy={7.75} r={1.25} fill={c} stroke="none" />
      <Path d="M12 11v6" />
    </>
  );
}

export function Lock({ a }: GlyphProps) {
  return (
    <>
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <Rect x={5} y={10.5} width={14} height={10} rx={2} />
      <Path d="M12 14.75v2.5" stroke={a} />
    </>
  );
}

export function Check(_: GlyphProps) {
  return <Path d="M4.5 12.5 9.5 17.5 19.5 6.5" />;
}

export function Close(_: GlyphProps) {
  return <Path d="M6 6l12 12M18 6 6 18" />;
}

export function Help({ c }: GlyphProps) {
  return (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.25c-.65.35-1.1.95-1.1 1.7v.55" />
      <Circle cx={12} cy={16.75} r={1.25} fill={c} stroke="none" />
    </>
  );
}

/** Three sliders. */
export function Settings({ a }: GlyphProps) {
  return (
    <>
      <Path d="M3.5 6.5H13M17 6.5h3.5M3.5 12H7M11 12h9.5M3.5 17.5H15M19 17.5h1.5" />
      <Circle cx={15} cy={6.5} r={2} stroke={a} />
      <Circle cx={9} cy={12} r={2} stroke={a} />
      <Circle cx={17} cy={17.5} r={2} stroke={a} />
    </>
  );
}

/** Shown for a name with no drawing: a dashed tile with a dot. */
export function Fallback({ c }: GlyphProps) {
  return (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={3} strokeDasharray="3 3" />
      <Circle cx={12} cy={12} r={1.5} fill={c} stroke="none" />
    </>
  );
}
