import { memo } from 'react';
import { G, Path } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { useGameStore } from '../store/game';
import { colors } from '../theme';
import { regionFills } from './mapColors';
import { isDrawablePath } from './svgSafe';

interface RegionPathProps {
  d: string;
  fill: string;
}

/** One region. Memoised: re-renders only when its fill changes. */
const RegionPath = memo(function RegionPath({ d, fill }: RegionPathProps) {
  if (!isDrawablePath(d)) return null;
  return <Path d={d} fill={fill} stroke={colors.bg} strokeWidth={0.7} strokeLinejoin="round" />;
});

export interface RegionLayerProps {
  geometry: MapGeometry;
  regionIds: readonly string[];
}

const EMPTY: Record<string, string> = {};

/** All region fills. Subscribes to a shallow-compared fill map so unchanged regions skip rendering. */
export const RegionLayer = memo(function RegionLayer({ geometry, regionIds }: RegionLayerProps) {
  const fills = useGameStore(useShallow((s) => (s.state ? regionFills(s.state, regionIds) : EMPTY)));
  return (
    <G pointerEvents="none">
      {regionIds.map((id) => (
        <RegionPath key={id} d={geometry.regions[id].d} fill={fills[id] ?? colors.raised} />
      ))}
    </G>
  );
});
