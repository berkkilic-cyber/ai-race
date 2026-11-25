import { StyleSheet, View } from 'react-native';

import { useInsets } from '../hooks/useInsets';
import { spacing } from '../theme';
import { MissionsButton } from './MissionsButton';
import { MissionsSheetHost } from './MissionsSheet';

/** Room left for the language toggle in the top-left corner (EN | TR). */
const LANGUAGE_TOGGLE_SPACE = 96;

/** The missions pill for the start screen (top left, beside the language toggle, clear of the mode cards) and the sheet it opens. */
export function MissionsStartButton({ hidden }: { hidden?: boolean }) {
  const insets = useInsets();
  return (
    <>
      {hidden ? null : (
        <View style={[styles.wrap, { top: insets.top + spacing.xs, left: insets.left + LANGUAGE_TOGGLE_SPACE }]} pointerEvents="box-none">
          <MissionsButton variant="pill" testID="missions-start" />
        </View>
      )}
      <MissionsSheetHost />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});
