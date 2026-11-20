import { StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';

import { useInsets } from '../hooks/useInsets';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors } from '../theme';
import { narrowShellLayout, wideShellLayout } from './shellLayout';

export interface ShellStyles {
  /** Style for the Tabs root (no padding: every child places itself from the insets). */
  tabs: ViewStyle;
  /** The column holding the header, the main area and the ticker. */
  main: ViewStyle;
  /** Style for the TabList's view: bottom bar (narrow) or left rail (wide). */
  tabBar: ViewStyle;
}

/**
 * Layout of the game shell from the window size and the safe-area insets (shellLayout.ts).
 * Wide: the TabList is an absolute left rail whose background runs under the left inset,
 * and the main column is absolutely placed from the rail's right edge to the right inset.
 * Narrow: column with the tab bar at the bottom. Insets are applied here explicitly, once;
 * the shell has no SafeAreaView.
 */
export function useShellStyles(): ShellStyles {
  const mode = useLayoutMode();
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  if (mode === 'narrow') {
    const n = narrowShellLayout(insets);
    return { tabs: base.tabs, main: { ...narrow.main, ...n.main }, tabBar: { ...narrow.tabBar, ...n.tabBar } };
  }
  const w = wideShellLayout(width, height, insets);
  return {
    tabs: base.tabs,
    main: { ...wide.main, left: w.main.left, top: w.main.top, right: w.main.right },
    tabBar: { ...wide.rail, width: w.rail.width, paddingLeft: w.rail.paddingLeft, paddingTop: w.rail.paddingTop },
  };
}

const base = StyleSheet.create({
  tabs: { flex: 1, flexDirection: 'column' },
});

const narrow = StyleSheet.create({
  main: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});

const wide = StyleSheet.create({
  main: { position: 'absolute', bottom: 0, flexDirection: 'column' },
  rail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: colors.bg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
