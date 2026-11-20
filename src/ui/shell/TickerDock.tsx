import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors, layout } from '../theme';

/**
 * Holds the Ticker. In wide mode it is a slim strip (layout.tickerHeight) along the
 * bottom of the main area; the ticker is centred in it. In narrow mode it adds nothing.
 */
export function TickerDock({ children }: { children: ReactNode }) {
  const mode = useLayoutMode();
  if (mode === 'narrow') return <>{children}</>;
  return <View style={styles.slim}>{children}</View>;
}

const styles = StyleSheet.create({
  slim: {
    height: layout.tickerHeight,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});
