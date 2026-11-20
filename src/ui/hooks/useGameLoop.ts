import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useGameStore } from '../store/game';

/** Milliseconds per tick at 1x. */
export const BASE_TICK_MS = 500;

/** True while the loop should be ticking: a run exists, not paused, nothing to decide or read, not ended. */
export function useLoopRunning(): boolean {
  return useGameStore(
    (s) => s.state !== null && s.speed > 0 && s.state.status === 'running' && s.state.pendingEvent === null && s.eventResult === null,
  );
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next !== 'background'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Runs the simulation: one tick every 500 / speed ms. Stops while paused, while
 * an event or its result is showing, after the run ends, and in the background.
 * Mount once, in the game shell.
 */
export function useGameLoop(): void {
  const running = useLoopRunning();
  const speed = useGameStore((s) => s.speed);
  const active = useAppActive();
  useEffect(() => {
    if (!running || !active || speed === 0) return;
    const id = setInterval(() => useGameStore.getState().tick(), BASE_TICK_MS / speed);
    return () => clearInterval(id);
  }, [running, active, speed]);
}
