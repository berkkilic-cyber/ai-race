import { memo } from 'react';
import { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { t } from '../i18n';
import { upper } from '../locale/casing';
import { colors, fonts } from '../theme';
import { bannedKey } from './mapColors';
import { allFinite, isDrawablePath } from './svgSafe';
import { useTabStore } from '../shell/tabActive';

export interface OverlayLayerProps {
  geometry: MapGeometry;
  selected: string | null;
}

/** Stamp size in map units. */
const STAMP_W = 46;
const STAMP_H = 15;

/** A rotated "BANNED" stamp over a region where the player is banned. */
const BanStamp = memo(function BanStamp({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(-12)`}>
      <Rect x={-STAMP_W / 2} y={-STAMP_H / 2} width={STAMP_W} height={STAMP_H} fill={colors.newsPaper} fillOpacity={0.85} stroke={colors.alarm} strokeWidth={1.4} />
      <Rect x={-STAMP_W / 2 + 1.6} y={-STAMP_H / 2 + 1.6} width={STAMP_W - 3.2} height={STAMP_H - 3.2} fill="none" stroke={colors.alarm} strokeWidth={0.4} />
      <SvgText x={0} y={3.9} fontSize={11} fontFamily={fonts.newsHeavy} letterSpacing={1} textAnchor="middle" fill={colors.alarm}>
        {label}
      </SvgText>
    </G>
  );
});

/**
 * Drawn above the dots: a thin outline of the selected region's shape and a stamp over
 * every region where the player is banned.
 */
export const OverlayLayer = memo(function OverlayLayer({ geometry, selected }: OverlayLayerProps) {
  const banned = useTabStore((s) => (s.state ? bannedKey(s.state) : ''));
  const bannedIds = banned ? banned.split('|') : [];
  const label = upper(t('ui.map.banned'));
  return (
    <G pointerEvents="none">
      {selected && geometry.regions[selected] && isDrawablePath(geometry.regions[selected].d) ? (
        <Path d={geometry.regions[selected].d} fill="none" stroke={colors.text} strokeWidth={0.7} strokeLinejoin="round" strokeOpacity={0.85} testID="map-selection" />
      ) : null}
      {bannedIds.map((id) => {
        const region = geometry.regions[id];
        return region && allFinite(region.centroid[0], region.centroid[1]) ? <BanStamp key={`b-${id}`} x={region.centroid[0]} y={region.centroid[1]} label={label} /> : null;
      })}
    </G>
  );
});
