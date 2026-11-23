/**
 * Small mutable helpers shared by the economy's modules. They work on a private copy of
 * the state (the caller clones first); nothing here is exported from src/idle/index.ts.
 */
import { amount } from './num';
import { nextRandom } from './rng';
import type { GarageContent, GarageNews, GarageState, NewsKind } from './types';

export function random(s: GarageState): number {
  const r = nextRandom(s.rng);
  s.rng = r.seed;
  return r.value;
}

export function between(s: GarageState, min: number, max: number): number {
  return min + (max - min) * random(s);
}

export function pickWeighted<T extends { weight?: number }>(s: GarageState, items: readonly T[], weightOf: (item: T) => number = (i) => i.weight ?? 1): T | undefined {
  const total = items.reduce((sum, i) => sum + Math.max(0, weightOf(i)), 0);
  if (items.length === 0 || total <= 0) return undefined;
  let roll = random(s) * total;
  for (const item of items) {
    roll -= Math.max(0, weightOf(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** Adds tokens to the purse, this generation's total and the all-time total. */
export function grant(s: GarageState, tokens: number): number {
  const g = amount(tokens);
  s.tokens = amount(s.tokens + g);
  s.genLifetime = amount(s.genLifetime + g);
  s.stats.tokensAllTime = amount(s.stats.tokensAllTime + g);
  return g;
}

export function pushNews(s: GarageState, content: GarageContent, key: string, kind: NewsKind, at: number, params?: GarageNews['params']): void {
  const item: GarageNews = { uid: s.uidSeq++, key, kind, at, ...(params ? { params } : {}) };
  s.news = [...s.news, item].slice(-Math.max(1, content.news.keep));
}
