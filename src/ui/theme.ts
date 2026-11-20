/**
 * Colours, type, spacing, radius and motion. The only place UI colours are defined.
 *
 * Two palettes with identical token names ("calm lab, loud world", docs/DESIGN.md),
 * chosen at build time by EXPO_PUBLIC_THEME: `paper` (default) or `night`.
 */
import { Platform, type TextStyle } from 'react-native';

export type ThemeName = 'paper' | 'night';

export interface Palette {
  /** Page background. */
  bg: string;
  /** Panels and sheets. */
  surface: string;
  /** Raised surface: tracks, chips, untouched shapes. */
  raised: string;
  /** Thin rules and outlines. */
  border: string;
  /** Body ink. */
  text: string;
  /** Secondary text (passes 4.5:1 on bg and surface). */
  dim: string;
  /** Player colour and the one confident accent. */
  player: string;
  /** Same as player: the brand accent. */
  accent: string;
  /** Text and marks on the accent. */
  onPlayer: string;
  /** The accent when used as small text on bg or surface (passes 4.5:1). */
  playerText: string;
  /** Deeper accent: the weighted lower edge of primary buttons. */
  playerDeep: string;
  good: string;
  /** `good` when used as small text on bg or surface (passes 4.5:1). */
  goodText: string;
  bad: string;
  /** Danger colour of the composure system (same as bad). */
  alarm: string;
  info: string;
  /** Composure level 1: the rule under the top strip turns this colour. */
  amber: string;
  /** Tabloid black: ticker band, event card ink, stamps. */
  newsInk: string;
  /** Tabloid white: the event card's paper, text on newsInk. */
  newsPaper: string;
  /** Tabloid red: kicker stamps and the BREAKING band (identical role on both themes). */
  newsRed: string;
  /** Secondary ink on newsPaper. */
  newsDim: string;
  /** Hairlines on newsPaper. */
  newsRule: string;
  /** Good news as text on newsPaper (both themes). */
  newsGood: string;
  /** A faint wash on newsPaper (disabled choices, table stripes). */
  newsWash: string;
  /** Map: a dot nobody has lit. */
  dotRest: string;
  /** Map: dots of a region where the player is banned. */
  dotBanned: string;
  /** Offline data centres. */
  offline: string;
  scrim: string;
  scrimLight: string;
  transparent: string;
}

const paper: Palette = {
  bg: '#F4EFE6',
  surface: '#FBF8F2',
  raised: '#EAE3D6',
  border: '#D8CFBF',
  text: '#1D1B18',
  dim: '#6B6459',
  player: '#E4572E',
  accent: '#E4572E',
  onPlayer: '#FFFFFF',
  playerText: '#B83C17',
  playerDeep: '#A93A17',
  good: '#2F8F5B',
  goodText: '#24714A',
  bad: '#C8102E',
  alarm: '#C8102E',
  info: '#2C5FA8',
  amber: '#D9971A',
  newsInk: '#111111',
  newsPaper: '#FFFFFF',
  newsRed: '#C8102E',
  newsDim: '#555555',
  newsRule: '#D9D9D9',
  newsGood: '#1E7A47',
  newsWash: '#F2F0EC',
  dotRest: '#CFC5B3',
  dotBanned: '#4A433A',
  offline: '#A39B8E',
  scrim: 'rgba(29, 27, 24, 0.55)',
  scrimLight: 'rgba(29, 27, 24, 0.22)',
  transparent: 'transparent',
};

const night: Palette = {
  bg: '#11100E',
  surface: '#1A1815',
  raised: '#25221D',
  border: '#37322A',
  text: '#F1EBDD',
  dim: '#9A9284',
  player: '#FF6B3D',
  accent: '#FF6B3D',
  onPlayer: '#11100E',
  playerText: '#FF6B3D',
  playerDeep: '#B9431E',
  good: '#5BC98A',
  goodText: '#5BC98A',
  bad: '#FF4D5E',
  alarm: '#FF4D5E',
  info: '#7FB2F5',
  amber: '#F2B544',
  newsInk: '#000000',
  newsPaper: '#FFFFFF',
  newsRed: '#D7192F',
  newsDim: '#555555',
  newsRule: '#D9D9D9',
  newsGood: '#1E7A47',
  newsWash: '#F2F0EC',
  dotRest: '#3A352D',
  dotBanned: '#050505',
  offline: '#5E584E',
  scrim: 'rgba(0, 0, 0, 0.66)',
  scrimLight: 'rgba(0, 0, 0, 0.3)',
  transparent: 'transparent',
};

/** Both palettes (tests check contrast on each). */
export const palettes: Record<ThemeName, Palette> = { paper, night };

/** Resolves EXPO_PUBLIC_THEME; anything but `night` is `paper`. */
export function resolveThemeName(value: string | undefined): ThemeName {
  return value === 'night' ? 'night' : 'paper';
}

/** Chosen at build time: Expo inlines EXPO_PUBLIC_* variables into the bundle. */
export const themeName: ThemeName = resolveThemeName(process.env.EXPO_PUBLIC_THEME);

export const colors: Palette = palettes[themeName];

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;

/** The calm voice is soft; the loud voice uses `radius.none`. */
export const radius = { none: 0, xs: 3, s: 8, l: 14, pill: 999 } as const;

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

/**
 * Bundled font faces (loaded in app/_layout.tsx with expo-font). On web each family
 * carries a CSS fallback stack, so text shows in a system face while loading or if
 * loading fails; on native an unknown family falls back to the system font.
 */
export const fontFaces = {
  serif: 'Fraunces_600SemiBold',
  serifNumber: 'Fraunces_500Medium',
  news: 'BarlowCondensed_700Bold',
  newsHeavy: 'BarlowCondensed_800ExtraBold',
} as const;

const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';
const NEWS_FALLBACK = '"Arial Narrow", "Roboto Condensed", Impact, sans-serif';

function family(face: string, fallback: string): string {
  return Platform.OS === 'web' ? `${face}, ${fallback}` : face;
}

export const fonts = {
  serif: family(fontFaces.serif, SERIF_FALLBACK),
  serifNumber: family(fontFaces.serifNumber, SERIF_FALLBACK),
  news: family(fontFaces.news, NEWS_FALLBACK),
  newsHeavy: family(fontFaces.newsHeavy, NEWS_FALLBACK),
} as const;

/**
 * Text presets: the calm voice (the lab) and the loud voice (the world).
 * Use these instead of ad hoc font settings; add size and colour at the call site.
 */
export const voice = {
  /** Lab name, headings, endings: display serif. */
  calmHeading: { fontFamily: fonts.serif, fontSize: type.l, letterSpacing: -0.2 } satisfies TextStyle,
  /** Resource values and other numbers that change: serif with tabular figures. */
  calmNumber: { fontFamily: fonts.serifNumber, fontSize: type.m, fontVariant: ['tabular-nums', 'lining-nums'] } satisfies TextStyle,
  /** Small caption over calm content (labels, units). System sans. */
  calmLabel: { fontSize: type.xs - 1, letterSpacing: 0.4, textTransform: 'uppercase' } satisfies TextStyle,
  /** Tabloid kicker: condensed, heavy, uppercase, tracked out. */
  loudKicker: { fontFamily: fonts.newsHeavy, fontSize: type.s, letterSpacing: 1.4, textTransform: 'uppercase' } satisfies TextStyle,
  /** Tabloid headline: condensed, heavy, uppercase, tight. */
  loudHeadline: { fontFamily: fonts.newsHeavy, fontSize: 30, lineHeight: 30, letterSpacing: -0.2, textTransform: 'uppercase' } satisfies TextStyle,
  /** Ticker and other running news text. */
  loudBody: { fontFamily: fonts.news, fontSize: type.s, letterSpacing: 0.5, textTransform: 'uppercase' } satisfies TextStyle,
} as const;

/** Motion: everything eases out and stays under 400 ms unless it is ambient. */
export const motion = {
  fast: 160,
  base: 260,
  slow: 380,
  /** Composure level transitions. */
  composure: 600,
} as const;

export const theme = { name: themeName, colors, spacing, radius, type, layout, touch, tabular, voice, fonts, motion, player: colors.player } as const;
export type Theme = typeof theme;
