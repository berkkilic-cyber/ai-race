import { memo, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import { t } from '../i18n';
import { shakeAt, useAmbientClock, useAmbientRunning, wave } from '../motion/ambient';
import { colors, shape } from '../theme';
import type { MascotMood } from './mood';

export interface MascotProps {
  mood: MascotMood;
  /** Side length in points. Default 28. */
  size?: number;
  /** Blinks every few seconds. Default true. */
  blinks?: boolean;
  testID?: string;
}

/** Moods drawn with plain dot eyes, which close briefly when the face blinks. */
const DOT_EYES: ReadonlySet<MascotMood> = new Set(['calm', 'uneasy', 'sweating']);
const BLINK_MS = 130;

function useBlink(enabled: boolean): boolean {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setClosed(true);
        timer = setTimeout(() => {
          setClosed(false);
          schedule();
        }, BLINK_MS);
      }, 2600 + Math.random() * 2600);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled]);
  return closed;
}

function Face({ mood, blink, ink }: { mood: MascotMood; blink: boolean; ink: string }) {
  const line = { stroke: ink, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const closedEyes = <Path d="M9 14.5H13M19 14.5H23" {...line} />;
  switch (mood) {
    case 'pleased':
      return (
        <G>
          <Path d="M9 15.2Q11 12.2 13 15.2M19 15.2Q21 12.2 23 15.2" {...line} />
          <Path d="M12.5 20Q16 23.8 19.5 20" {...line} />
        </G>
      );
    case 'smug':
      return (
        <G>
          <Path d="M9 14.2H13M19 14.2H23" {...line} />
          <Circle cx={12} cy={15.6} r={1.1} fill={ink} />
          <Circle cx={22} cy={15.6} r={1.1} fill={ink} />
          <Path d="M13 21.6Q17.5 22.4 20 19.6" {...line} />
        </G>
      );
    case 'uneasy':
      return (
        <G>
          {blink ? closedEyes : (
            <G>
              <Circle cx={12.6} cy={14.4} r={2} fill={ink} />
              <Circle cx={22.6} cy={14.4} r={2} fill={ink} />
            </G>
          )}
          <Path d="M12.5 21.8q1.75-1.6 3.5 0t3.5 0" {...line} />
        </G>
      );
    case 'sweating':
      return (
        <G>
          {blink ? closedEyes : (
            <G>
              <Circle cx={11} cy={14.6} r={2} fill={ink} />
              <Circle cx={21} cy={14.6} r={2} fill={ink} />
            </G>
          )}
          <Path d="M14 21.6H18" {...line} />
          <Path d="M26.2 4.6C28.4 8 28.8 9.8 26.2 10.9C23.6 9.8 24 8 26.2 4.6Z" fill={colors.info} stroke={ink} strokeWidth={1} />
        </G>
      );
    case 'panicking':
      return (
        <G>
          <Circle cx={11} cy={14} r={2.8} fill="none" stroke={ink} strokeWidth={1.7} />
          <Circle cx={21} cy={14} r={2.8} fill="none" stroke={ink} strokeWidth={1.7} />
          <Circle cx={11} cy={14} r={0.9} fill={ink} />
          <Circle cx={21} cy={14} r={0.9} fill={ink} />
          <Ellipse cx={16} cy={22.2} rx={2.3} ry={2.9} fill={ink} />
        </G>
      );
    case 'asleep':
      return (
        <G>
          <Path d="M9 14.6Q11 16.6 13 14.6M19 14.6Q21 16.6 23 14.6" {...line} />
          <Path d="M15 21.6H17" {...line} />
        </G>
      );
    case 'calm':
    default:
      return (
        <G>
          {blink ? closedEyes : (
            <G>
              <Circle cx={11} cy={14.4} r={2} fill={ink} />
              <Circle cx={21} cy={14.4} r={2} fill={ink} />
            </G>
          )}
          <Path d="M13.5 21H18.5" {...line} />
        </G>
      );
  }
}

/**
 * Neon: the face as lit pixels on a small display, 10 columns by up to 6 rows ('#' = lit).
 * The eyes are 2 or 3 pixels wide; the mouth sits two rows under them.
 */
const PIXEL_FACES: Record<MascotMood | 'blink' | 'blinkUneasy', readonly string[]> = {
  calm: ['..........', '.##....##.', '.##....##.', '..........', '...####...'],
  blink: ['..........', '..........', '.##....##.', '..........', '...####...'],
  pleased: ['..#....#..', '.#.#..#.#.', '..........', '.#......#.', '..######..'],
  smug: ['..........', '.###..###.', '..##...##.', '........#.', '....####..'],
  uneasy: ['..........', '..##...##.', '..##...##.', '...#..#...', '..#.##.#..'],
  blinkUneasy: ['..........', '..........', '..##...##.', '...#..#...', '..#.##.#..'],
  sweating: ['..........', '.##....##.', '.##....##.', '..........', '....##....'],
  panicking: ['.###..###.', '.#.#..#.#.', '.###..###.', '..........', '...####...', '...#..#...'],
  asleep: ['..........', '..........', '.###..###.', '..........', '....##....'],
};
const PIXEL = 2;
const PIXEL_X = 6;
const PIXEL_Y = 9.5;

/** The lit colour of the neon face: green while things are fine, amber when worried, red in a panic. */
function pixelInk(mood: MascotMood): string {
  if (mood === 'panicking') return colors.alarm;
  if (mood === 'uneasy' || mood === 'sweating') return colors.amber;
  if (mood === 'asleep') return colors.dim;
  return colors.player;
}

/**
 * Neon: a small display module with a pixel face, as if one of the control room's status
 * screens had woken up: graphite screen, a hairline bezel and two feet, the face lit in the
 * mood's colour (green, amber, red), a status pixel in the corner.
 */
function PixelBody({ mood, blink }: { mood: MascotMood; blink: boolean }) {
  const ink = pixelInk(mood);
  const rows = blink && mood === 'uneasy' ? PIXEL_FACES.blinkUneasy : blink && DOT_EYES.has(mood) ? PIXEL_FACES.blink : PIXEL_FACES[mood];
  const top = PIXEL_Y - (rows.length > 5 ? PIXEL : 0);
  return (
    <G>
      <Rect x={8.5} y={27.4} width={4} height={2.6} fill={colors.outline} />
      <Rect x={19.5} y={27.4} width={4} height={2.6} fill={colors.outline} />
      <Rect x={2.6} y={3.6} width={26.8} height={24.4} rx={3} fill={colors.surface} stroke={ink} strokeWidth={1.4} />
      <Rect x={4.6} y={5.6} width={22.8} height={20.4} rx={1.5} fill={colors.chrome} />
      {rows.flatMap((row, y) =>
        row.split('').map((c, x) => (c === '#' ? <Rect key={`${x}-${y}`} x={PIXEL_X + x * PIXEL} y={top + y * PIXEL} width={PIXEL} height={PIXEL} fill={ink} /> : null)),
      )}
      {mood === 'sweating' ? <Rect x={24.2} y={7.4} width={1.6} height={3.2} fill={colors.info} /> : null}
      <Rect x={24.4} y={23.2} width={1.6} height={1.6} fill={ink} opacity={mood === 'asleep' ? 0.5 : 1} />
    </G>
  );
}

/** Pin rows of the blueprint chip (y of each pin on both sides). */
const PINS = [10.5, 16, 21.5] as const;

/** Wobbly sticker outline for candy (an original blob, not a circle). */
const BLOB = 'M15 3.4C19.4 2.4 22.2 4.4 25 5.9C28.9 8 29.9 12.2 29.1 16.8C28.2 22.6 24.4 28.6 16.4 28.7C8.6 28.8 3.1 24.2 3.2 16.4C3.3 10.8 6 4.9 15 3.4Z';

/**
 * Body and face placement per theme (shape.mascot):
 * - square: a soft rounded square in the accent (paper, night);
 * - node: a signal-yellow schematic chip with pin stubs and a pin-1 notch, the same symbol as the tree tiles (blueprint);
 * - sign: a warning-triangle face (hazard);
 * - blob: a magenta sticker blob with an ink outline and a flat shadow (candy);
 * - pixel: a small display module with a pixel face lit green, amber or red by mood (neon).
 */
function Body({ mood, blink }: { mood: MascotMood; blink: boolean }) {
  switch (shape.mascot) {
    case 'pixel':
      return <PixelBody mood={mood} blink={blink} />;
    case 'node':
      return (
        <G>
          {PINS.map((y) => (
            <G key={y}>
              <Line x1={1.2} y1={y} x2={6.5} y2={y} stroke={colors.outline} strokeWidth={1.5} />
              <Line x1={25.5} y1={y} x2={30.8} y2={y} stroke={colors.outline} strokeWidth={1.5} />
            </G>
          ))}
          <Rect x={6} y={4.5} width={20} height={23} fill={colors.player} stroke={colors.outline} strokeWidth={1.2} />
          <Path d="M13.2 4.5A2.8 2.8 0 0 0 18.8 4.5" fill="none" stroke={colors.onPlayer} strokeWidth={1.2} />
          <G transform="translate(5.6 7.4) scale(0.65)">
            <Face mood={mood} blink={blink} ink={colors.onPlayer} />
          </G>
        </G>
      );
    case 'sign':
      return (
        <G>
          <Polygon points="16,1.6 31,28.6 1,28.6" fill={colors.player} stroke={colors.player} strokeWidth={1.5} strokeLinejoin="round" />
          <Polygon points="16,6.4 26.6,25.8 5.4,25.8" fill="none" stroke={colors.onPlayer} strokeWidth={1.7} strokeLinejoin="miter" />
          <G transform="translate(7.2 9.6) scale(0.55)">
            <Face mood={mood} blink={blink} ink={colors.onPlayer} />
          </G>
        </G>
      );
    case 'blob':
      return (
        <G transform="rotate(-6 16 16)">
          <Path d={BLOB} fill={colors.shadow} transform="translate(1.6 1.8)" />
          <Path d={BLOB} fill={colors.player} stroke={colors.outline} strokeWidth={2} strokeLinejoin="round" />
          <Path d="M8.6 9.6Q10 7.4 12.4 6.6" stroke={colors.onPlayer} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.8} />
          <G transform="translate(1.2 1.4) scale(0.92)">
            <Face mood={mood} blink={blink} ink={colors.outline} />
          </G>
        </G>
      );
    case 'square':
    default:
      return (
        <G>
          <Rect x={2} y={2} width={28} height={28} rx={9} fill={colors.player} />
          <Face mood={mood} blink={blink} ink={colors.onPlayer} />
        </G>
      );
  }
}

/**
 * The player's model as a face, in the theme's body (see Body) with two eyes and a short
 * mouth. Seven moods; blinks; reacts to a mood change with a small pop,
 * shakes while panicking and breathes while asleep (both off with reduced motion).
 */
export const Mascot = memo(function Mascot({ mood, size = 28, blinks = true, testID }: MascotProps) {
  const reduced = useReducedMotion();
  // Blinks while ambient motion runs (always outside the game shell).
  const ambientRunning = useAmbientRunning();
  const blink = useBlink(blinks && DOT_EYES.has(mood) && ambientRunning !== false);
  const pop = useSharedValue(1);
  // Shake (panicking) and breath (asleep) come from the shell's shared ambient clock.
  const panicking = mood === 'panicking';
  const asleep = mood === 'asleep';
  const clock = useAmbientClock((panicking || asleep) && !reduced);

  useEffect(() => {
    if (reduced) return;
    pop.set(withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 260 })));
  }, [mood, reduced, pop]);

  const style = useAnimatedStyle(() => {
    const t = clock ? clock.get() : 0;
    return {
      transform: [{ translateX: panicking ? shakeAt(t, 0.88, 1.2, 0.06) : 0 }, { scale: pop.get() }, { scaleY: asleep ? 1 - 0.06 * wave(t, 2.8) : 1 }],
    };
  });

  return (
    <View accessibilityRole="image" accessibilityLabel={t('ui.mascot.label', { mood: t(`ui.mascot.mood.${mood}`) })} testID={testID}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox="0 0 32 32">
          <Body mood={mood} blink={blink} />
          {mood === 'asleep' ? <Path d="M24 3.2h4l-4 4h4" stroke={colors.dim} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </Svg>
      </Animated.View>
    </View>
  );
});
