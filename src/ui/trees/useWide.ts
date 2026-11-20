import { useWindowDimensions } from 'react-native';

/** Same rule as the shell's layout mode: wide = landscape and at least 600 wide. */
export function isWide(width: number, height: number): boolean {
  return width > height && width >= 600;
}

/** Local stand-in for the shell's useLayoutMode() until it lands. */
export function useWide(): boolean {
  const { width, height } = useWindowDimensions();
  return isWide(width, height);
}

/** Width of the shared Sheet when it is a right-hand panel in wide mode (see docs/UI.md). */
export const SIDE_PANEL_WIDTH = 360;
