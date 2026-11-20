import { Platform } from 'react-native';

import { chooseAiActions, chooseEventChoice } from '@/engine';

import { useGameStore } from './store/game';

export interface AdvanceOptions {
  /** Let the engine's bot play the player's lab (decisions every few ticks). */
  bot?: boolean;
  /** Resolve pending events with the bot's choice. Default true. */
  autoResolve?: boolean;
  /** Stop before resolving an event so it stays on screen. */
  stopAtEvent?: boolean;
}

export interface DebugHandle {
  store: typeof useGameStore;
  /** Runs up to n ticks synchronously; returns the ticks actually run. */
  advance(n: number, opts?: AdvanceOptions): number;
}

/** Ticks between bot decisions for the player seat. */
const BOT_INTERVAL = 10;

function advance(n: number, opts: AdvanceOptions = {}): number {
  const { bot = false, autoResolve = true, stopAtEvent = false } = opts;
  const store = useGameStore.getState;
  let ran = 0;
  for (let i = 0; i < n; i++) {
    const { state, pack, dispatch } = store();
    if (!state || state.status === 'ended') break;
    if (state.pendingEvent) {
      if (stopAtEvent || !autoResolve) break;
      const choice = chooseEventChoice(state, pack, state.playerLabId);
      if (!choice) break;
      dispatch({ type: 'resolveEvent', labId: state.playerLabId, choiceId: choice });
      store().dismissEventResult();
      continue;
    }
    if (bot && state.tick % BOT_INTERVAL === 0) {
      for (const action of chooseAiActions(state, pack, state.playerLabId)) store().dispatch(action);
    }
    store().tick();
    ran++;
  }
  return ran;
}

/**
 * Web only, and only when the URL has `debug=1`: exposes `window.__game` so
 * screenshot scripts can fast-forward a run. Does nothing otherwise.
 */
export function installDebugHandle(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!/[?&]debug=1\b/.test(window.location?.search ?? '')) return;
  (window as unknown as { __game?: DebugHandle }).__game = { store: useGameStore, advance };
}
