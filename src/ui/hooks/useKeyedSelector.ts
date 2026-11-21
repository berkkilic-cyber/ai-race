import { useCallback, useRef, useSyncExternalStore } from 'react';

import { useGameStore, type GameStore } from '../store/game';

/**
 * Selects from the game store but re-renders only when `key(value)` changes: subscribe to
 * what is displayed (a formatted figure, a whole percent, a list's length) rather than to
 * the raw number, which changes every tick. The value returned is the one selected when
 * the key last changed. Pass stable functions (module level or memoised).
 */
export function useKeyedSelector<T>(select: (s: GameStore) => T, key: (v: T) => string | number): T {
  const cache = useRef<{ k: string | number; v: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const v = select(useGameStore.getState());
    const k = key(v);
    if (!cache.current || cache.current.k !== k) cache.current = { k, v };
    return cache.current.v;
  }, [select, key]);
  return useSyncExternalStore(useGameStore.subscribe, getSnapshot, getSnapshot);
}
