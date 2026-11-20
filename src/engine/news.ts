import type { EngineContext } from './context';
import type { GameState, NewsItem, NewsKind } from './types';
import { max } from './natives';

/**
 * String keys of news items the engine emits by itself. A pack must define
 * these in `strings`. Params: {lab} is a lab id, {region} a region id.
 */
export const ENGINE_NEWS_KEYS = {
  /** {lab} is banned in {region}. */
  ban: 'engine.news.ban',
  /** {lab} was eliminated by regulators. */
  eliminatedBanned: 'engine.news.eliminatedBanned',
  /** {lab} was eliminated by public revolt. */
  eliminatedRevolt: 'engine.news.eliminatedRevolt',
  /** {lab} was bought by {rival}. */
  acquired: 'engine.news.acquired',
  /** {lab} enters the race in {region}. */
  rivalEntered: 'engine.news.rivalEntered',
  /** A data centre of {lab} in {region} went offline for unpaid upkeep. */
  dataCentreUnpaid: 'engine.news.dataCentreUnpaid',
  /** {lab} launched in {region}. */
  launched: 'engine.news.launched',
  /** Achievement {achievement} earned. */
  achievement: 'engine.news.achievement',
  /** The player's lab {lab} ships model {model} (a node name key), tier {tier}. */
  launchPlayer: 'engine.news.launch.player',
  /** Rival {lab} ships model {model} (a node name key), tier {tier}. */
  launchRival: 'engine.news.launch.rival',
  /**
   * Lab {lab} first reaches {region} through a spread channel (fallback when the channel has no
   * entryTextKey). Params also carry `channel` (channel id) and `from` (source region id), and
   * `via` (the skipped region) for 'jump' channels.
   */
  channelEntry: 'engine.news.entry.channel',
} as const;

/** The `kind` each engine news key is emitted with. */
export const ENGINE_NEWS_KINDS: Record<keyof typeof ENGINE_NEWS_KEYS, NewsKind> = {
  ban: 'ban',
  eliminatedBanned: 'elimination',
  eliminatedRevolt: 'elimination',
  acquired: 'acquisition',
  rivalEntered: 'entry',
  dataCentreUnpaid: 'other',
  launched: 'other',
  achievement: 'achievement',
  launchPlayer: 'launch',
  launchRival: 'launch',
  channelEntry: 'entry',
};

/** Adds a news item; every engine-emitted item carries a `kind`. */
export function pushNews(state: GameState, context: EngineContext, item: Omit<NewsItem, 'tick' | 'kind'> & { kind: NewsKind }): void {
  state.news.push({ tick: state.tick, ...item });
  const overflow = state.news.length - max(0, context.balance.newsLogSize);
  if (overflow > 0) state.news.splice(0, overflow);
}
