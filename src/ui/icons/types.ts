import type { ReactElement } from 'react';

/**
 * What every glyph receives. Glyphs are drawn on a 24×24 grid inside a group that already
 * sets `stroke={c}`, `strokeWidth={w}`, `fill="none"` and round caps and joins, so plain
 * outlines need no colour props. Solid parts set `fill={c}` (or `{a}`) with `stroke="none"`;
 * the one highlight uses `a`.
 */
export interface GlyphProps {
  /** Main colour (the `color` prop). */
  c: string;
  /** Highlight colour (the `accent` prop, or `color` when no accent is given). */
  a: string;
  /** Stroke width on the 24 grid. */
  w: number;
}

export type Glyph = (props: GlyphProps) => ReactElement;
