import { memo } from 'react';
import { Circle, G, Path } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { asDotGeometry, drawableDots } from '../map/dotGeometry';
import { DOT_SIZE } from '../map/DotLayer';
import { allFinite, isDrawablePath, nonNegative } from '../map/svgSafe';
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
  /** Colour per region (its dots, or its fill); missing regions rest. */
  fills: Record<string, string>;
  outlines?: readonly MapOutline[];
  dots?: readonly MapDot[];
}

/**
 * Static SVG content of the world map (the dot matrix, or region fills for a pack
 * without one; outlines; marker dots) in map units,
 * using the same generated geometry as the living map. Place inside an <Svg>
 * whose viewBox is the geometry's.
 */
/** Dash pattern as numbers: react-native-svg parses arrays the same on every platform. */
const DASHED = [4, 2];

export const MapShapes = memo(function MapShapes({ geometry, fills, outlines = [], dots = [] }: MapShapesProps) {
  const matrix = asDotGeometry(geometry);
  return (
    <G pointerEvents="none">
      {matrix ? (
        <G transform={`translate(${matrix.dots.pitch / 2} ${matrix.dots.pitch / 2}) scale(${matrix.dots.pitch})`}>
          {Object.entries(matrix.regions).map(([id, g]) => {
            const d = drawableDots(g.dots.join(''));
            return isDrawablePath(d) ? <Path key={id} d={d} fill="none" stroke={fills[id] ?? colors.dotRest} strokeWidth={DOT_SIZE} strokeLinecap="round" /> : null;
          })}
        </G>
      ) : (
        Object.entries(geometry.regions).map(([id, g]) =>
          isDrawablePath(g.d) ? <Path key={id} d={g.d} fill={fills[id] ?? colors.raised} stroke={colors.bg} strokeWidth={0.7} strokeLinejoin="round" /> : null,
        )
      )}
      {outlines.map((o) =>
        geometry.regions[o.regionId] && isDrawablePath(geometry.regions[o.regionId].d) ? (
          <Path
            key={`o-${o.regionId}`}
            d={geometry.regions[o.regionId].d}
            fill="none"
            stroke={o.color}
            strokeWidth={o.width ?? 1.6}
            strokeDasharray={o.dashed ? DASHED : undefined}
            strokeLinejoin="round"
          />
        ) : null,
      )}
      {dots.map((d) =>
        d.glow && allFinite(d.x, d.y) ? <Circle key={`g-${d.key}`} cx={d.x} cy={d.y} r={nonNegative(d.r * 2.2)} fill={d.color} opacity={0.35} /> : null,
      )}
      {dots.map((d) => (allFinite(d.x, d.y) ? <Circle key={d.key} cx={d.x} cy={d.y} r={nonNegative(d.r)} fill={d.color} stroke={colors.bg} strokeWidth={0.6} /> : null))}
    </G>
  );
});
