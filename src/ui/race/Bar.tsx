import { StyleSheet, View } from 'react-native';

import { colors, radius, shape } from '../theme';

export interface BarProps {
  /** 0..1 */
  value: number;
  color: string;
  /** 0..1: a second lab's position on the same track, drawn as a tick. */
  marker?: number;
  markerColor?: string;
  height?: number;
  testID?: string;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** A progress track in the theme's meter style, with an optional marker for a rival on the same track. */
export function Bar({ value, color, marker, markerColor, height = 6, testID }: BarProps) {
  return (
    <View style={[styles.track, { height }]} testID={testID}>
      <View style={[styles.fill, { width: `${clamp01(value) * 100}%`, backgroundColor: color }]} />
      {marker !== undefined ? <View style={[styles.mark, { left: `${clamp01(marker) * 100}%`, backgroundColor: markerColor ?? colors.text }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    alignSelf: 'stretch',
    backgroundColor: shape.panel === 'ticks' ? colors.transparent : colors.raised,
    borderWidth: shape.panel === 'ticks' || shape.panel === 'sticker' ? shape.hairline * 0.75 : 0,
    borderColor: colors.outline,
    borderRadius: radius.pill,
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  mark: { position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1.5, borderWidth: 0.5, borderColor: colors.bg },
});
