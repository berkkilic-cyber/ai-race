import { Platform } from 'react-native';

import type { ActionFailure } from '@/engine';

import { useGarageStore } from '../garage/store';
import { useGameStore } from '../store/game';
import { feedback, playCues } from './cues';
import { getSoundLog, preloadSounds } from './engine';
import { getMusicState, installMusic } from './music';
import { createGarageMemo, deriveGarageCues, deriveShipDayCues } from './garageSounds';
import { createRaceMemo, deriveRaceCues } from './raceSounds';
import { useFeelSettings } from './settings';

/** Failed actions that mean "you cannot afford it" (a soft deny sound). */
const DENY_REASONS = new Set<ActionFailure>(['notEnoughHype', 'notEnoughCash']);

let installed = false;
const unsubscribers: (() => void)[] = [];

/**
 * Wires feedback to the game through its chokepoints, once:
 * - the race store: sounds derived from state changes (src/ui/feel/raceSounds.ts);
 * - the Garage store: sounds derived from its counters (src/ui/feel/garageSounds.ts);
 * - a failed "cannot afford" dispatch or Garage buy: the deny cue (the store methods are
 *   wrapped here, so the stores themselves need no edits);
 * - settings: loaded from storage; the Garage store's own haptics flag mirrors them;
 * - web with `?debug=1`: `window.__feel`.
 * Safe to call more than once.
 */
export function installFeel(): void {
  if (installed) return;
  installed = true;
  installMusic();

  const memo = createRaceMemo();
  const garageMemo = createGarageMemo();
  unsubscribers.push(
    useGameStore.subscribe((s, prev) => {
      if (s.state === prev.state) return;
      playCues(deriveRaceCues(prev.state, s.state, s.pack, memo));
    }),
    useGarageStore.subscribe((s, prev) => {
      if (s.shipDay !== prev.shipDay) playCues(deriveShipDayCues(prev.shipDay, s.shipDay));
      if (s.state === prev.state) return;
      playCues(deriveGarageCues(prev.state, s.state, s.content, garageMemo));
    }),
  );

  const { dispatch } = useGameStore.getState();
  useGameStore.setState({
    dispatch: (action) => {
      const r = dispatch(action);
      if (!r.ok && DENY_REASONS.has(r.reason)) feedback('deny');
      return r;
    },
  });
  const garage = useGarageStore.getState();
  const denyIfFalse =
    (fn: (id: string) => boolean) =>
    (id: string): boolean => {
      const ok = fn(id);
      if (!ok) feedback('garageDeny');
      return ok;
    };
  useGarageStore.setState({ buy: denyIfFalse(garage.buy), buyUpgrade: denyIfFalse(garage.buyUpgrade) });

  // One source of truth for haptics: the Garage store's flag follows the feel settings.
  const mirror = (on: boolean) => {
    const g = useGarageStore.getState();
    if (g.settings.haptics !== on) useGarageStore.setState({ settings: { ...g.settings, haptics: on } });
  };
  unsubscribers.push(
    useFeelSettings.subscribe((s, prev) => {
      if (s.haptics !== prev.haptics || s.loaded !== prev.loaded) mirror(s.haptics);
      if (s.sound && (!prev.sound || (s.loaded && !prev.loaded))) preloadSounds();
    }),
  );
  void useFeelSettings.getState().load();

  installFeelDebugHandle();
}

export interface FeelDebugHandle {
  /** Names of the sounds played so far, oldest first. */
  log(): string[];
  /** The same with time (ms) and rate. */
  entries(): readonly { name: string; at: number; rate: number }[];
  settings: typeof useFeelSettings;
  /** What music is wanted and how loud each track is. */
  music: typeof getMusicState;
}

/** Web only, and only when the URL has `debug=1`: `window.__feel` for headless checks. */
function installFeelDebugHandle(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!/[?&]debug=1\b/.test(window.location?.search ?? '')) return;
  const handle: FeelDebugHandle = { log: () => getSoundLog().map((e) => e.name), entries: getSoundLog, settings: useFeelSettings, music: getMusicState };
  (window as unknown as { __feel?: FeelDebugHandle }).__feel = handle;
}

/** Tests: undo `installFeel` (unsubscribes; the wrapped store methods stay wrapped). */
export function uninstallFeelForTests(): void {
  for (const u of unsubscribers.splice(0)) u();
  installed = false;
}
