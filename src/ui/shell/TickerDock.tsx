import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useInsets } from '../hooks/useInsets';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors, layout } from '../theme';

/**
 * Holds the Ticker. In wide mode it is a slim strip (layout.tickerHeight) along the
 * bottom of the main area. Its band reaches the bottom edge of the window: it is taller by
 * the bottom inset and the Ticker keeps its text above the home indicator. In narrow mode
 * it adds nothing (the tab bar below it takes the bottom inset).
 */
export function TickerDock({ children }: { children: ReactNode }) {
  const mode = useLayoutMode();
  const insets = useInsets();
  if (mode === 'narrow') return <>{children}</>;
  return <View style={[styles.slim, { height: layout.tickerHeight + Math.max(0, insets.bottom) }]}>{children}</View>;
}

const styles = StyleSheet.create({
  slim: {
    justifyContent: 'flex-start',
    overflow: 'hidden',
    backgroundColor: colors.newsInk,
  },
});
