import { analyticsNow, track, type QuitHow } from '@/analytics';
import type { GameState } from '@/engine';

import { useAdStore } from '../ads/store';
import { PLACEMENTS } from '../ads/types';
import { onLoggedError } from '../diagnostics/log';
import { useGarageStore } from '../garage/store';
import { useMetaStore } from '../meta/store';
import { onGameAction, useGameStore } from '../store/game';
import { STEPS } from '../tutorial/machine';
import { useTutorialStore } from '../tutorial/store';

/**
 * Game events from the existing stores, without touching the screens. Every handler does
 * O(1) work when a game tick changes the store (a reference or a number compared) and
 * tracks only on discrete changes: a run starting or ending, an event card appearing,
 * the player acting. Each subscribe function returns its unsubscribe.
 */

/** Wall time and tick of the run in progress (for run_end seconds and run_quit). */
interface RunInfo {
  startedAt: number;
  seed: number;
}

let run: RunInfo | null = null;
let lastErrorAt = -Infinity;

function isNewRun(next: GameState, before: GameState | null): boolean {
  if (!before) return true;
  if (next.seed !== before.seed) return true;
  if (next.tick < before.tick) return true;
  return next.tick === 0 && before.status === 'ended' && next.status === 'running';
}

function runStart(s: GameState): void {
  const me = s.labs[s.playerLabId];
  run = { startedAt: analyticsNow(), seed: s.seed };
  const setup = useGameStore.getState().setup;
  const perks = setup && setup.seed === s.seed ? (setup.perkIds?.length ?? 0) : 0;
  track({ name: 'run_start', params: { founder: me?.founderId ?? 'unknown', difficulty: s.difficulty ?? 'none', runLength: s.runLength, homeRegion: me?.homeRegion ?? 'unknown', perks } });
}

/** Tracks run_quit for a run that is still going. */
export function quitRun(s: GameState | null, how: QuitHow): void {
  if (!s || s.status !== 'running' || !run) return;
  track({ name: 'run_quit', params: { ticks: s.tick, how } });
  run = null;
}

/** The race: run start, end and quit, event cards, and the player's actions. */
export function subscribeRace(): () => void {
  const offStore = useGameStore.subscribe((st, prev) => {
    const next = st.state;
    const before = prev.state;
    if (next === before) return;
    if (!next) {
      // The run was dropped while it was going: only the error screen does that mid-run.
      quitRun(before, analyticsNow() - lastErrorAt < 5000 ? 'error' : 'menu');
      return;
    }
    if (isNewRun(next, before)) {
      quitRun(before, 'restart');
      runStart(next);
      return;
    }
    if (next.pendingEvent && next.pendingEvent.eventId !== before?.pendingEvent?.eventId) track({ name: 'event_shown', params: { eventId: next.pendingEvent.eventId } });
    if (next.status === 'ended' && before?.status !== 'ended' && next.ending) {
      const e = next.ending;
      track({ name: 'run_end', params: { ending: e.endingId, won: e.kind === 'win', score: Math.round(e.score), ticks: next.tick, seconds: run ? Math.round((analyticsNow() - run.startedAt) / 1000) : 0 } });
      run = null;
    }
  });

  const offActions = onGameAction((action, state, before) => {
    if (action.labId !== state.playerLabId) return;
    const { pack } = useGameStore.getState();
    switch (action.type) {
      case 'buyNode':
        track({ name: 'node_buy', params: { nodeId: action.nodeId, kind: pack.nodes.find((n) => n.id === action.nodeId)?.tree ?? 'unknown' } });
        break;
      case 'launchInRegion':
        track({ name: 'region_launch', params: { regionId: action.regionId } });
        break;
      case 'buildDataCentre':
        track({ name: 'data_centre_build', params: { regionId: action.regionId } });
        break;
      case 'upgradeDataCentre':
        track({ name: 'data_centre_upgrade' });
        break;
      case 'acquireRival':
        track({ name: 'rival_acquire', params: { rivalId: action.targetLabId } });
        break;
      case 'resolveEvent': {
        const eventId = state.lastEventResult?.eventId ?? 'unknown';
        track({ name: 'event_choice', params: { eventId, choice: action.choiceId } });
        break;
      }
      case 'collectMoment': {
        const def = before.moments.find((m) => m.uid === action.uid)?.defId;
        const kind = def ? (pack.moments.find((m) => m.id === def)?.kind ?? 'unknown') : 'unknown';
        track({ name: 'moment_collect', params: { momentId: def ?? 'unknown', kind } });
        break;
      }
    }
  });

  return () => {
    offStore();
    offActions();
  };
}

/** The first-run tutorial: each step shown, completion and skips. */
export function subscribeTutorial(): () => void {
  return useTutorialStore.subscribe((st, prev) => {
    const a = st.tutorial;
    const b = prev.tutorial;
    if (a === b) return;
    if (a.status === 'active' && (b.status !== 'active' || a.step !== b.step || (a.step === 0 && b.runSeed !== null && a.runSeed !== b.runSeed))) {
      track({ name: 'tutorial_step', params: { step: a.step + 1, id: STEPS[a.step] ?? 'unknown' } });
    }
    if (a.status === 'done' && b.status === 'active') {
      if (b.step >= STEPS.length - 1) track({ name: 'tutorial_complete' });
      else track({ name: 'tutorial_skip', params: { step: b.step + 1 } });
    }
  });
}

/** Taps are summed and sent as one garage_tap_batch at most this often (and when leaving or backgrounding). */
export const TAP_BATCH_MS = 30_000;

let pendingTaps = 0;
let tapTimer: ReturnType<typeof setTimeout> | null = null;

/** Sends the taps counted so far as one event (none if there were none). */
export function flushTaps(): void {
  if (tapTimer) {
    clearTimeout(tapTimer);
    tapTimer = null;
  }
  if (pendingTaps <= 0) return;
  const taps = pendingTaps;
  pendingTaps = 0;
  track({ name: 'garage_tap_batch', params: { taps } });
}

/** The Garage: taps (batched), generator and upgrade purchases, shipping a model, the haptics setting. */
export function subscribeGarage(): () => void {
  return useGarageStore.subscribe((st, prev) => {
    if (st.settings !== prev.settings && st.settings.haptics !== prev.settings.haptics) track({ name: 'settings_change', params: { key: 'haptics', value: st.settings.haptics } });
    const a = st.state;
    const b = prev.state;
    if (!a || !b || a === b) return;
    const taps = a.stats.taps - b.stats.taps;
    if (taps > 0) {
      pendingTaps += taps;
      if (!tapTimer) tapTimer = setTimeout(flushTaps, TAP_BATCH_MS);
    }
    if (a.generation > b.generation) {
      flushTaps();
      track({ name: 'garage_prestige', params: { index: a.generation } });
      return;
    }
    if (a.generators !== b.generators && a.stats.generatorsBought !== b.stats.generatorsBought) {
      const gens = st.content.generators;
      for (let i = 0; i < gens.length; i++) {
        const count = (a.generators[gens[i].id] ?? 0) - (b.generators[gens[i].id] ?? 0);
        if (count > 0) track({ name: 'garage_generator_buy', params: { tier: i + 1, count } });
      }
    }
    if (a.upgrades !== b.upgrades && a.upgrades.length > b.upgrades.length) {
      for (const id of a.upgrades) if (!b.upgrades.includes(id)) track({ name: 'garage_upgrade_buy', params: { id } });
    }
  });
}

/** Rewarded ads: each ad that opens and each one watched to the reward; the remove-ads switch. */
export function subscribeAds(): () => void {
  return useAdStore.subscribe((st, prev) => {
    if (!prev.loaded || !st.loaded) return;
    if (st.adsRemoved !== prev.adsRemoved) track({ name: 'remove_ads_tap', params: { on: st.adsRemoved } });
    if (st.stats === prev.stats) return;
    for (const p of PLACEMENTS) {
      const a = st.stats[p];
      const b = prev.stats[p];
      if (a === b) continue;
      if (a.shown > b.shown) track({ name: 'ad_started', params: { placement: p } });
      if (a.rewarded > b.rewarded) track({ name: 'ad_completed', params: { placement: p } });
    }
  });
}

/** Logged errors (error boundary, uncaught errors, failed saves) as error events. */
/** The link between the modes: the race reward granted to the Garage (rep, boost minutes) and the perks switch. */
export function subscribeMeta(): () => void {
  return useMetaStore.subscribe((st, prev) => {
    if (st.reward && st.reward.seq !== prev.reward?.seq) track({ name: 'race_reward_granted', params: { rep: st.reward.rep, boost: Math.round(st.reward.boostMs / 60000) } });
    if (st.toggles !== prev.toggles) track({ name: 'perks_toggle', params: { on: st.perksOn } });
  });
}

export function subscribeErrors(): () => void {
  return onLoggedError((where, message) => {
    lastErrorAt = analyticsNow();
    track({ name: 'error', params: { where, message } });
  });
}

/** Tests: forget the run and the pending taps. */
export function resetSubscriptionState(): void {
  run = null;
  pendingTaps = 0;
  lastErrorAt = -Infinity;
  if (tapTimer) clearTimeout(tapTimer);
  tapTimer = null;
}
