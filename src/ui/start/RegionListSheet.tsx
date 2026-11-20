import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RegionDef } from '@/engine';

import { Sheet } from '../components/Sheet';
import { fmtUsers } from '../format';
import { t } from '../i18n';
import { colors, radius, spacing, touch, type } from '../theme';
import { regionRead, searchRegions } from './logic';

export interface RegionListSheetProps {
  visible: boolean;
  regions: readonly RegionDef[];
  selected: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Searchable list of regions, the alternative to tapping the map. */
export function RegionListSheet({ visible, regions, selected, onSelect, onClose }: RegionListSheetProps) {
  const [query, setQuery] = useState('');
  const matches = searchRegions(regions, query);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('ui.start.regionList')} maxHeight="85%" testID="start-region-sheet">
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('ui.start.regionSearch')}
        placeholderTextColor={colors.dim}
        autoCorrect={false}
        accessibilityLabel={t('ui.start.regionSearch')}
        testID="start-region-search"
      />
      {matches.length === 0 ? <Text style={styles.empty}>{t('ui.start.regionNoMatch', { query: query.trim() })}</Text> : null}
      <View style={styles.list}>
        {matches.map((r) => {
          const on = r.id === selected;
          return (
            <Pressable
              key={r.id}
              onPress={() => onSelect(r.id)}
              style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              testID={`region-row-${r.id}`}
            >
              <View style={styles.rowText}>
                <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                  {t(r.nameKey)}
                </Text>
                <Text style={styles.read} numberOfLines={1}>
                  {regionRead(r)}
                </Text>
              </View>
              <Text style={styles.pop}>{fmtUsers(r.population)}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: touch,
    backgroundColor: colors.bg,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: type.m,
    paddingHorizontal: spacing.m,
  },
  empty: { color: colors.dim, fontSize: type.s },
  list: { gap: spacing.xs },
  row: {
    minHeight: touch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  rowOn: { borderColor: colors.player, backgroundColor: colors.raised },
  pressed: { opacity: 0.8 },
  rowText: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: type.m, fontWeight: '600' },
  nameOn: { color: colors.playerText },
  read: { color: colors.dim, fontSize: type.xs },
  pop: { color: colors.dim, fontSize: type.s },
});
