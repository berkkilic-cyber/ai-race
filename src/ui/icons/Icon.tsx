/**
 * The game's icon set, drawn as code on a 24×24 grid.
 *
 *   <Icon name="cap-gpu-lease" size={24} color={colors.text} accent={colors.player} />
 *
 * Icons carry no colours of their own: `color` draws the outline and solid parts, the
 * optional `accent` draws one highlight (it falls back to `color`). Unknown names draw a
 * neutral fallback tile so a missing drawing never breaks a screen.
 */
import Svg, { G } from 'react-native-svg';

import { finiteOr, nonNegative } from '../map/svgSafe';
import { iconNames, type IconName } from './names';
import { fallbackGlyph, registry } from './registry';

export { iconGroups, iconNames, type IconName } from './names';

export interface IconProps {
  /** An `IconName`; any other string draws the fallback glyph. */
  name: IconName | (string & {});
  /** Rendered width and height in px. Default 24. */
  size?: number;
  /** Main stroke and fill colour. */
  color: string;
  /** Colour of the one highlight. Default: `color`. */
  accent?: string;
  /** Stroke width on the 24 grid (scales with size). Default 1.75. */
  strokeWidth?: number;
  testID?: string;
}

const known = new Set<string>(iconNames);

/** True when `name` has a drawing. */
export function hasIcon(name: string): name is IconName {
  return known.has(name);
}

export function Icon({ name, size = 24, color, accent, strokeWidth = 1.75, testID }: IconProps) {
  const Glyph = hasIcon(name) ? registry[name] : fallbackGlyph;
  const px = nonNegative(size);
  const w = finiteOr(strokeWidth, 1.75);
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24" testID={testID}>
      <G stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Glyph c={color} a={accent ?? color} w={w} />
      </G>
    </Svg>
  );
}
