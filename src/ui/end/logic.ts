import {
  ENGINE_NEWS_KEYS,
  getCapabilityLevel,
  getMeters,
  getStandings,
  getWinProgress,
  getUsers,
  getWorldShare,
  type ContentPack,
  type GameState,
  type LabId,
  type Meters,
  type NewsItem,
} from '@/engine';

import { fmtPct } from '../format';
import { t } from '../i18n';
import { lower } from '../locale/casing';
import type { NewGameSetup } from '../store/game';
import { restartSetup } from '../store/runSave';

export const MAX_HEADLINES = 8;

/** Engine news that happens every run and makes a dull headline. */
const ROUTINE_KEYS: ReadonlySet<string> = new Set([ENGINE_NEWS_KEYS.launched, ENGINE_NEWS_KEYS.achievement, ENGINE_NEWS_KEYS.rivalEntered]);

/** True when the item is about the player: tagged with the player's lab, or naming it in a param. */
export function isAboutLab(item: NewsItem, labId: LabId): boolean {
  if (item.labId === labId) return true;
  return item.params ? Object.values(item.params).some((v) => v === labId) : false;
}

function notability(item: NewsItem): number {
  let score = item.tone === 'neutral' ? 0 : 2;
  if (ROUTINE_KEYS.has(item.textKey)) score -= 3;
  return score;
}

/**
 * Up to `max` of the most notable news items about the player: good or bad
 * news before neutral, routine engine notices last, one item per text key
 * (the latest), returned in the order they happened.
 */
export function pickNotableHeadlines(news: readonly NewsItem[], playerId: LabId, max = MAX_HEADLINES): NewsItem[] {
  const latestByKey = new Map<string, { item: NewsItem; index: number }>();
  news.forEach((item, index) => {
    if (isAboutLab(item, playerId)) latestByKey.set(item.textKey, { item, index });
  });
  return [...latestByKey.values()]
    .sort((a, b) => notability(b.item) - notability(a.item) || b.index - a.index)
    .slice(0, Math.max(0, max))
    .sort((a, b) => a.index - b.index)
    .map((e) => e.item);
}

/** Same lab name, founder, home region and difficulty as the finished run, with a fresh seed. */
export function playAgainSetup(state: GameState, random: () => number = Math.random): NewGameSetup {
  const player = state.labs[state.playerLabId];
  let seed = Math.floor(random() * 0x7fffffff);
  if (seed === state.seed) seed = (seed + 1) % 0x7fffffff;
  return {
    playerName: player.name,
    founderId: player.founderId ?? '',
    homeRegion: player.homeRegion,
    packId: state.packId,
    seed,
    ...(state.difficulty !== undefined ? { difficulty: state.difficulty } : {}),
    ...(state.runLength !== undefined ? { runLength: state.runLength } : {}),
  };
}

/** Rematch: the very same run again (same seed, same setup and pack). */
export function rematchSetup(state: GameState): NewGameSetup {
  return restartSetup(state);
}

/** At or above this fraction the end screen calls it close. */
export const CLOSE_CALL = 0.8;

export type CloseCall =
  /** A win: the nearest thing that could have ended it (a rival's AGI or one of the player's meters), 0..1. */
  | { kind: 'win'; threat: { type: 'rivalAgi'; labId: LabId } | { type: 'meter'; meter: 'regulation' | 'backlash' }; value: number; near: boolean }
  /** A loss: the player's best win condition, 0..1. */
  | { kind: 'lose'; goal: 'agi' | 'dependence' | 'monopoly'; value: number; near: boolean };

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/**
 * How close the finished run was, from the engine's selectors. A win: the closest rival's
 * AGI progress or the player's highest failing meter at the end, whichever was nearer 100%.
 * A loss: the player's best win condition (AGI, share of the dependence threshold, or the
 * share of rivals already gone).
 */
export function closeCall(state: GameState, pack: ContentPack): CloseCall {
  const id = state.playerLabId;
  if (state.ending?.kind === 'win') {
    const rival = getStandings(state, pack)
      .filter((row) => row.labId !== id && row.status === 'active')
      .sort((a, b) => b.agi - a.agi)[0];
    const meters = getMeters(state, id);
    const meter: 'regulation' | 'backlash' = meters.backlash > meters.regulation ? 'backlash' : 'regulation';
    const meterValue = clamp01(meters[meter] / 100);
    const rivalValue = clamp01(rival?.agi ?? 0);
    const value = Math.max(meterValue, rivalValue);
    const threat = rival && rivalValue >= meterValue ? ({ type: 'rivalAgi', labId: rival.labId } as const) : ({ type: 'meter', meter } as const);
    return { kind: 'win', threat, value, near: value >= CLOSE_CALL };
  }
  const progress = getWinProgress(state, pack, id);
  const { remaining, total } = progress.monopoly;
  const options: { goal: 'agi' | 'dependence' | 'monopoly'; value: number }[] = [
    { goal: 'agi', value: clamp01(progress.agi) },
    { goal: 'dependence', value: clamp01(progress.dependence) },
    { goal: 'monopoly', value: total > 0 ? clamp01((total - remaining) / total) : 0 },
  ];
  const best = options.reduce((a, b) => (b.value > a.value ? b : a));
  return { kind: 'lose', goal: best.goal, value: best.value, near: best.value >= CLOSE_CALL };
}

/** The end screen's one line: "Close call: Hyperion's AGI was at 92%." */
export function closeCallText(call: CloseCall): string {
  // Floored, never rounded up: a rival at 99.6% did not reach 100% (the player won).
  const pct = fmtPct(Math.floor(call.value * 100) / 100);
  if (call.kind === 'win') {
    const what =
      call.threat.type === 'rivalAgi'
        ? t('ui.sprint.close.rivalAgi', { rival: call.threat.labId })
        : t('ui.sprint.close.meter', { meter: lower(t(`term.${call.threat.meter}`)) });
    return t(call.near ? 'ui.sprint.close.win.near' : 'ui.sprint.close.win.far', { what, pct });
  }
  return t(call.near ? 'ui.sprint.close.lose.near' : 'ui.sprint.close.lose.far', { pct, goal: t(`ui.sprint.close.goal.${call.goal}`) });
}

export interface EndStats {
  days: number;
  peakWorldShare: number;
  worldShare: number;
  /** Millions. */
  users: number;
  nodesBought: number;
  dataCentresBuilt: number;
  eventsResolved: number;
  tier: number;
  meters: Meters;
}

/** The numbers the end screen shows, read through engine selectors. */
export function endStats(state: GameState, pack: ContentPack): EndStats {
  const id = state.playerLabId;
  const lab = state.labs[id];
  return {
    days: (state.ending?.tick ?? state.tick) + 1,
    peakWorldShare: lab.stats.peakWorldShare,
    worldShare: getWorldShare(state, pack, id),
    users: getUsers(state, pack, id),
    nodesBought: lab.stats.nodesBought,
    dataCentresBuilt: lab.stats.dataCentresBuilt,
    eventsResolved: lab.stats.eventsResolved,
    tier: getCapabilityLevel(state, pack, id),
    meters: getMeters(state, id),
  };
}
