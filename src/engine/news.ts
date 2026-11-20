import type { EngineContext } from './context';
import type { GameState, NewsItem } from './types';
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
} as const;

export function pushNews(state: GameState, context: EngineContext, item: Omit<NewsItem, 'tick'>): void {
  state.news.push({ tick: state.tick, ...item });
  const overflow = state.news.length - max(0, context.balance.newsLogSize);
  if (overflow > 0) state.news.splice(0, overflow);
}
