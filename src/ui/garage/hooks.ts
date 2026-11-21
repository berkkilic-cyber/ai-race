import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { garageNow } from './clock';
import { useGarageStore, type GarageStore } from './store';

/**
 * Selects from the Garage store but re-renders only when `key(value)` changes, so a list
 * re-renders when a count or an affordability flips, not on every tick. Pass stable
 * functions (module level or memoised).
 */
export function useGarage<T>(select: (s: GarageStore) => T, key: (v: T) => string | number): T {
  const cache = useRef<{ k: string | number; v: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const v = select(useGarageStore.getState());
    const k = key(v);
    if (!cache.current || cache.current.k !== k) cache.current = { k, v };
    return cache.current.v;
  }, [select, key]);
  return useSyncExternalStore(useGarageStore.subscribe, getSnapshot, getSnapshot);
}

/** Ms between clock advances while the screen is open. */
export const TICK_MS = 250;

/** False while the app is in the background. */
function useForeground(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next !== 'background'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Loads the save, then advances the economy on a light timer while the app is in the
 * foreground. Saves at once when the app goes to the background; on return, the next tick
 * turns the time away into the "While you were away" report.
 */
export function useGarageLoop(): boolean {
  const active = useForeground();
  const loaded = useGarageStore((s) => s.state !== null);
  useEffect(() => {
    void useGarageStore.getState().load();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (!active) {
      useGarageStore.getState().save(true);
      return;
    }
    useGarageStore.getState().tick();
    const id = setInterval(() => useGarageStore.getState().tick(), TICK_MS);
    return () => {
      clearInterval(id);
      useGarageStore.getState().save(true);
    };
  }, [active, loaded]);
  return active;
}

/** Re-renders every `ms` while mounted (countdowns); returns the Garage clock. */
export function useNowEvery(ms: number, enabled = true): number {
  const [now, setNow] = useState(garageNow);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(garageNow()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}
