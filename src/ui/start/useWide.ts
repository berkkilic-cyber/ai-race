import { useSyncExternalStore } from 'react';
import { Dimensions } from 'react-native';

/** Smallest width for the two-pane (wide) layout. */
export const WIDE_MIN_WIDTH = 600;

/** Pure rule shared with the shell: wide when landscape and at least 600 points wide. */
export function isWide(width: number, height: number): boolean {
  return width > height && width >= WIDE_MIN_WIDTH;
}

function subscribe(onChange: () => void): () => void {
  const sub = Dimensions.addEventListener('change', onChange);
  return () => sub.remove();
}

function snapshot(): boolean {
  const { width, height } = Dimensions.get('window');
  return isWide(width, height);
}

/**
 * Local stand-in for the shell's layout mode until it is merged: true in
 * landscape windows at least 600 wide. The server snapshot is narrow, so the
 * statically rendered web page hydrates without a mismatch and then switches.
 */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
