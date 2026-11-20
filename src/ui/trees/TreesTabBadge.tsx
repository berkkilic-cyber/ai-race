import { StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, radius, tabular, type } from '../theme';
import { useBuyableNodeCount } from './useBuyableNodeCount';

/** Count of buyable nodes for the Trees tab; renders nothing when none can be bought. */
export function TreesTabBadge() {
  const count = useBuyableNodeCount();
  if (count <= 0) return null;
  return (
    <View style={styles.badge} accessibilityLabel={t('ui.trees.badge', { count })} testID="trees-badge">
      <Text style={styles.text}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.player,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.onPlayer, fontSize: type.xs, fontWeight: '800', lineHeight: 14, ...tabular },
});
