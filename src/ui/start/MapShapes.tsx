import { memo } from 'react';
import { Circle, G, Path } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { colors } from '../theme';

export interface MapOutline {
  regionId: string;
  color: string;
  width?: number;
  dashed?: boolean;
}

export interface MapDot {
  key: string;
  x: number;
  y: number;
  r: number;
  color: string;
  /** Soft halo behind the dot. */
  glow?: boolean;
}

export interface MapShapesProps {
  geometry: MapGeometry;
  /** Fill per region; missing regions use the raised surface colour. */
  fills: Record<string, string>;
  outlines?: readonly MapOutline[];
  dots?: readonly MapDot[];
}

/**
 * Static SVG content of the world map (regions, outlines, dots) in map units,
 * using the same generated geometry as the living map. Place inside an <Svg>
 * whose viewBox is the geometry's.
 */
export const MapShapes = memo(function MapShapes({ geometry, fills, outlines = [], dots = [] }: MapShapesProps) {
  return (
    <G pointerEvents="none">
      {Object.entries(geometry.regions).map(([id, g]) => (
        <Path key={id} d={g.d} fill={fills[id] ?? colors.raised} stroke={colors.bg} strokeWidth={0.7} strokeLinejoin="round" />
      ))}
      {outlines.map((o) =>
        geometry.regions[o.regionId] ? (
          <Path
            key={`o-${o.regionId}`}
            d={geometry.regions[o.regionId].d}
            fill="none"
            stroke={o.color}
            strokeWidth={o.width ?? 1.6}
            strokeDasharray={o.dashed ? '4 2' : undefined}
            strokeLinejoin="round"
          />
        ) : null,
      )}
      {dots.map((d) =>
        d.glow ? <Circle key={`g-${d.key}`} cx={d.x} cy={d.y} r={d.r * 2.2} fill={d.color} opacity={0.35} /> : null,
      )}
      {dots.map((d) => (
        <Circle key={d.key} cx={d.x} cy={d.y} r={d.r} fill={d.color} stroke={colors.bg} strokeWidth={0.6} />
      ))}
    </G>
  );
});
