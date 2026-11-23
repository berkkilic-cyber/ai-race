import { createContext, useContext, useMemo, useRef } from 'react';

import { useGameStore, type GameStore } from '../store/game';

/**
 * Whether the tab a component sits in is the one on screen (true outside the tabs).
 * Provided by the tab slot (renderFrozenTab).
 */
export const TabActiveContext = createContext(true);

export function useTabActive(): boolean {
  return useContext(TabActiveContext);
}

/**
 * Wraps a store selector so that, while its tab is hidden, it keeps returning the value it
 * last returned instead of computing a new one. Hidden tabs are frozen (a suspended
 * Suspense boundary, see tabSlot.tsx), but their store subscriptions stay on: a selector
 * whose value changed after the freeze would ask for a render that can never commit, on
 * every store change from then on (one extra React commit per tick per hidden tab, plus
 * the selector's own work). A held value never changes, so nothing is asked for; the tab
 * computes afresh the moment it is shown again.
 *
 * Use for the selectors of components inside a tab: `useGameStore(useTabSelector(select))`
 * or `useKeyedSelector(useTabSelector(select), key)`. Keep `select` stable (module level
 * or memoised) when the receiving hook needs a stable function.
 */
export function useTabSelector<T>(select: (s: GameStore) => T): (s: GameStore) => T {
  const active = useContext(TabActiveContext);
  const held = useRef<{ value: T } | null>(null);
  return useMemo(() => {
    if (active) {
      return (s: GameStore) => {
        const value = select(s);
        held.current = { value };
        return value;
      };
    }
    return (s: GameStore) => {
      if (!held.current) held.current = { value: select(s) };
      return held.current.value;
    };
  }, [active, select]);
}

/** `useGameStore(selector)` for components inside a tab: holds still while the tab is hidden (useTabSelector). */
export function useTabStore<T>(select: (s: GameStore) => T): T {
  return useGameStore(useTabSelector(select));
}
