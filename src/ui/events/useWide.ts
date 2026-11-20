import { useWindowDimensions } from 'react-native';

/** Wide (landscape) layout rule shared with the shell: wider than tall and at least 600 wide. */
export function isWide(width: number, height: number): boolean {
  return width > height && width >= 600;
}

/**
 * Local stand-in for the shell's layout mode, used by the events, news, ticker and
 * achievement features until a shared hook exists.
 */
export function useWide(): boolean {
  const { width, height } = useWindowDimensions();
  return isWide(width, height);
}
