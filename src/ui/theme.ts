/**
 * Colours, type, shape, spacing, radius and motion. The only place UI colours are defined.
 *
 * Six themes with identical token names ("calm lab, loud world", docs/DESIGN.md), chosen
 * at build time by EXPO_PUBLIC_THEME: `neon` (the default), `blueprint`, `hazard`, `candy`,
 * and the retired `paper` and `night`. A theme is a palette, a
 * shape language (corners, line weights, shadows, panel and tile decoration, how the
 * composure system shows) and a type pairing. Components stay shared: they read these
 * tokens instead of branching on the theme name.
 */
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

export type ThemeName = 'paper' | 'night' | 'blueprint' | 'hazard' | 'candy' | 'neon';

export const THEME_NAMES: readonly ThemeName[] = ['paper', 'night', 'blueprint', 'hazard', 'candy', 'neon'];

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
  /** Danger colour of the composure system (graphic use; may be too dark or light for text). */
  alarm: string;
  info: string;
  /** Composure level 1: the rule under the top strip turns this colour. */
  amber: string;
  /** Tabloid black: ticker band, event card ink, stamps. */
  newsInk: string;
  /** Tabloid white: the event card's paper, text on newsInk. */
  newsPaper: string;
  /** Tabloid red: kicker stamps and the BREAKING band. */
  newsRed: string;
  /** Secondary ink on newsPaper. */
  newsDim: string;
  /** Hairlines on newsPaper. */
  newsRule: string;
  /** Good news as text on newsPaper. */
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
  /** Ground pattern: minor grid line (blueprint drafting grid, drawn translucent over the ground). */
  grid: string;
  /** Ground pattern: major grid line every few cells (also candy's polka dots, drawn solid). */
  gridMajor: string;
  /** Hazard stripes: the bright band. */
  stripeA: string;
  /** Hazard stripes: the dark band. */
  stripeB: string;
  /** Strong outlines (sticker edges, chunky button borders, schematic linework). */
  outline: string;
  /** Flat offset shadow under stickers and raised controls. */
  shadow: string;
  /** Composure marks: correction pencil, beacons, warning tape accents. */
  mark: string;
  /** Composure: the colour the ground drains towards (candy) or tints to. */
  drain: string;
  /** The shell's chrome: top strip and tab rail. */
  chrome: string;
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
  grid: '#F4EFE6',
  gridMajor: '#F4EFE6',
  stripeA: '#E4572E',
  stripeB: '#1D1B18',
  outline: '#D8CFBF',
  shadow: '#111111',
  mark: '#C8102E',
  drain: '#F4EFE6',
  chrome: '#F4EFE6',
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
  grid: '#11100E',
  gridMajor: '#11100E',
  stripeA: '#FF6B3D',
  stripeB: '#11100E',
  outline: '#37322A',
  shadow: '#000000',
  mark: '#FF4D5E',
  drain: '#11100E',
  chrome: '#11100E',
};

/**
 * An engineer's drawing: saturated cobalt ground with a drafting grid, white and
 * pale-cyan linework, one signal yellow for the player, red pencil for corrections.
 */
const blueprint: Palette = {
  bg: '#1149C9',
  surface: '#0B3CA6',
  raised: '#0F43B5',
  border: '#7DB6FF',
  text: '#FFFFFF',
  dim: '#BDE0FF',
  player: '#FFD400',
  accent: '#FFD400',
  onPlayer: '#06215F',
  playerText: '#FFD400',
  playerDeep: '#B89A00',
  good: '#86F2BE',
  goodText: '#86F2BE',
  bad: '#FFC2C2',
  alarm: '#FF3B3B',
  info: '#A6EBFF',
  amber: '#FFB547',
  newsInk: '#081634',
  newsPaper: '#FFFFFF',
  newsRed: '#D9142B',
  newsDim: '#4A5468',
  newsRule: '#C7D2E4',
  newsGood: '#13804A',
  newsWash: '#EEF2F8',
  dotRest: '#3F76E3',
  dotBanned: '#082F86',
  offline: '#7393D6',
  scrim: 'rgba(3, 16, 56, 0.62)',
  scrimLight: 'rgba(3, 16, 56, 0.25)',
  transparent: 'transparent',
  grid: '#E6F3FF',
  gridMajor: '#E6F3FF',
  stripeA: '#FFD400',
  stripeB: '#1149C9',
  outline: '#E6F3FF',
  shadow: '#062C86',
  mark: '#FF3B3B',
  drain: '#A3162B',
  chrome: '#0B3CA6',
};

/**
 * Warning-label industrial: near-black ground, safety yellow as the main accent, white
 * type, hazard stripes kept for dividers and critical elements.
 */
const hazard: Palette = {
  bg: '#0E0F11',
  surface: '#17191C',
  raised: '#23262B',
  border: '#3B3F46',
  text: '#F4F4F0',
  dim: '#A3A8B0',
  player: '#FFD000',
  accent: '#FFD000',
  onPlayer: '#0E0F11',
  playerText: '#FFD000',
  playerDeep: '#9C7F00',
  good: '#4FE08F',
  goodText: '#4FE08F',
  bad: '#FF6A5E',
  alarm: '#FF2A1F',
  info: '#6CC8FF',
  amber: '#FF9F1C',
  newsInk: '#000000',
  newsPaper: '#FFFFFF',
  newsRed: '#D90A00',
  newsDim: '#555555',
  newsRule: '#D0D0D0',
  newsGood: '#16794A',
  newsWash: '#F1F1F1',
  dotRest: '#2C3036',
  dotBanned: '#050506',
  offline: '#5B6068',
  scrim: 'rgba(0, 0, 0, 0.7)',
  scrimLight: 'rgba(0, 0, 0, 0.32)',
  transparent: 'transparent',
  grid: '#131417',
  gridMajor: '#17191C',
  stripeA: '#FFD000',
  stripeB: '#0E0F11',
  outline: '#F4F4F0',
  shadow: '#000000',
  mark: '#FF2A1F',
  drain: '#2A0806',
  chrome: '#17191C',
};

/**
 * The over-friendly startup: soft lilac ground, mint and peach stickers with ink
 * outlines and flat offset shadows, hot magenta for the player. News stays stark.
 */
const candy: Palette = {
  bg: '#E4D8FF',
  surface: '#CFF7E6',
  raised: '#FFDCC8',
  border: '#1E1440',
  text: '#1E1440',
  dim: '#544873',
  player: '#F0107F',
  accent: '#F0107F',
  onPlayer: '#FFFFFF',
  playerText: '#B80064',
  playerDeep: '#B0005C',
  good: '#0E9F6A',
  goodText: '#00704A',
  bad: '#B3002A',
  alarm: '#E8003A',
  info: '#2347C4',
  amber: '#FFA51F',
  newsInk: '#000000',
  newsPaper: '#FFFFFF',
  newsRed: '#D40000',
  newsDim: '#555555',
  newsRule: '#D6D6D6',
  newsGood: '#147A44',
  newsWash: '#F1F1F1',
  dotRest: '#C6B4F2',
  dotBanned: '#3A2E5C',
  offline: '#9E91C2',
  scrim: 'rgba(30, 20, 64, 0.55)',
  scrimLight: 'rgba(30, 20, 64, 0.2)',
  transparent: 'transparent',
  grid: '#DCCEFC',
  gridMajor: '#D4C4FA',
  stripeA: '#F0107F',
  stripeB: '#E4D8FF',
  outline: '#1E1440',
  shadow: '#1E1440',
  mark: '#E8003A',
  drain: '#CFCDD6',
  chrome: '#E4D8FF',
};

/**
 * A lab's control room: graphite ground with three clearly separated surface steps,
 * near-white type, one neon green for the player (used sparingly: lines, lit dots, key
 * numbers, the primary action), red for danger and nothing else, a pale teal for good news
 * and a soft sky blue for information. News stays a stark pale card with black ink and red.
 */
const neon: Palette = {
  bg: '#1B1C1F',
  surface: '#24262A',
  raised: '#2F3237',
  border: '#3E4249',
  text: '#EEF0F2',
  dim: '#A0A7AF',
  player: '#45FF5C',
  accent: '#45FF5C',
  onPlayer: '#06140A',
  playerText: '#45FF5C',
  playerDeep: '#1F9E34',
  good: '#7FE6D2',
  goodText: '#7FE6D2',
  bad: '#FF6B6B',
  alarm: '#FF2D3D',
  info: '#8DB9FF',
  amber: '#FFB21E',
  newsInk: '#0B0B0C',
  newsPaper: '#F6F6F2',
  newsRed: '#CF0E25',
  newsDim: '#4B4B50',
  newsRule: '#D2D2CC',
  newsGood: '#12784A',
  newsWash: '#EFEFEA',
  dotRest: '#3B3F45',
  dotBanned: '#6E1C25',
  offline: '#5F656D',
  scrim: 'rgba(8, 9, 10, 0.7)',
  scrimLight: 'rgba(8, 9, 10, 0.3)',
  transparent: 'transparent',
  grid: '#FFFFFF',
  gridMajor: '#FFFFFF',
  stripeA: '#FF2D3D',
  stripeB: '#0B0B0C',
  outline: '#6A7079',
  shadow: '#000000',
  mark: '#FF2D3D',
  drain: '#2B1114',
  chrome: '#131416',
};

/** Every palette (tests check contrast on each). */
export const palettes: Record<ThemeName, Palette> = { paper, night, blueprint, hazard, candy, neon };

/**
 * Shape language of a theme. Components read these instead of branching on the theme:
 * corner radii, line weights, flat shadows, button depth, and which decoration panels,
 * tiles, the ground and the composure overlays draw.
 */
export interface Shape {
  radius: { none: number; xs: number; s: number; l: number; pill: number };
  /** Panel and divider line weight. */
  hairline: number;
  /** Strong outline weight (buttons, tiles, stickers). */
  outline: number;
  /** Offset of the flat shadow under stickers and controls; 0 = none. */
  shadow: number;
  /** Depth of the weighted lower edge of primary buttons. */
  buttonEdge: number;
  /** Size of the clipped corner on panels and buttons (clip panels). */
  clip: number;
  /** Panel decoration: none, drafting corner ticks, clipped corners, sticker (outline + shadow), viewfinder corner brackets. */
  panel: 'plain' | 'ticks' | 'clip' | 'sticker' | 'bracket';
  /** Tree node tiles: plain cards, schematic components, stamped plates, stickers, rack modules (status bar on the left). */
  tile: 'plain' | 'schematic' | 'plate' | 'sticker' | 'module';
  /** Ground behind the map and trees: flat, a drafting grid, polka dots, or a faint instrument dot grid. */
  ground: 'plain' | 'grid' | 'dots' | 'scan';
  /** How the composure system shows (docs/DESIGN.md). */
  composure: 'classic' | 'redline' | 'tape' | 'drain' | 'alert';
  /** Mascot body. */
  mascot: 'square' | 'node' | 'sign' | 'blob' | 'pixel';
  /** Event and composure stamps: solid blocks or outlined rubber stamps. */
  stamp: 'fill' | 'outline';
  /** Calm headings and tab labels in capitals. */
  capsHeadings: boolean;
  /** Stickers sit slightly askew (degrees); composure adds to it. */
  tilt: number;
  /** Rival lab colours keep at least this hue distance (degrees) from the player's. */
  rivalHue: number;
  /** Rival lab colours are lifted this far towards white (dark grounds) or ink (light ones). */
  rivalLift: number;
  /** Rival lab colours keep at least this hue distance (degrees) from the alarm colour; 0 = no rule. */
  rivalAlarmHue: number;
  /** Rival lab colours are saturated to at least this (HSL, 0..1) so they stay vivid; 0 = as they are. */
  rivalSat: number;
  /** Blur radius of the faint glow on active elements (primary button, active tab and speed); 0 = none. */
  glow: number;
}

const soft: Shape = {
  radius: { none: 0, xs: 3, s: 8, l: 14, pill: 999 },
  hairline: StyleSheet.hairlineWidth,
  outline: 1,
  shadow: 0,
  buttonEdge: 3,
  clip: 0,
  panel: 'plain',
  tile: 'plain',
  ground: 'plain',
  composure: 'classic',
  mascot: 'square',
  stamp: 'fill',
  capsHeadings: false,
  tilt: 0,
  rivalHue: 0,
  rivalLift: 0,
  rivalAlarmHue: 0,
  rivalSat: 0,
  glow: 0,
};

export const shapes: Record<ThemeName, Shape> = {
  paper: soft,
  night: soft,
  blueprint: {
    radius: { none: 0, xs: 0, s: 0, l: 0, pill: 0 },
    hairline: 1,
    outline: 1,
    shadow: 0,
    buttonEdge: 0,
    clip: 0,
    panel: 'ticks',
    tile: 'schematic',
    ground: 'grid',
    composure: 'redline',
    mascot: 'node',
    stamp: 'outline',
    capsHeadings: true,
    tilt: 0,
    rivalHue: 40,
    rivalLift: 0.3,
    rivalAlarmHue: 0,
    rivalSat: 0,
    glow: 0,
  },
  hazard: {
    radius: { none: 0, xs: 0, s: 2, l: 2, pill: 2 },
    hairline: 1.5,
    outline: 2,
    shadow: 0,
    buttonEdge: 4,
    clip: 9,
    panel: 'clip',
    tile: 'plate',
    ground: 'plain',
    composure: 'tape',
    mascot: 'sign',
    stamp: 'fill',
    capsHeadings: true,
    tilt: 0,
    rivalHue: 40,
    rivalLift: 0,
    rivalAlarmHue: 0,
    rivalSat: 0,
    glow: 0,
  },
  candy: {
    radius: { none: 0, xs: 8, s: 14, l: 22, pill: 999 },
    hairline: 2,
    outline: 2.5,
    shadow: 3,
    buttonEdge: 0,
    clip: 0,
    panel: 'sticker',
    tile: 'sticker',
    ground: 'plain',
    composure: 'drain',
    mascot: 'blob',
    stamp: 'fill',
    capsHeadings: false,
    tilt: -1.5,
    rivalHue: 45,
    rivalLift: 0.15,
    rivalAlarmHue: 0,
    rivalSat: 0,
    glow: 0,
  },
  neon: {
    radius: { none: 0, xs: 2, s: 3, l: 4, pill: 4 },
    hairline: 1,
    outline: 1,
    shadow: 0,
    buttonEdge: 0,
    clip: 0,
    panel: 'bracket',
    tile: 'module',
    ground: 'scan',
    composure: 'alert',
    mascot: 'pixel',
    stamp: 'fill',
    capsHeadings: true,
    tilt: 0,
    // Rivals sit far from the green (the green rival turns amber, the cyan one sky blue), away from the alarm red (pink turns magenta) and vivid.
    rivalHue: 90,
    rivalLift: 0.08,
    rivalAlarmHue: 38,
    rivalSat: 0.78,
    glow: 8,
  },
};

const KNOWN = new Set<string>(THEME_NAMES);

/** The build theme when EXPO_PUBLIC_THEME is unset or unknown (docs/DESIGN.md says why). */
export const DEFAULT_THEME: ThemeName = 'neon';

/** Resolves EXPO_PUBLIC_THEME; anything unknown is the default. */
export function resolveThemeName(value: string | undefined): ThemeName {
  return value && KNOWN.has(value) ? (value as ThemeName) : DEFAULT_THEME;
}

/** Chosen at build time: Expo inlines EXPO_PUBLIC_* variables into the bundle. */
export const themeName: ThemeName = resolveThemeName(process.env.EXPO_PUBLIC_THEME);

export const colors: Palette = palettes[themeName];

export const shape: Shape = shapes[themeName];

/** True when the theme's ground is dark (status bar, readable-colour direction). */
export const darkThemes: Record<ThemeName, boolean> = { paper: false, night: true, blueprint: true, hazard: true, candy: false, neon: true };
export const isDark: boolean = darkThemes[themeName];

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;

/** Corner radii of the active theme (the loud voice uses `radius.none`). */
export const radius = shape.radius;

export const type = { xs: 11, s: 13, m: 15, l: 18, xl: 24, display: 40 } as const;

/**
 * Flat offset shadow (sticker look) as a style, or nothing when the theme has none.
 * `boxShadow` works on web and on native (new architecture).
 */
export function flatShadow(offset: number = shape.shadow, color: string = colors.shadow): ViewStyle {
  return offset > 0 ? { boxShadow: `${offset}px ${offset}px 0px ${color}` } : {};
}

/**
 * A faint glow around an active element (neon: the primary button, the active tab and speed),
 * or nothing when the theme has none. `inset` keeps it inside the element.
 */
export function glow(color: string = colors.player, opts: { inset?: boolean; strength?: number } = {}): ViewStyle {
  if (shape.glow <= 0) return {};
  const r = shape.glow * (opts.strength ?? 1);
  return { boxShadow: `${opts.inset ? 'inset ' : ''}0px 0px ${r}px ${color}` };
}

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

/**
 * Stacking order of the in-tree overlays at the root of a screen (zIndex and Android
 * elevation). Higher draws above lower: sheets live inside the shell; toasts sit above
 * the shell; the tutorial's dim and captions cover both; the event card covers everything
 * (the tutorial waits behind it, except the one caption that explains it); the error
 * screen covers the event card.
 */
export const layer = {
  sheet: 10,
  toast: 30,
  tutorial: 40,
  event: 50,
  /** Tutorial captions that explain the event card sit over it. */
  tutorialOverEvent: 60,
  error: 100,
} as const;

/** Minimum touch target (points). */
export const touch = 44;

/** Text style for numbers that change every tick. */
export const tabular = { fontVariant: ['tabular-nums' as const] };

/** The roles a theme assigns a face to. */
export interface FontRoles {
  /** Calm headings (lab name, panel titles, endings). */
  heading: string;
  /** Numbers that change (resources, meters). */
  number: string;
  /** Small labels over calm content. */
  label: string;
  /** Running text. */
  body: string;
  /** Running text, bold (buttons, tile names). */
  bodyBold: string;
  /** Loud voice: ticker and running news text. */
  news: string;
  /** Loud voice: kickers and headlines. */
  newsHeavy: string;
}

/**
 * Bundled font faces per theme (only the active theme's faces are loaded, src/ui/fonts.ts).
 * On web each family carries a CSS fallback stack, so text shows in a system face while
 * loading or if loading fails; on native an unknown family falls back to the system font.
 */
export const themeFontFaces: Record<ThemeName, FontRoles> = {
  paper: {
    heading: 'Fraunces_600SemiBold',
    number: 'Fraunces_500Medium',
    label: '',
    body: '',
    bodyBold: '',
    news: 'BarlowCondensed_700Bold',
    newsHeavy: 'BarlowCondensed_800ExtraBold',
  },
  night: {
    heading: 'Fraunces_600SemiBold',
    number: 'Fraunces_500Medium',
    label: '',
    body: '',
    bodyBold: '',
    news: 'BarlowCondensed_700Bold',
    newsHeavy: 'BarlowCondensed_800ExtraBold',
  },
  blueprint: {
    heading: 'B612_700Bold',
    number: 'B612_400Regular',
    label: 'B612Mono_400Regular',
    body: 'HankenGrotesk_400Regular',
    bodyBold: 'HankenGrotesk_600SemiBold',
    news: 'SofiaSansExtraCondensed_700Bold',
    newsHeavy: 'SofiaSansExtraCondensed_800ExtraBold',
  },
  hazard: {
    heading: 'BigShoulders_900Black',
    number: 'BigShouldersStencil_800ExtraBold',
    label: 'Barlow_600SemiBold',
    body: 'Barlow_500Medium',
    bodyBold: 'Barlow_700Bold',
    news: 'BigShoulders_700Bold',
    newsHeavy: 'BigShoulders_900Black',
  },
  candy: {
    heading: 'Fredoka_700Bold',
    number: 'Fredoka_600SemiBold',
    label: 'Fredoka_600SemiBold',
    body: 'Fredoka_500Medium',
    bodyBold: 'Fredoka_600SemiBold',
    news: 'Anton_400Regular',
    newsHeavy: 'Anton_400Regular',
  },
  neon: {
    heading: 'ChakraPetch_600SemiBold',
    number: 'AzeretMono_500Medium',
    label: 'AzeretMono_500Medium',
    body: 'InstrumentSans_400Regular',
    bodyBold: 'InstrumentSans_600SemiBold',
    news: 'SairaExtraCondensed_700Bold',
    newsHeavy: 'SairaExtraCondensed_800ExtraBold',
  },
};

/** The active theme's faces by role ('' = the system face). */
export const fontFaces: FontRoles = themeFontFaces[themeName];

const FALLBACK: Record<keyof FontRoles, string> = {
  heading: themeName === 'night' || themeName === 'paper' ? 'Georgia, "Times New Roman", serif' : 'system-ui, sans-serif',
  number: 'ui-monospace, Menlo, monospace',
  label: 'system-ui, sans-serif',
  body: 'system-ui, sans-serif',
  bodyBold: 'system-ui, sans-serif',
  news: '"Arial Narrow", "Roboto Condensed", Impact, sans-serif',
  newsHeavy: '"Arial Narrow", "Roboto Condensed", Impact, sans-serif',
};

function family(role: keyof FontRoles): string | undefined {
  const face = fontFaces[role];
  if (!face) return undefined;
  return Platform.OS === 'web' ? `${face}, ${FALLBACK[role]}` : face;
}

/** Font families by role for the active theme (undefined = system face). */
export const fonts = {
  heading: family('heading'),
  number: family('number'),
  label: family('label'),
  body: family('body'),
  bodyBold: family('bodyBold'),
  news: family('news'),
  newsHeavy: family('newsHeavy'),
  /** Kept for existing call sites: the calm heading face. */
  serif: family('heading'),
  serifNumber: family('number'),
} as const;

/** A bundled face carries its own weight; the system face needs fontWeight. */
const bold = (role: keyof FontRoles, weight: TextStyle['fontWeight']): TextStyle => (fontFaces[role] ? { fontFamily: family(role) } : { fontWeight: weight });

interface VoiceSet {
  calmHeading: TextStyle;
  calmNumber: TextStyle;
  calmLabel: TextStyle;
  body: TextStyle;
  bodyStrong: TextStyle;
  loudKicker: TextStyle;
  loudHeadline: TextStyle;
  loudBody: TextStyle;
}

const NUM: TextStyle['fontVariant'] = ['tabular-nums', 'lining-nums'];

function voiceFor(name: ThemeName): VoiceSet {
  const base: VoiceSet = {
    calmHeading: { fontFamily: fonts.heading, fontSize: type.l, letterSpacing: -0.2 },
    calmNumber: { fontFamily: fonts.number, fontSize: type.m, fontVariant: NUM },
    calmLabel: { fontFamily: fonts.label, fontSize: type.xs - 1, letterSpacing: 0.4, textTransform: 'uppercase' },
    body: { fontFamily: fonts.body },
    bodyStrong: bold('bodyBold', '700'),
    loudKicker: { fontFamily: fonts.newsHeavy, fontSize: type.s, letterSpacing: 1.4, textTransform: 'uppercase' },
    loudHeadline: { fontFamily: fonts.newsHeavy, fontSize: 30, lineHeight: 30, letterSpacing: -0.2, textTransform: 'uppercase' },
    loudBody: { fontFamily: fonts.news, fontSize: type.s, letterSpacing: 0.5, textTransform: 'uppercase' },
  };
  switch (name) {
    case 'blueprint':
      return {
        ...base,
        calmHeading: { fontFamily: fonts.heading, fontSize: type.m, letterSpacing: 0.6, textTransform: 'uppercase' },
        calmNumber: { fontFamily: fonts.number, fontSize: type.m, letterSpacing: -0.3, fontVariant: NUM },
        calmLabel: { fontFamily: fonts.label, fontSize: type.xs - 2, letterSpacing: 0.2, textTransform: 'uppercase' },
        loudHeadline: { ...base.loudHeadline, fontSize: 34, lineHeight: 32, letterSpacing: 0 },
      };
    case 'hazard':
      return {
        ...base,
        calmHeading: { fontFamily: fonts.heading, fontSize: type.l + 2, letterSpacing: 0.6, textTransform: 'uppercase' },
        calmNumber: { fontFamily: fonts.number, fontSize: type.l, letterSpacing: 0.4, fontVariant: NUM },
        calmLabel: { fontFamily: fonts.label, fontSize: type.xs - 1, letterSpacing: 0.7, textTransform: 'uppercase' },
        loudKicker: { ...base.loudKicker, letterSpacing: 2 },
        loudHeadline: { ...base.loudHeadline, fontSize: 36, lineHeight: 34, letterSpacing: 0.4 },
        loudBody: { ...base.loudBody, letterSpacing: 1 },
      };
    case 'neon':
      return {
        ...base,
        calmHeading: { fontFamily: fonts.heading, fontSize: type.m, letterSpacing: 0.8, textTransform: 'uppercase' },
        calmNumber: { fontFamily: fonts.number, fontSize: type.m, letterSpacing: -0.4, fontVariant: NUM },
        calmLabel: { fontFamily: fonts.label, fontSize: type.xs - 2, letterSpacing: 0.3, textTransform: 'uppercase' },
        loudKicker: { ...base.loudKicker, letterSpacing: 1.6 },
        loudHeadline: { ...base.loudHeadline, fontSize: 36, lineHeight: 34, letterSpacing: 0.2 },
        loudBody: { ...base.loudBody, letterSpacing: 0.8 },
      };
    case 'candy':
      return {
        ...base,
        calmHeading: { fontFamily: fonts.heading, fontSize: type.l, letterSpacing: -0.1 },
        calmNumber: { fontFamily: fonts.number, fontSize: type.m, fontVariant: NUM },
        calmLabel: { fontFamily: fonts.label, fontSize: type.xs - 1, letterSpacing: 0.2, textTransform: 'lowercase' },
        loudKicker: { ...base.loudKicker, letterSpacing: 1.6 },
        loudHeadline: { ...base.loudHeadline, fontSize: 32, lineHeight: 34, letterSpacing: 0.2 },
        loudBody: { ...base.loudBody, letterSpacing: 0.8 },
      };
    default:
      return {
        ...base,
        calmHeading: { fontFamily: fonts.serif, fontSize: type.l, letterSpacing: -0.2 },
        calmLabel: { fontSize: type.xs - 1, letterSpacing: 0.4, textTransform: 'uppercase' },
      };
  }
}

/**
 * Text presets: the calm voice (the lab) and the loud voice (the world), per theme.
 * Use these instead of ad hoc font settings; add size and colour at the call site.
 * - calmHeading: lab name, headings, endings. calmNumber: resource values (tabular).
 * - calmLabel: small captions over calm content. body / bodyStrong: running text and buttons.
 * - loudKicker, loudHeadline, loudBody: the tabloid voice (always capitals).
 */
export const voice: VoiceSet = voiceFor(themeName);

/** Motion: everything eases out and stays under 400 ms unless it is ambient. */
export const motion = {
  fast: 160,
  base: 260,
  slow: 380,
  /** Composure level transitions. */
  composure: 600,
} as const;

export const theme = { name: themeName, colors, shape, spacing, radius, type, layout, layer, touch, tabular, voice, fonts, motion, player: colors.player } as const;
export type Theme = typeof theme;
