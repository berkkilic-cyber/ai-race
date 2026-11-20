import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';
import { getWorldShare, type ContentPack, type GameState } from '@/engine';

import { fmtPct } from '../format';
import { labColor, labName } from '../i18n';
import { bannedKey, parseSites, regionFills, sitesKey } from '../map/mapColors';
import { MapShapes, type MapDot, type MapOutline } from '../start/MapShapes';
import { colors, radius, spacing, tabular, type } from '../theme';

export interface FinalMapProps {
  state: GameState;
  pack: ContentPack;
  geometry: MapGeometry;
}

/** Static snapshot of the map as it stood when the run ended, with a legend of labs by world share. */
export function FinalMap({ state, pack, geometry }: FinalMapProps) {
  const { fills, outlines, dots } = useMemo(() => {
    const ids = Object.keys(geometry.regions);
    const banned = bannedKey(state);
    const outlineList: MapOutline[] = banned ? banned.split('|').map((id) => ({ regionId: id, color: colors.bad, width: 1.6, dashed: true })) : [];
    const perRegion = new Map<string, number>();
    const dotList: MapDot[] = [];
    for (const site of parseSites(sitesKey(state), state.playerLabId, (id) => (state.labs[id] ? labColor(state.labs[id]) : colors.dim))) {
      const g = geometry.regions[site.regionId];
      if (!g) continue;
      const n = perRegion.get(site.regionId) ?? 0;
      perRegion.set(site.regionId, n + 1);
      const angle = n * 2.4;
      const r = n === 0 ? 0 : 4 + n * 1.5;
      dotList.push({
        key: site.key,
        x: g.centroid[0] + Math.cos(angle) * r,
        y: g.centroid[1] + Math.sin(angle) * r,
        r: (site.mine ? 2.6 : 2) + site.level * 0.25,
        color: site.online ? site.color : colors.offline,
        glow: site.online,
      });
    }
    return { fills: regionFills(state, ids), outlines: outlineList, dots: dotList };
  }, [state, geometry]);

  const legend = useMemo(
    () =>
      state.labOrder
        .map((id) => ({ lab: state.labs[id], share: getWorldShare(state, pack, id) }))
        .filter(({ lab, share }) => lab.controller === 'human' || share > 0 || lab.active)
        .sort((a, b) => b.share - a.share),
    [state, pack],
  );

  const [, , vw, vh] = geometry.viewBox;
  return (
    <View style={styles.wrap}>
      <View style={[styles.map, { aspectRatio: geometry.width / geometry.height }]} testID="end-map">
        <Svg width="100%" height="100%" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
          <MapShapes geometry={geometry} fills={fills} outlines={outlines} dots={dots} />
        </Svg>
      </View>
      <View style={styles.legend}>
        {legend.map(({ lab, share }) => (
          <View key={lab.id} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: labColor(lab) }]} />
            <Text style={[styles.name, lab.controller === 'human' && styles.me, !lab.active && styles.out]} numberOfLines={1}>
              {labName(lab)}
            </Text>
            <Text style={styles.share}>{fmtPct(share)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.m },
  map: { width: '100%', backgroundColor: colors.bg, borderRadius: radius.s, overflow: 'hidden' },
  legend: { gap: spacing.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, color: colors.dim, fontSize: type.s },
  me: { color: colors.text, fontWeight: '700' },
  out: { textDecorationLine: 'line-through' },
  share: { color: colors.text, fontSize: type.s, ...tabular },
});
