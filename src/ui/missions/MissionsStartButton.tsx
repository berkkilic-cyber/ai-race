import { StyleSheet, View } from 'react-native';

import { useInsets } from '../hooks/useInsets';
import { spacing } from '../theme';
import { MissionsButton } from './MissionsButton';

/** The missions pill for the start screen: one small element in the top-right corner, under the build stamp. */
export function MissionsStartButton({ hidden }: { hidden?: boolean }) {
  const insets = useInsets();
  if (hidden) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + spacing.xl, right: insets.right + spacing.s }]} pointerEvents="box-none">
      <MissionsButton variant="pill" testID="missions-start" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
