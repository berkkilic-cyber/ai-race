import { memo, useId } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, Polygon, Rect } from 'react-native-svg';

import { colors, shape, voice } from '../theme';

/**
 * Theme decoration, drawn from the shape tokens so components stay shared:
 * drafting corner ticks (blueprint), clipped corners (hazard), hazard stripes, the
 * ground pattern behind the map and trees, and rubber stamps.
 */

/** Unique, SVG-safe id for a pattern on this screen. */
function usePatternId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

const TICK = 7;
const TICK_OUT = 3;

/** Crop marks: short lines continuing each edge past the corners of the parent, with a gap. */
function Ticks({ color }: { color: string }) {
  const w = shape.hairline;
  const far = -(TICK_OUT + TICK);
  const h = { position: 'absolute' as const, width: TICK, height: w, backgroundColor: color };
  const v = { position: 'absolute' as const, width: w, height: TICK, backgroundColor: color };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[h, { top: -w, left: far }]} />
      <View style={[v, { top: far, left: -w }]} />
      <View style={[h, { top: -w, right: far }]} />
      <View style={[v, { top: far, right: -w }]} />
      <View style={[h, { bottom: -w, left: far }]} />
      <View style={[v, { bottom: far, left: -w }]} />
      <View style={[h, { bottom: -w, right: far }]} />
      <View style={[v, { bottom: far, right: -w }]} />
    </View>
  );
}

/** One clipped corner: a triangle in the ground colour with the cut edge drawn in the border colour. */
function ClipCorner({ size, ground, edge, edgeWidth, at }: { size: number; ground: string; edge: string; edgeWidth: number; at: 'tr' | 'bl' | 'tl' | 'br' }) {
  const s = size;
  const pts = { tr: `0,0 ${s},0 ${s},${s}`, bl: `0,0 0,${s} ${s},${s}`, tl: `0,0 ${s},0 0,${s}`, br: `${s},0 ${s},${s} 0,${s}` }[at];
  const line = { tr: [0, 0, s, s], bl: [0, 0, s, s], tl: [s, 0, 0, s], br: [s, 0, 0, s] }[at];
  const pos: ViewStyle = { position: 'absolute', width: s, height: s, ...(at[0] === 't' ? { top: -0.5 } : { bottom: -0.5 }), ...(at[1] === 'l' ? { left: -0.5 } : { right: -0.5 }) };
  return (
    <Svg width={s} height={s} style={pos} pointerEvents="none">
      <Polygon points={pts} fill={ground} />
      {edgeWidth > 0 ? <Line x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} stroke={edge} strokeWidth={edgeWidth * 1.2} /> : null}
    </Svg>
  );
}

export interface PanelDecoProps {
  /** Colour behind the panel (clipped corners are cut to it). Default bg. */
  ground?: string;
  /** Line colour of ticks and cut edges. Default the theme outline / border. */
  color?: string;
  /** Border width the cut edge continues. Default the theme hairline. */
  edgeWidth?: number;
  /** Clip size override (hazard). */
  clip?: number;
  /** Which corners to clip (hazard). Default top-right and bottom-left. */
  corners?: ('tr' | 'bl' | 'tl' | 'br')[];
}

/**
 * The theme's panel decoration, placed last inside a panel that has its own border:
 * corner ticks (blueprint), clipped corners (hazard), nothing elsewhere.
 */
export const PanelDeco = memo(function PanelDeco({ ground = colors.bg, color, edgeWidth = shape.hairline, clip = shape.clip, corners = ['tr', 'bl'] }: PanelDecoProps) {
  if (shape.panel === 'ticks') return <Ticks color={color ?? colors.outline} />;
  if (shape.panel === 'clip' && clip > 0) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {corners.map((at) => (
          <ClipCorner key={at} at={at} size={clip} ground={ground} edge={color ?? colors.border} edgeWidth={edgeWidth} />
        ))}
      </View>
    );
  }
  return null;
});

export interface StripesProps {
  /** Band height. */
  height: number;
  /** Stripe width along the band. Default height * 0.9. */
  stripe?: number;
  a?: string;
  b?: string;
  style?: StyleProp<ViewStyle>;
  /** Diagonal direction. */
  flip?: boolean;
}

/** A band of diagonal hazard stripes (full width of its parent). */
export const Stripes = memo(function Stripes({ height, stripe, a = colors.stripeA, b = colors.stripeB, style, flip }: StripesProps) {
  const id = usePatternId('st');
  const w = stripe ?? Math.max(4, height * 0.9);
  const p = w * 2;
  const d = flip ? `M0 0 L${w} 0 L${w + p} ${p} L${p} ${p} Z M${-p} 0 L${w - p} 0 L${w} ${p} L0 ${p} Z` : `M${w} 0 L${p} 0 L${w} ${p} L0 ${p} Z M${p + w} 0 L${p * 2} 0 L${p + w} ${p} L${p} ${p} Z`;
  return (
    <View style={[{ height, overflow: 'hidden', backgroundColor: b }, style]} pointerEvents="none">
      <Svg width="100%" height={height}>
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={p} height={p}>
            <Rect x={0} y={0} width={p} height={p} fill={b} />
            <Path d={d} fill={a} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={height} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

/** Grid cell of the drafting ground, and how many cells make a major square. */
const GRID = 14;
const MAJOR = 5;

/**
 * The ground behind the map, trees and news: a drafting grid (blueprint), polka dots
 * (candy) or nothing. Fills its parent; never takes touches.
 */
export const Ground = memo(function Ground() {
  const id = usePatternId('gr');
  if (shape.ground === 'grid') {
    const big = GRID * MAJOR;
    const minor = Array.from({ length: MAJOR - 1 }, (_, i) => (i + 1) * GRID);
    return (
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={big} height={big}>
            {minor.map((x) => (
              <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={big} stroke={colors.grid} strokeWidth={1} />
            ))}
            {minor.map((y) => (
              <Line key={`h${y}`} x1={0} y1={y} x2={big} y2={y} stroke={colors.grid} strokeWidth={1} />
            ))}
            <Line x1={0.5} y1={0} x2={0.5} y2={big} stroke={colors.gridMajor} strokeWidth={1} />
            <Line x1={0} y1={0.5} x2={big} y2={0.5} stroke={colors.gridMajor} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    );
  }
  if (shape.ground === 'dots') {
    return (
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <Pattern id={id} patternUnits="userSpaceOnUse" width={22} height={22}>
            <Circle cx={5.5} cy={5.5} r={1.6} fill={colors.gridMajor} />
            <Circle cx={16.5} cy={16.5} r={1.6} fill={colors.gridMajor} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    );
  }
  return null;
});

export interface StampProps {
  text: string;
  color?: string;
  /** Degrees. */
  rotate?: number;
  /** Outlined rubber stamp (double rule) instead of a solid block. Default from the theme. */
  outline?: boolean;
  size?: number;
  /** Text colour on a solid stamp. */
  ink?: string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A rubber stamp in the loud voice: solid block or a double-ruled outline, slightly rotated. */
export const Stamp = memo(function Stamp({ text, color = colors.newsRed, rotate = -4, outline = shape.stamp === 'outline', size = 15, ink = colors.newsPaper, textStyle, style, testID }: StampProps) {
  const label = <Text style={[voice.loudKicker, { fontSize: size, lineHeight: size + 2, letterSpacing: size / 7, color: outline ? color : ink }, textStyle]} numberOfLines={1}>{text}</Text>;
  return (
    <View testID={testID} pointerEvents="none" style={[{ alignSelf: 'flex-start', transform: [{ rotate: `${rotate}deg` }] }, style]}>
      {outline ? (
        <View style={{ borderWidth: 2, borderColor: color, padding: 2 }}>
          <View style={{ borderWidth: 1, borderColor: color, paddingHorizontal: size * 0.45, paddingVertical: 1 }}>{label}</View>
        </View>
      ) : (
        <View style={{ backgroundColor: color, paddingHorizontal: size * 0.45, paddingVertical: 1 }}>{label}</View>
      )}
    </View>
  );
});
