import { StyleSheet, View } from 'react-native';

import { isDemo } from '../demo/config';
import { useInsets } from '../hooks/useInsets';
import { spacing } from '../theme';
import { MissionsButton } from './MissionsButton';
import { MissionsSheetHost } from './MissionsSheet';

/**
 * The missions pill for the start screen and the sheet it opens. It sits in the bottom-left
 * corner, in the empty left end of the step bar: the top-left corner belongs to the language
 * toggle and the title, which the daily-challenge card pushes up against it. The browser demo
 * puts its waitlist button in this corner, so there the pill is left to the Garage header.
 */
export function MissionsStartButton({ hidden }: { hidden?: boolean }) {
  const insets = useInsets();
  return (
    <>
      {hidden || isDemo() ? null : (
        <View style={[styles.wrap, { bottom: insets.bottom + spacing.l, left: insets.left + spacing.l }]} pointerEvents="box-none">
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
