/**
 * Moments: the marks inside small tappable bubbles on the map (about 20 px), so each one
 * is a single, plain silhouette. `cash` and `gavel` reuse the resource drawings.
 */
import { Circle, Path, Rect } from 'react-native-svg';

import { spark, star } from '../shapes';
import type { GlyphProps } from '../types';

export function MegaphoneMoment({ a }: GlyphProps) {
  return (
    <>
      <Path d="M3.5 10.25v3.5A1.75 1.75 0 0 0 5.25 15.5H7.5l8 4.25V4.25l-8 4.25H5.25A1.75 1.75 0 0 0 3.5 10.25Z" />
      <Path d="M19 9a4.5 4.5 0 0 1 0 6" stroke={a} />
    </>
  );
}

export function StarMoment({ a }: GlyphProps) {
  return <Path d={star(12, 12.75, 9.5, 4.25)} stroke={a} />;
}

export function Chip({ a }: GlyphProps) {
  return (
    <>
      <Rect x={6} y={6} width={12} height={12} rx={2} />
      <Rect x={9.5} y={9.5} width={5} height={5} rx={0.75} fill={a} stroke="none" />
      <Path d="M9 6V3M12 6V3M15 6V3M9 21v-3M12 21v-3M15 21v-3M6 9H3M6 12H3M6 15H3M21 9h-3M21 12h-3M21 15h-3" />
    </>
  );
}

export function DocumentMoment({ a }: GlyphProps) {
  return (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <Path d="M14 3v5h5" />
      <Path d="M8.5 12.5h7M8.5 16h4.5" stroke={a} />
    </>
  );
}

/** A head and shoulders under a magnifying glass. */
export function Recruiter({ a }: GlyphProps) {
  return (
    <>
      <Circle cx={9} cy={7.5} r={3.25} />
      <Path d="M3 19.5a6 6 0 0 1 8.25-5.55" />
      <Circle cx={16} cy={15} r={3.5} stroke={a} />
      <Path d="M18.6 17.6l2.9 2.9" stroke={a} />
    </>
  );
}

export function Thermometer({ a }: GlyphProps) {
  return (
    <>
      <Path d="M9 14.25V5a2.5 2.5 0 0 1 5 0v9.25a4.25 4.25 0 1 1-5 0Z" />
      <Path d="M11.5 17.5V9" stroke={a} />
      <Circle cx={11.5} cy={17.75} r={1.75} fill={a} stroke="none" />
      <Path d="M17 6h2M17 9.5h2M17 13h2" />
    </>
  );
}

export function CameraMoment({ a }: GlyphProps) {
  return (
    <>
      <Path d="M3 9a2 2 0 0 1 2-2h2.5L9 4.5h6L16.5 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <Circle cx={12} cy={13.25} r={3.75} />
      <Circle cx={17.75} cy={10} r={1} fill={a} stroke="none" />
    </>
  );
}

export function Speech({ a }: GlyphProps) {
  return (
    <>
      <Path d="M6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5v-8A2.5 2.5 0 0 1 6.5 4Z" />
      <Circle cx={8.5} cy={10.5} r={1.2} fill={a} stroke="none" />
      <Circle cx={12} cy={10.5} r={1.2} fill={a} stroke="none" />
      <Circle cx={15.5} cy={10.5} r={1.2} fill={a} stroke="none" />
    </>
  );
}

/** Three people: one in front, two behind. */
export function Crowd({ a }: GlyphProps) {
  return (
    <>
      <Circle cx={12} cy={9} r={3} />
      <Path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
      <Circle cx={5} cy={8.5} r={2.25} stroke={a} />
      <Circle cx={19} cy={8.5} r={2.25} stroke={a} />
      <Path d="M1.75 17.5a4 4 0 0 1 4.5-4M22.25 17.5a4 4 0 0 0-4.5-4" stroke={a} />
    </>
  );
}

export function Trophy({ a }: GlyphProps) {
  return (
    <>
      <Path d="M7 3.5h10V9a5 5 0 0 1-10 0Z" />
      <Path d="M7 5.5H4.5V7a3.25 3.25 0 0 0 2.9 3.25M17 5.5h2.5V7a3.25 3.25 0 0 1-2.9 3.25" />
      <Path d="M12 14v3" />
      <Rect x={8} y={17} width={8} height={3.5} rx={1} />
      <Path d={spark(12, 8.25, 2.5)} fill={a} stroke="none" />
    </>
  );
}

export function Mortarboard({ a }: GlyphProps) {
  return (
    <>
      <Path d="M12 4.5 22 9l-10 4.5L2 9Z" />
      <Path d="M6 11v4.25c0 1.6 2.7 3.25 6 3.25s6-1.65 6-3.25V11" />
      <Path d="M20 9.9v5.1" stroke={a} />
      <Circle cx={20} cy={16.25} r={1.25} fill={a} stroke="none" />
    </>
  );
}

export function Heart({ a }: GlyphProps) {
  return (
    <Path
      d="M12 20.5C6 16.5 3 13.2 3 9.5 3 6.9 5 5 7.4 5c1.9 0 3.5 1 4.6 2.6C13.1 6 14.7 5 16.6 5 19 5 21 6.9 21 9.5c0 3.7-3 7-9 11Z"
      stroke={a}
    />
  );
}

export function Bug({ a }: GlyphProps) {
  return (
    <>
      <Path d="M12 8.5c2.9 0 5 2.6 5 6s-2.1 6-5 6-5-2.6-5-6 2.1-6 5-6Z" />
      <Path d="M9.5 8.9a2.5 2.5 0 0 1 5 0" />
      <Path d="M10.5 6.75 9 4.25M13.5 6.75 15 4.25" />
      <Path d="M7 12H4M7 15.5H3.5M7.5 18.5 5 20.5M17 12h3M17 15.5h3.5M16.5 18.5l2.5 2" />
      <Path d="M12 11.5v6.5" stroke={a} />
    </>
  );
}

export function Bolt({ a }: GlyphProps) {
  return <Path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6Z" fill={a} />;
}
