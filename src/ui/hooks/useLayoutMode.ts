import { useWindowDimensions } from 'react-native';

import { layout } from '../theme';

export type LayoutMode = 'wide' | 'narrow';

/** Wide = landscape and at least `layout.wideMinWidth` points wide. */
export function layoutModeFor(width: number, height: number): LayoutMode {
  return width > height && width >= layout.wideMinWidth ? 'wide' : 'narrow';
}

/** 'wide' (landscape shell: rail, top strip, side panel) or 'narrow' (portrait shell). */
export function useLayoutMode(): LayoutMode {
  const { width, height } = useWindowDimensions();
  return layoutModeFor(width, height);
}
