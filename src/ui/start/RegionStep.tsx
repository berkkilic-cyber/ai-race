import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';
import type { ContentPack } from '@/engine';

import { Button } from '../components/Button';
import { Pips } from '../components/Pips';
import { fmtUsers, toPips } from '../format';
import { t } from '../i18n';
import { colors, radius, spacing, type } from '../theme';
import { regionRead } from './logic';
import { RegionPickerMap, type RivalHome } from './RegionPickerMap';

export interface RegionStepProps {
  pack: ContentPack;
  geometry: MapGeometry;
  selected: string | null;
  onSelect: (id: string) => void;
  onOpenList: () => void;
  focus: { regionId: string; nonce: number } | null;
  /** Wide layout: map on the left, region panel, list and `action` in a column on the right. */
  wide?: boolean;
  /** The "Found the lab" button, shown under the panel in the wide layout. */
  action?: ReactNode;
}

const ATTRS = [
  ['wealth', 'ui.region.wealth'],
  ['openness', 'ui.region.openness'],
  ['strictness', 'ui.region.strictness'],
  ['powerCost', 'ui.region.powerCost'],
] as const;

/** Step 3: world map in picker mode, a panel for the chosen region, and a list as an alternative. */
export function RegionStep({ pack, geometry, selected, onSelect, onOpenList, focus, wide, action }: RegionStepProps) {
  const region = selected ? pack.regions.find((r) => r.id === selected) : undefined;
  const rivalHomes: RivalHome[] = pack.rivals.map((r) => ({ regionId: r.homeRegion, color: r.color }));
  const rivalsHere = region ? pack.rivals.filter((r) => r.homeRegion === region.id) : [];
  const head = (
    <View style={styles.head}>
      <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header" numberOfLines={1}>
        {t('ui.start.regionTitle')}
      </Text>
      <Text style={styles.hint}>{t('ui.start.regionHint')}</Text>
    </View>
  );
  const map = <RegionPickerMap geometry={geometry} selected={selected} onSelect={onSelect} rivalHomes={rivalHomes} focus={focus} fill={wide} />;
  const panel = (
    <View style={[styles.panel, region && styles.panelOn]} testID="start-region-panel">
      {region ? (
        <>
          <View style={styles.panelHead}>
            <Text style={styles.name} numberOfLines={1}>
              {t(region.nameKey)}
            </Text>
            <Text style={styles.pop}>{t('ui.start.population', { amount: fmtUsers(region.population) })}</Text>
          </View>
          <Text style={styles.read}>{regionRead(region)}</Text>
          <View style={styles.attrs}>
            {ATTRS.map(([key, label]) => (
              <View key={key} style={[styles.attr, wide && styles.attrWide]}>
                <Text style={styles.attrLabel} numberOfLines={1}>
                  {t(label)}
                </Text>
                <Pips value={toPips(region[key])} />
              </View>
            ))}
          </View>
          {rivalsHere.map((r) => (
            <View key={r.id} style={styles.rival}>
              <View style={[styles.swatch, { backgroundColor: r.color }]} />
              <Text style={styles.rivalText}>{t('ui.start.rivalHome', { rival: r.id })}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.none}>{t('ui.start.regionNone')}</Text>
      )}
    </View>
  );
  const listButton = <Button label={t('ui.start.regionList')} variant="ghost" compact={wide} onPress={onOpenList} testID="start-region-list" />;

  if (wide) {
    return (
      <View style={styles.wide}>
        <View style={styles.left}>
          {head}
          {map}
        </View>
        <View style={styles.right}>
          <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelScrollContent}>
            {panel}
            {listButton}
          </ScrollView>
          {action}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {head}
      {map}
      {panel}
      {listButton}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.m },
  wide: { flex: 1, flexDirection: 'row', gap: spacing.l },
  left: { flex: 1, gap: spacing.s },
  right: { width: 300, gap: spacing.s },
  panelScroll: { flex: 1 },
  panelScrollContent: { gap: spacing.s },
  titleWide: { fontSize: type.l },
  head: { gap: spacing.xs },
  title: { color: colors.text, fontSize: type.xl, fontWeight: '800' },
  hint: { color: colors.dim, fontSize: type.s },
  panel: { backgroundColor: colors.surface, borderRadius: radius.l, borderWidth: 1, borderColor: colors.border, padding: spacing.l, gap: spacing.s },
  panelOn: { borderColor: colors.player },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  name: { color: colors.text, fontSize: type.l, fontWeight: '800', flexShrink: 1 },
  pop: { color: colors.dim, fontSize: type.s },
  read: { color: colors.player, fontSize: type.s, fontWeight: '600', lineHeight: 19 },
  attrs: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.s, marginTop: spacing.xs },
  attr: { width: '50%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: spacing.m, gap: spacing.s },
  attrWide: { width: '100%', paddingRight: 0 },
  attrLabel: { color: colors.dim, fontSize: type.xs, flexShrink: 1 },
  rival: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  rivalText: { color: colors.dim, fontSize: type.xs },
  none: { color: colors.dim, fontSize: type.s, lineHeight: 19 },
});
