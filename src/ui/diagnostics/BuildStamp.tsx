import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { t } from '../i18n';
import { toggleTouchDebug, useTouchDebugOn } from '../map/touchDebug';
import { colors, type } from '../theme';
import { buildLabel } from './build';

/** Long press this long on the stamp (or the mascot) to toggle the touch debug overlay. */
export const DEBUG_LONG_PRESS_MS = 2000;

/**
 * The build stamp: small dim text with the commit and build time. A two-second long press
 * toggles the touch debug overlay for the session.
 */
export function BuildStamp({ style }: { style?: StyleProp<ViewStyle> }) {
  const debug = useTouchDebugOn();
  return (
    <Pressable onLongPress={toggleTouchDebug} delayLongPress={DEBUG_LONG_PRESS_MS} style={style} accessibilityRole="text" testID="build-stamp">
      <Text style={styles.text}>
        {t('ui.build.stamp', { build: buildLabel() })}
        {debug ? ` · ${t('ui.debug.on')}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.dim, fontSize: type.xs, opacity: 0.8, fontVariant: ['tabular-nums'] },
});
