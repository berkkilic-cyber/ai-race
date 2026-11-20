import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Easing, cancelAnimation, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

export { shakeAt, wave } from './waves';

/**
 * One clock for every ambient (looping) animation in the game shell: meter pulses, the
 * buyable-node glow, the data-centre pulse, the alarm frame, the event card's live dot
 * and the mascot's shake and breath. Instead of one `withRepeat(-1)` per component (each
 * a separate animation the UI thread drives every frame, easy to leave running after an
 * unmount), the provider runs a single linear clock in seconds and each component derives
 * its own wave from it in a worklet.
 *
 * The clock runs only while the provider is told to (the shell passes: app in the
 * foreground, run in progress, not paused) and never with reduced motion. When it stops
 * it returns to 0, where every wave is at rest. Without a provider (start screen, tests)
 * nothing loops.
 */

/** The clock wraps after this many seconds (the wrap is a single-frame jump once an hour). */
const LOOP_S = 3600;

interface Ambient {
  clock: SharedValue<number>;
  /** A shared value that stays 0: what a component reads when it should be still. */
  still: SharedValue<number>;
  /** True while the clock runs and this subtree is on screen. */
  running: boolean;
}

const AmbientContext = createContext<Ambient | null>(null);

export function AmbientProvider({ running, children }: { running: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const still = useSharedValue(0);
  const active = running && !reduced;

  useEffect(() => {
    cancelAnimation(clock);
    clock.set(0);
    if (!active) return;
    clock.set(withRepeat(withTiming(LOOP_S, { duration: LOOP_S * 1000, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(clock);
      clock.set(0);
    };
  }, [active, clock]);

  const value = useMemo(() => ({ clock, still, running: active }), [clock, still, active]);
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

/**
 * Stops ambient motion inside a subtree that is not on screen (an unfocused tab) while
 * the rest of the shell keeps moving.
 */
export function AmbientGate({ active, children }: { active: boolean; children: ReactNode }) {
  const parent = useContext(AmbientContext);
  const value = useMemo(() => (parent && !active && parent.running ? { ...parent, running: false } : parent), [parent, active]);
  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

/** True when ambient motion runs here, or when there is no provider (null). */
export function useAmbientRunning(): boolean | null {
  const ambient = useContext(AmbientContext);
  return ambient ? ambient.running : null;
}

/**
 * The value to read in a worklet for an ambient wave: the shared clock while `enabled`
 * and the clock runs, otherwise a value fixed at 0 (rest). Null without a provider.
 */
export function useAmbientClock(enabled: boolean): SharedValue<number> | null {
  const ambient = useContext(AmbientContext);
  if (!ambient) return null;
  return enabled && ambient.running ? ambient.clock : ambient.still;
}
