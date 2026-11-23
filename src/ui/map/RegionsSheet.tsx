import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sheet } from '../components/Sheet';
import { fmtPct } from '../format';
import { t } from '../i18n';
import { cased, lower } from '../locale/casing';
import { useTutorialTarget } from '../tutorial/targets';
import { colors, radius, spacing, touch, type } from '../theme';
import { regionGroups, type RegionRow } from './regionList';
import { useTabStore } from '../shell/tabActive';

export interface RegionsSheetProps {
  visible: boolean;
  /** A row was picked: open that region's panel (as a map tap would) and bring it into view. */
  onPick: (regionId: string) => void;
  onClose: () => void;
}

/**
 * Every region in a searchable list: the player's regions (share and data centres), then
 * the neighbours they could spread to, then the rest. Opened with the Regions button on the
 * Map tab. Works without the map at all, and is easier than the map for small regions.
 */
export function RegionsSheet({ visible, onPick, onClose }: RegionsSheetProps) {
  return visible ? <OpenRegionsSheet onPick={onPick} onClose={onClose} /> : null;
}

function OpenRegionsSheet({ onPick, onClose }: Omit<RegionsSheetProps, 'visible'>) {
  const [query, setQuery] = useState('');
  const state = useTabStore((s) => s.state);
  const pack = useTabStore((s) => s.pack);
  const panelRef = useTutorialTarget('map.regionList');
  if (!state) return null;
  const groups = regionGroups(state, pack, query);
  const empty = groups.mine.length + groups.next.length + groups.rest.length === 0;
  const pick = (id: string) => {
    Keyboard.dismiss();
    onPick(id);
  };
  return (
    // The map beside the list stays live (a region tap opens that region, the sea closes the list).
    <Sheet visible onClose={onClose} title={t('ui.regions.title')} dismissOnOutsidePress={false} panelRef={panelRef} testID="regions-sheet">
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('ui.regions.search')}
        placeholderTextColor={colors.dim}
        autoCorrect={false}
        autoCapitalize="words"
        autoComplete="off"
        textContentType="none"
        maxLength={40}
        returnKeyType="done"
        enterKeyHint="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => Keyboard.dismiss()}
        clearButtonMode="while-editing"
        accessibilityLabel={t('ui.regions.search')}
        testID="regions-search"
      />
      {empty ? <Text style={styles.empty}>{t('ui.regions.noMatch', { query: query.trim() })}</Text> : null}
      <Group title={t('ui.regions.mine')} rows={groups.mine} onPick={pick} />
      <Group title={t('ui.regions.next')} rows={groups.next} onPick={pick} />
      <Group title={t('ui.regions.rest')} rows={groups.rest} onPick={pick} />
    </Sheet>
  );
}

function Group({ title, rows, onPick }: { title: string; rows: RegionRow[]; onPick: (id: string) => void }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{cased(styles.groupTitle, title)}</Text>
      {rows.map((row) => (
        <Row key={row.id} row={row} onPick={onPick} />
      ))}
    </View>
  );
}

function Row({ row, onPick }: { row: RegionRow; onPick: (id: string) => void }) {
  const notes: string[] = [];
  if (row.home) notes.push(t('ui.regions.home'));
  if (row.share > 0) notes.push(t('ui.regions.share', { share: fmtPct(row.share) }));
  if (row.sites > 0) notes.push(t('ui.regions.sites', { count: row.sites, dataCentres: lower(t('term.dataCentre')) }));
  if (row.banned) notes.push(t('ui.regions.banned'));
  if (notes.length === 0) notes.push(t('ui.regions.notYet'));
  return (
    <Pressable onPress={() => onPick(row.id)} style={({ pressed }) => [styles.row, pressed && styles.pressed]} accessibilityRole="button" testID={`regions-row-${row.id}`}>
      <Text style={[styles.name, row.share > 0 && styles.nameMine]} numberOfLines={1}>
        {t(row.nameKey)}
      </Text>
      <Text style={[styles.note, row.banned && styles.noteBad]} numberOfLines={1}>
        {notes.join(' · ')}
      </Text>
    </Pressable>
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
  group: { gap: 2 },
  groupTitle: { color: colors.dim, fontSize: type.xs, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.xs },
  row: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingHorizontal: spacing.s,
    borderRadius: radius.s,
  },
  pressed: { backgroundColor: colors.raised },
  name: { flex: 1, color: colors.text, fontSize: type.m, fontWeight: '600' },
  nameMine: { color: colors.playerText },
  note: { color: colors.dim, fontSize: type.s, flexShrink: 1, textAlign: 'right' },
  noteBad: { color: colors.bad },
});
