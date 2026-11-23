import { chooseAiActions, chooseEventChoice, defaultBalance, type GameState } from '@/engine';
import { getContext } from '@/engine/context';

import { currentToast, dismissToast, EMPTY_QUEUE, enqueueToasts, newAchievementIds, type ToastQueue } from '../achievements/queue';
import { freshNews } from '../hooks/useRegionFlashes';
import { readableColorCacheSize, readableLabColor } from '../i18n';
import { newPresences, regionDotColors } from '../map/mapColors';
import { useGameStore } from '../store/game';

/**
 * Leak check: plays 3,600 ticks (a long run at 1x is about 3,000) through the store with
 * the engine's bot in the player's seat, starting a new run whenever one ends ("Play
 * again"), and asserts that nothing the store or the UI keeps grows with the tick count.
 */
const TOTAL_TICKS = 3600;
const BOT_INTERVAL = 10;
/** Most launch ripples on screen at once (RippleLayer). */
const MAX_RIPPLES = 8;

function setupFor(run: number) {
  return { playerName: 'Leak Lab', founderId: 'researcher', homeRegion: 'canada', seed: 1000 + run };
}

describe('memory stays bounded over a long session', () => {
  it('runs 3,600 ticks with the bot and keeps every list capped', () => {
    const store = useGameStore;
    store.getState().reset();
    store.getState().newGame(setupFor(0));
    const { pack } = store.getState();
    const regions = pack.regions.length;
    const capMemo = getContext(pack).capabilityCapMemo;

    let runs = 1;
    let toasts: ToastQueue = EMPTY_QUEUE;
    let ripples = 0;
    let maxRipplesSeen = 0;
    let flashing = new Set<string>();
    let maxFlashing = 0;

    const check = (s: GameState) => {
      expect(s.news.length).toBeLessThanOrEqual(defaultBalance.newsLogSize);
      expect(s.seenEvents.length).toBeLessThanOrEqual(pack.events.length);
      expect(s.achievements.length).toBeLessThanOrEqual(pack.achievements.length);
      expect(s.labOrder.length).toBeLessThanOrEqual(pack.rivals.length + 1);
      for (const id of s.labOrder) {
        const lab = s.labs[id];
        expect(lab.ownedNodes.length).toBeLessThanOrEqual(pack.nodes.length);
        expect(lab.dataCentres.length).toBeLessThanOrEqual(regions * defaultBalance.maxDataCentresPerRegion);
        expect(Object.keys(lab.adoption).length).toBeLessThanOrEqual(regions);
        expect(Object.keys(lab.bans).length).toBeLessThanOrEqual(regions);
        // Timed modifiers come from events and expire; flags come from nodes, events and ban thresholds.
        expect(lab.timedModifiers.length).toBeLessThanOrEqual(64);
        expect(lab.flags.length).toBeLessThanOrEqual(pack.nodes.length + pack.events.length + 16);
      }
    };

    let ticks = 0;
    let guard = 0;
    while (ticks < TOTAL_TICKS && guard++ < TOTAL_TICKS * 4) {
      const before = store.getState();
      const s = before.state;
      if (!s) throw new Error('no run');
      if (s.status === 'ended') {
        // Play again.
        store.getState().newGame(setupFor(runs++));
        continue;
      }
      if (s.pendingEvent) {
        const choice = chooseEventChoice(s, before.pack, s.playerLabId);
        if (!choice) throw new Error('no choice');
        store.getState().dispatch({ type: 'resolveEvent', labId: s.playerLabId, choiceId: choice });
        store.getState().dismissEventResult();
        continue;
      }
      if (s.tick % BOT_INTERVAL === 0) for (const action of chooseAiActions(s, before.pack, s.playerLabId)) store.getState().dispatch(action);
      const prev = store.getState().state;
      store.getState().tick();
      ticks++;
      const next = store.getState().state;
      if (!next) throw new Error('run lost');
      check(next);

      // UI-side lists, driven the way their components drive them.
      ripples = Math.min(MAX_RIPPLES, ripples + newPresences(prev, next).length);
      maxRipplesSeen = Math.max(maxRipplesSeen, ripples);
      if (ticks % 3 === 0) ripples = 0; // rings last 1.3 s, about 3 ticks at 1x
      const fresh = freshNews(prev, next);
      for (const item of fresh) if (item.regionId) flashing.add(item.regionId);
      maxFlashing = Math.max(maxFlashing, flashing.size);
      if (ticks % 3 === 0) flashing = new Set();
      if (prev && prev.seed === next.seed) {
        const ids = newAchievementIds(prev.achievements, next.achievements);
        if (ids.length) toasts = enqueueToasts(toasts, ids);
      } else toasts = EMPTY_QUEUE;
      if (ticks % 6 === 0) {
        const shown = currentToast(toasts, false);
        if (shown) toasts = dismissToast(toasts, shown.key);
      }
      expect(toasts.toasts.length).toBeLessThanOrEqual(pack.achievements.length);
      for (const id of next.labOrder) readableLabColor(next.labs[id]);
      if (ticks % 50 === 0) regionDotColors(next, pack.regions.map((r) => r.id), 12, (id) => readableLabColor(next.labs[id]));
    }

    expect(ticks).toBe(TOTAL_TICKS);
    expect(runs).toBeGreaterThanOrEqual(1);
    expect(maxRipplesSeen).toBeLessThanOrEqual(MAX_RIPPLES);
    expect(maxFlashing).toBeLessThanOrEqual(regions);
    expect(capMemo.size).toBeLessThanOrEqual(4097);
    // One entry per lab colour and use, however many ticks and runs.
    expect(readableColorCacheSize()).toBeLessThanOrEqual(2 * (pack.rivals.length + 1));
    // The store keeps one state and nothing else that grows: no history of previous states.
    const keys = Object.keys(store.getState()).sort();
    expect(keys).toEqual(['dismissEventResult', 'dispatch', 'eventResult', 'newGame', 'pack', 'packId', 'reset', 'setSpeed', 'setup', 'speed', 'state', 'tick'].sort());
  });
});
