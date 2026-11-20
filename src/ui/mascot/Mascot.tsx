import { memo, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { t } from '../i18n';
import { shakeAt, useAmbientClock, useAmbientRunning, wave } from '../motion/ambient';
import { colors } from '../theme';
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

function Face({ mood, blink }: { mood: MascotMood; blink: boolean }) {
  const ink = colors.onPlayer;
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
 * The player's model as a face: a soft rounded square in the accent colour with two dot
 * eyes and a short mouth. Seven moods; blinks; reacts to a mood change with a small pop,
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
          <Rect x={2} y={2} width={28} height={28} rx={9} fill={colors.player} />
          <Face mood={mood} blink={blink} />
          {mood === 'asleep' ? <Path d="M24 3.2h4l-4 4h4" stroke={colors.dim} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </Svg>
      </Animated.View>
    </View>
  );
});
