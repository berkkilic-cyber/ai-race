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

/** Shell sizes for the wide (landscape) layout, in points. */
export const layout = {
  /** A window is "wide" when width > height and width >= this. */
  wideMinWidth: 600,
  /** Left tab rail. */
  railWidth: 56,
  /** Height of one tab in the rail. */
  railItemHeight: 56,
  /** Top strip with name, day, resources, meters and speed. */
  stripHeight: 40,
  /** Slim ticker along the bottom of the main area. */
  tickerHeight: 28,
  /** Right-hand side panel (Sheet in wide mode). */
  panelWidth: 360,
  /** The panel never takes more than this fraction of the window width. */
  panelMaxFraction: 0.5,
  /** ModalCard maximum width in wide mode. */
  modalMaxWidth: 640,
  /** Compact speed buttons in the top strip. */
  speedButton: 32,
} as const;

/** Minimum touch target (points). */
export const touch = 44;

/** Text style for numbers that change every tick. */
export const tabular = { fontVariant: ['tabular-nums' as const] };

export const theme = { colors, spacing, radius, type, layout, touch, tabular, player: colors.player } as const;
export type Theme = typeof theme;
