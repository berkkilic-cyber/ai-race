import { useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, View, type HostInstance, type StyleProp, type ViewStyle } from 'react-native';

export interface OverlayProps {
  visible: boolean;
  /** Stacking order (zIndex and Android elevation); use a value from theme `layer`. */
  layer: number;
  /**
   * Android back while the overlay is up. Omit to make it impossible to dismiss with
   * back (the press is swallowed, so it never reaches the screen underneath either).
   */
  onRequestClose?: () => void;
  /** Keep keyboard focus inside the overlay on web (a dialog). Default true. */
  trapFocus?: boolean;
  /** 'box-none' lets touches through where the overlay draws nothing. Default 'auto'. */
  pointerEvents?: 'auto' | 'box-none' | 'none';
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}

/**
 * A full-screen layer drawn in the React tree, not a native modal. Mount it at the root
 * of a screen, after the content it covers. Native `Modal` presents a separate view
 * controller on iOS, which raises an uncaught exception (the app closes, no JS error)
 * when its supported orientations miss the current interface orientation or when it is
 * presented while another modal is presenting; an in-tree layer cannot do either.
 */
export function Overlay({ visible, layer, onRequestClose, trapFocus = true, pointerEvents = 'auto', style, children, testID }: OverlayProps) {
  const ref = useRef<HostInstance>(null);
  useBackHandler(visible, onRequestClose);
  useWebFocusTrap(ref, visible && trapFocus);
  if (!visible) return null;
  return (
    <View
      ref={ref}
      style={[StyleSheet.absoluteFill, { zIndex: layer, elevation: layer }, style]}
      pointerEvents={pointerEvents}
      aria-modal={trapFocus}
      role={trapFocus ? 'dialog' : undefined}
      testID={testID}
    >
      {children}
    </View>
  );
}

/** Android back: while active, the press goes to onRequestClose (or is swallowed). */
function useBackHandler(active: boolean, onRequestClose: (() => void) | undefined) {
  const handler = useRef(onRequestClose);
  useEffect(() => {
    handler.current = onRequestClose;
  }, [onRequestClose]);
  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handler.current?.();
      return true;
    });
    return () => sub.remove();
  }, [active]);
}

const FOCUSABLE = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

/** Open web traps, innermost last: only the top one pulls focus back. */
const trapStack: HTMLElement[] = [];

/** Web: moves focus into the overlay and keeps Tab inside it; restores focus on close. */
function useWebFocusTrap(ref: React.RefObject<HostInstance | null>, active: boolean) {
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el || typeof el.contains !== 'function') return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    const previous = document.activeElement as HTMLElement | null;
    trapStack.push(el);
    const focusInside = () => {
      const target = el.querySelector<HTMLElement>(FOCUSABLE) ?? el;
      target.focus?.({ preventScroll: true });
    };
    const timer = setTimeout(focusInside, 0);
    const onFocusIn = (e: FocusEvent) => {
      if (trapStack[trapStack.length - 1] !== el) return;
      if (e.target instanceof Node && !el.contains(e.target)) focusInside();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', onFocusIn);
      const i = trapStack.lastIndexOf(el);
      if (i >= 0) trapStack.splice(i, 1);
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
