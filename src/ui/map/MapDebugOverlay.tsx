import { StyleSheet, Text, View } from 'react-native';

import { buildLabel } from '../diagnostics/build';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { colors, radius, spacing, type } from '../theme';
import { touchDebugInfo, usePoll, useTouchDebugOn } from './touchDebug';

const POLL_MS = 120;
const r = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : '-');
const r2 = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : '-');

/**
 * Live touch diagnostics drawn over the map (top left), only while the debug overlay is on
 * (long-press the build stamp or the mascot for two seconds). Takes no touches. Polls the
 * record a few times a second; the touch handling itself never renders React.
 */
export function MapDebugOverlay() {
  const on = useTouchDebugOn();
  if (!on) return null;
  return <Panel />;
}

function Panel() {
  usePoll(true, POLL_MS);
  const insets = useInsets();
  const d = touchDebugInfo();
  const lines = [
    `${t('ui.debug.build')} ${buildLabel()} · ${d.map}`,
    `${t('ui.debug.raw')} page ${r(d.raw?.pageX)},${r(d.raw?.pageY)} loc ${r(d.raw?.locationX)},${r(d.raw?.locationY)}`,
    `${t('ui.debug.local')} ${r(d.local?.x)},${r(d.local?.y)} · ${t('ui.debug.origin')} ${r(d.origin?.x)},${r(d.origin?.y)} · ${t('ui.debug.measured')} ${r(d.measured?.x)},${r(d.measured?.y)}`,
    `${t('ui.debug.touches')} ${d.touches} [${d.list}] · ${d.phase} · ${t('ui.debug.taps')} ${d.taps}`,
    `${t('ui.debug.callbacks')} ${d.callbacks.map((c) => (c.count > 1 ? `${c.name}×${c.count}` : c.name)).join(' ') || '-'}`,
    `${t('ui.debug.region')} ${d.region ?? '-'}`,
    `${t('ui.debug.view')} s ${r2(d.view.s)} t ${r(d.view.tx)},${r(d.view.ty)} · ${t('ui.debug.layout')} ${r(d.layout.w)}×${r(d.layout.h)}`,
    `${t('ui.debug.insets')} ${insets.top},${insets.right},${insets.bottom},${insets.left}`,
  ];
  return (
    <View style={styles.panel} pointerEvents="none" testID="map-debug">
      {lines.map((line, i) => (
        <Text key={i} style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: spacing.s,
    top: spacing.s,
    maxWidth: 420,
    padding: spacing.s,
    borderRadius: radius.s,
    backgroundColor: colors.scrim,
  },
  line: { color: colors.newsPaper, fontSize: type.xs, lineHeight: 14, fontVariant: ['tabular-nums'] },
});
