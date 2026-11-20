import { memo } from 'react';
import { G, Path } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { useRegionFlashes } from '../hooks/useRegionFlashes';
import { useGameStore } from '../store/game';
import { colors } from '../theme';
import { bannedKey } from './mapColors';

export interface OverlayLayerProps {
  geometry: MapGeometry;
  selected: string | null;
}

/** Drawn above all regions so outlines are not covered by neighbours: news flashes, bans, selection. */
export const OverlayLayer = memo(function OverlayLayer({ geometry, selected }: OverlayLayerProps) {
  const banned = useGameStore((s) => (s.state ? bannedKey(s.state) : ''));
  const flashes = useRegionFlashes();
  const bannedIds = banned ? banned.split('|') : [];
  return (
    <G pointerEvents="none">
      {Object.entries(flashes).map(([id, tone]) =>
        geometry.regions[id] ? (
          <Path key={`f-${id}`} d={geometry.regions[id].d} fill={tone === 'bad' ? colors.bad : colors.good} fillOpacity={0.55} />
        ) : null,
      )}
      {bannedIds.map((id) =>
        geometry.regions[id] ? (
          <Path key={`b-${id}`} d={geometry.regions[id].d} fill="none" stroke={colors.bad} strokeWidth={2} strokeDasharray="4 2" strokeLinejoin="round" />
        ) : null,
      )}
      {selected && geometry.regions[selected] ? (
        <Path d={geometry.regions[selected].d} fill="none" stroke={colors.text} strokeWidth={1.6} strokeLinejoin="round" />
      ) : null}
    </G>
  );
});
