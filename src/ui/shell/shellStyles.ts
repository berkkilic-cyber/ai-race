import { StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors, layout } from '../theme';

export interface ShellStyles {
  /** Style for the Tabs root. */
  tabs: ViewStyle;
  /** Style for the TabList: bottom bar (narrow) or left rail (wide). */
  tabBar: ViewStyle;
}

/** Number of tabs in the rail; the rail keeps them at the top at layout.railItemHeight each. */
const TAB_COUNT = 3;

/**
 * Layout of the game shell. Wide: the TabList becomes an absolute left rail and the
 * header, tab content and ticker stack in the column to its right. Narrow: column with
 * the tab bar at the bottom.
 */
export function useShellStyles(): ShellStyles {
  const mode = useLayoutMode();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  if (mode === 'narrow') return narrow;
  const railHeight = height - insets.top - insets.bottom;
  return {
    tabs: wide.tabs,
    tabBar: { ...wide.rail, paddingBottom: Math.max(0, railHeight - TAB_COUNT * layout.railItemHeight) },
  };
}

const narrow = StyleSheet.create({
  tabs: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border },
});

const wide = StyleSheet.create({
  tabs: { flex: 1, paddingLeft: layout.railWidth },
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: layout.railWidth,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
});
