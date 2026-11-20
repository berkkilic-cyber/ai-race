/** Colours, spacing, radius and type sizes. The only place UI colours and sizes are defined. */
export const colors = {
  bg: '#0B1620',
  surface: '#132434',
  raised: '#1B3246',
  border: '#26435A',
  text: '#EAF2F8',
  dim: '#8CA3B5',
  /** Player colour and primary accent. Use dark text on it. */
  player: '#F2B544',
  onPlayer: '#0B1620',
  good: '#4ADE80',
  bad: '#F87171',
  info: '#5CC8FF',
  offline: '#6B7C8A',
  scrim: 'rgba(5, 10, 15, 0.72)',
  scrimLight: 'rgba(5, 10, 15, 0.35)',
  transparent: 'transparent',
} as const;

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;

export const radius = { s: 10, l: 16, pill: 999 } as const;

export const type = { xs: 11, s: 13, m: 15, l: 18, xl: 24, display: 40 } as const;

/** Minimum touch target (points). */
export const touch = 44;

/** Text style for numbers that change every tick. */
export const tabular = { fontVariant: ['tabular-nums' as const] };

export const theme = { colors, spacing, radius, type, touch, tabular, player: colors.player } as const;
export type Theme = typeof theme;
