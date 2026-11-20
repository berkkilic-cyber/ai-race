import { Platform } from 'react-native';

import { chooseAiActions, chooseEventChoice, type Meters } from '@/engine';

import { useComposureOverride, type ComposureLevel } from './composure';
import { readableLabColor } from './i18n';
import { regionDotColors } from './map/mapColors';
import { enableRenderStats, renderStats, resetRenderStats } from './map/renderStats';
import { getPackEntry } from './packs';

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
  /** Forces the composure level (0..3) regardless of the meters; null follows the meters again. */
  forceComposure(level: ComposureLevel | null): void;
  /**
   * Writes meter values into the run (debug only): regulation and backlash on the player,
   * rival as the AGI progress of the strongest active rival.
   */
  setMeters(meters: Partial<Meters>): void;
  /** Render counts of map components since the last reset (dotBucket, dotRegion). */
  renderStats(): Record<string, number>;
  resetRenderStats(): void;
  /** The map's current dot colours per region (comma-joined per bucket), for render checks. */
  dotColors(): Record<string, string>;
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

function setMeters(meters: Partial<Meters>): void {
  const { state } = useGameStore.getState();
  if (!state) return;
  const labs = { ...state.labs };
  const me = { ...labs[state.playerLabId] };
  if (meters.regulation !== undefined) me.regulation = meters.regulation;
  if (meters.backlash !== undefined) me.backlash = meters.backlash;
  labs[me.id] = me;
  if (meters.rival !== undefined) {
    const rivals = state.labOrder.filter((id) => id !== me.id && labs[id].active);
    const lead = rivals.sort((a, b) => labs[b].agiProgress - labs[a].agiProgress)[0];
    if (lead) labs[lead] = { ...labs[lead], agiProgress: meters.rival };
  }
  useGameStore.setState({ state: { ...state, labs } });
}

function dotColors(): Record<string, string> {
  const { state, packId } = useGameStore.getState();
  if (!state) return {};
  const { geometry } = getPackEntry(packId);
  const buckets = (geometry as { dots?: { buckets: number } }).dots?.buckets ?? 0;
  return regionDotColors(state, Object.keys(geometry.regions), buckets, (id) => readableLabColor(state.labs[id]));
}

function forceComposure(level: ComposureLevel | null): void {
  useComposureOverride.getState().setLevel(level);
}

/**
 * Web only, and only when the URL has `debug=1`: exposes `window.__game` so
 * screenshot scripts can fast-forward a run. Does nothing otherwise.
 */
export function installDebugHandle(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!/[?&]debug=1\b/.test(window.location?.search ?? '')) return;
  enableRenderStats();
  (window as unknown as { __game?: DebugHandle }).__game = { store: useGameStore, advance, forceComposure, setMeters, renderStats, resetRenderStats, dotColors };
}
