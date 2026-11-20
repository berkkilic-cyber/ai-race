import Svg, { Path, Rect } from 'react-native-svg';

export interface GlyphProps {
  color: string;
  size?: number;
}

export function CheckGlyph({ color, size = 14 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M3 8.5 L6.5 12 L13 4.5" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CrossGlyph({ color, size = 14 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M4 4 L12 12 M12 4 L4 12" stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function LockGlyph({ color, size = 14 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M5 7 V5 a3 3 0 0 1 6 0 V7" stroke={color} strokeWidth={1.8} fill="none" />
      <Rect x={3} y={7} width={10} height={7.5} rx={1.5} fill={color} />
    </Svg>
  );
}
