import { useSyncExternalStore, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseInsetsParam, type Insets } from './insetsParam';

export { parseInsetsParam, ZERO_INSETS, type Insets } from './insetsParam';

/** Read once, on the first page load, so the emulation survives in-app navigation. */
const emulated: Insets | null =
  Platform.OS === 'web' && typeof window !== 'undefined' ? parseInsetsParam(window.location?.search ?? '') : null;

/**
 * Debug only, web only: with `?insets=top,right,bottom,left` in the URL, every safe-area
 * consumer below this point (useInsets, and react-native-safe-area-context's own hooks and
 * web SafeAreaView) sees those insets instead of the browser's (which are zero in headless
 * Chrome). Lets a desktop browser show what a notched phone in landscape will look like.
 * Renders its children unchanged on native or without the parameter.
 */
export function InsetsEmulator({ children }: { children: ReactNode }) {
  if (!emulated) return <>{children}</>;
  return <Emulated insets={emulated}>{children}</Emulated>;
}

/**
 * Switches to the emulated insets after mount: the statically rendered web page hydrates
 * with the real (zero) insets, and React does not patch styles that differ at hydration,
 * so the emulated values must arrive as an ordinary re-render.
 */
const subscribeNever = () => () => undefined;

function Emulated({ insets, children }: { insets: Insets; children: ReactNode }) {
  const real = useSafeAreaInsets();
  // Server snapshot false, client snapshot true: hydration renders the real insets, then React re-renders with the emulated ones.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  return <SafeAreaInsetsContext.Provider value={mounted ? insets : real}>{children}</SafeAreaInsetsContext.Provider>;
}

/**
 * The safe-area insets every screen and shell component lays itself out with. The one
 * place insets come from: components apply them explicitly (padding or offsets) instead
 * of nesting SafeAreaViews, so nothing is padded twice.
 */
export function useInsets(): Insets {
  return useSafeAreaInsets();
}
