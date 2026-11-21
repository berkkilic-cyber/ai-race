import { memo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';

export interface FitLabelProps {
  /** Candidates, longest first: the first that fits the available width is shown, else the last. */
  options: readonly string[];
  style: StyleProp<TextStyle>;
  testID?: string;
}

/** Room given to the invisible measuring texts, wider than any label. */
const MEASURE_WIDTH = 600;

/**
 * A one-line label that never clips: it measures each candidate once (invisible, off the
 * layout flow) and shows the longest one that fits the width it is given, so labels shrink
 * to an abbreviation ("Regulation" -> "Regul.") before anything is cut. The container must
 * get its width from its parent (flex), not from this text.
 */
export const FitLabel = memo(function FitLabel({ options, style, testID }: FitLabelProps) {
  const [box, setBox] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  const onBox = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBox((cur) => (Math.abs(cur - w) < 0.5 ? cur : w));
  };
  const measured = (i: number) => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidths((cur) => {
      if (Math.abs((cur[i] ?? -1) - w) < 0.5) return cur;
      const next = [...cur];
      next[i] = w;
      return next;
    });
  };
  const known = box > 0 && widths.length === options.length && widths.every((w) => w !== undefined);
  let pick = options.length - 1;
  if (!known) pick = 0;
  else {
    for (let i = 0; i < options.length; i++) {
      if (widths[i] <= box + 0.5) {
        pick = i;
        break;
      }
    }
  }
  return (
    <View style={styles.box} onLayout={onBox} testID={testID}>
      <Text style={style} numberOfLines={1} ellipsizeMode="clip">
        {options[pick]}
      </Text>
      <View style={styles.measure} pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {options.map((label, i) => (
          <Text key={i} style={[style, styles.measureText]} numberOfLines={1} onLayout={measured(i)}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  box: { flex: 1, minWidth: 0, overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, top: 0, width: MEASURE_WIDTH, opacity: 0, alignItems: 'flex-start' },
  measureText: { alignSelf: 'flex-start' },
});
