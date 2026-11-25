import { useSyncExternalStore } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Overlay } from '../components/Overlay';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, layer, spacing, type, voice } from '../theme';

const COARSE = '(pointer: coarse)';

function subscribe(onChange: () => void): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(COARSE);
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}

const coarseNow = () => Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(COARSE).matches;
const serverSnapshot = () => false;

/** True on a touch-first browser (a phone or tablet), where turning the device helps. */
function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, coarseNow, serverSnapshot);
}

/** "Turn your phone sideways": over everything on a mobile browser held upright. */
export function RotateHint() {
  const { width, height } = useWindowDimensions();
  const coarse = useCoarsePointer();
  const visible = Platform.OS === 'web' && coarse && height > width;
  return (
    <Overlay visible={visible} layer={layer.error + 1} trapFocus={false} testID="demo-rotate">
      <View style={styles.wrap}>
        <View style={styles.phone}>
          <View style={styles.screen} />
        </View>
        <Text style={styles.title}>{t('ui.demo.rotate.title')}</Text>
        <Text style={styles.body}>{t('ui.demo.rotate.body')}</Text>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.m },
  phone: { width: 72, height: 40, borderRadius: 8, borderWidth: 2, borderColor: colors.player, padding: 4, marginBottom: spacing.s },
  screen: { flex: 1, borderRadius: 3, backgroundColor: colors.raised },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.xl, textAlign: 'center' },
  body: { color: colors.dim, fontSize: type.m, textAlign: 'center' },
});
