import {
  ENGINE_NEWS_KEYS,
  getCapabilityLevel,
  getMeters,
  getUsers,
  getWorldShare,
  type ContentPack,
  type GameState,
  type LabId,
  type Meters,
  type NewsItem,
} from '@/engine';

import type { NewGameSetup } from '../store/game';

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
  };
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
