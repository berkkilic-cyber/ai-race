/**
 * The daily challenge as pure functions (no React, no storage): the UTC date decides the
 * whole setup, so every player in the world gets the same run with no server; the local
 * record holds one scored attempt per day, the streak and the last 30 results.
 * See docs/DAILY.md.
 */
import type { ContentPack, EndingTrigger, GameSetup } from '@/engine';
import type { DailyContent, DailyTwistDef } from '@/content';

export const DAY_MS = 86_400_000;
/** Results kept in the local history. */
export const HISTORY_MAX = 30;
/** Storage format of the record; another one starts a fresh record. */
export const RECORD_VERSION = 1;

// ───────────── Dates (UTC) ─────────────

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** "2026-11-25": the UTC calendar date of an epoch time. The daily changes at 00:00 UTC. */
export function dateKeyOf(ms: number): string {
  const d = new Date(Number.isFinite(ms) ? ms : 0);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Epoch ms of 00:00 UTC on a date key (NaN for a malformed key). */
export function keyToMs(key: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? Date.parse(`${key}T00:00:00Z`) : NaN;
}

export function isDateKey(key: unknown): key is string {
  return typeof key === 'string' && Number.isFinite(keyToMs(key)) && dateKeyOf(keyToMs(key)) === key;
}

/** The date key `n` days after `key` (negative: before). */
export function addDays(key: string, n: number): string {
  return dateKeyOf(keyToMs(key) + n * DAY_MS);
}

/** Whole days from `from` to `to` (date keys). */
export function daysBetween(from: string, to: string): number {
  return Math.round((keyToMs(to) - keyToMs(from)) / DAY_MS);
}

/** Daily number: 1 on the epoch date, counting up by one per UTC day. */
export function dayNumber(key: string, epoch: string): number {
  return daysBetween(epoch, key) + 1;
}

/** Milliseconds until the next daily (the next 00:00 UTC). Always in (0, DAY_MS]. */
export function msUntilNextDaily(ms: number): number {
  const start = keyToMs(dateKeyOf(ms));
  return start + DAY_MS - ms;
}

// ───────────── Deterministic choices ─────────────

/** FNV-1a, 32 bit: a stable hash of a string (same on every device and engine). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A small seeded generator (mulberry32): numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The twist of a day: twists are dealt in blocks of `count` days, each block a shuffle
 * seeded by its number, so every twist comes once per block and never twice in a row (a block
 * that would start with the previous block's last twist starts with its second instead).
 */
export function twistIndexFor(day: number, count: number): number {
  if (count <= 1) return 0;
  const block = Math.floor((day - 1) / count);
  const order = (b: number): number[] => {
    const deck = shuffled(
      Array.from({ length: count }, (_, i) => i),
      seededRandom(hashString(`twist-block:${b}`)),
    );
    if (b > 0) {
      const prev = shuffled(
        Array.from({ length: count }, (_, i) => i),
        seededRandom(hashString(`twist-block:${b - 1}`)),
      );
      if (deck[0] === prev[count - 1]) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    return deck;
  };
  const pos = (((day - 1) % count) + count) % count;
  return order(block)[pos];
}

/** Everything about one day's challenge. */
export interface DailyDef {
  /** UTC date key. */
  key: string;
  /** Daily number (1 = the pack's epoch). */
  number: number;
  seed: number;
  founderId: string;
  homeRegion: string;
  difficulty?: string;
  runLength?: string;
  twist: DailyTwistDef;
  /** The rivals taking part when the twist limits them (else all). */
  rivalIds?: string[];
  /** The day's named rival for {rival} in the twist text (the first of rivalIds), if any. */
  rivalId?: string;
}

/**
 * THE date-to-setup function. Pure: a date key, a pack and its daily content give the same
 * challenge on every device. Each choice hashes the date with its own salt, so adding a
 * region does not change the twist, and so on.
 */
export function dailyFor(key: string, pack: ContentPack, content: DailyContent): DailyDef {
  const number = dayNumber(key, content.epoch);
  const pick = <T>(list: readonly T[], salt: string): T => list[hashString(`${key}:${salt}`) % list.length];
  const homes = content.homeRegions?.length ? content.homeRegions : pack.regions.filter((r) => !pack.rivals.some((rv) => rv.homeRegion === r.id)).map((r) => r.id);
  const twist = content.twists[twistIndexFor(number, content.twists.length)];
  let rivalIds: string[] | undefined;
  if (twist.rivals !== undefined && twist.rivals < pack.rivals.length) {
    const order = shuffled(
      pack.rivals.map((r) => r.id),
      seededRandom(hashString(`${key}:rivals`)),
    );
    const chosen = new Set(order.slice(0, Math.max(1, twist.rivals)));
    // Keep the pack's order (entry order is part of the balance).
    rivalIds = pack.rivals.map((r) => r.id).filter((id) => chosen.has(id));
  }
  const level = content.difficulty ?? pack.defaultDifficulty;
  const length = pack.runLengths?.some((r) => r.id === content.runLength) ? content.runLength : undefined;
  return {
    key,
    number,
    // A positive 31-bit seed like the store's random ones.
    seed: hashString(`${key}:seed`) % 0x7fffffff,
    founderId: pick(pack.founders, 'founder').id,
    homeRegion: pick(homes, 'home'),
    ...(level ? { difficulty: level } : {}),
    ...(length ? { runLength: length } : {}),
    twist,
    ...(rivalIds ? { rivalIds, rivalId: rivalIds[0] } : {}),
  };
}

/** What a run's setup carries about the daily: which day, and whether it is the scored attempt. */
export interface DailyTag {
  key: string;
  number: number;
  scored: boolean;
}

/** The engine setup of a daily for a lab name (no perks: the twist's bonus is the only one). */
export function dailyGameSetup(def: DailyDef, playerName: string): GameSetup {
  return {
    playerName,
    founderId: def.founderId,
    homeRegion: def.homeRegion,
    seed: def.seed,
    ...(def.difficulty ? { difficulty: def.difficulty } : {}),
    ...(def.runLength ? { runLength: def.runLength } : {}),
    ...(def.rivalIds ? { rivalIds: def.rivalIds } : {}),
    ...(def.twist.bonus ? { bonus: def.twist.bonus } : {}),
  };
}

// ───────────── The local record ─────────────

/** One finished (or abandoned) daily. Designed to be what a server leaderboard would receive. */
export interface DailyResult {
  key: string;
  number: number;
  twist: string;
  /** Ending id; null when the attempt was abandoned. */
  ending: string | null;
  trigger?: EndingTrigger;
  won?: boolean;
  score: number;
  /** Days survived (in-game). */
  days: number;
  /** The AGI race in fifths, one character each: Y = the player led, R = a rival led, . = unknown. */
  race?: string;
}

export interface DailyRecord {
  v: number;
  /** Oldest first, at most HISTORY_MAX. */
  history: DailyResult[];
  /** The scored attempt in progress (started, not yet finished or abandoned). */
  started: { key: string; number: number; twist: string } | null;
  /** The streak: the last day played and how many consecutive days led to it. */
  streak: { last: string | null; count: number };
  best: number;
}

export function emptyRecord(): DailyRecord {
  return { v: RECORD_VERSION, history: [], started: null, streak: { last: null, count: 0 }, best: 0 };
}

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Reads a stored record; anything malformed gives an empty one (never throws). */
export function parseRecord(text: string | null): DailyRecord {
  if (!text) return emptyRecord();
  try {
    const raw = JSON.parse(text) as Partial<DailyRecord>;
    if (!raw || raw.v !== RECORD_VERSION) return emptyRecord();
    const history = Array.isArray(raw.history) ? raw.history.filter((r) => r && isDateKey(r.key)).slice(-HISTORY_MAX) : [];
    const started = raw.started && isDateKey(raw.started.key) ? raw.started : null;
    const last = raw.streak && isDateKey(raw.streak.last) ? raw.streak.last : null;
    return { v: RECORD_VERSION, history, started, streak: { last, count: last ? Math.max(0, num(raw.streak?.count)) : 0 }, best: Math.max(0, num(raw.best)) };
  } catch {
    return emptyRecord();
  }
}

export function resultFor(record: DailyRecord, key: string): DailyResult | undefined {
  return record.history.find((r) => r.key === key);
}

/** True when the day's scored attempt is still available (not started, not finished). */
export function canPlayScored(record: DailyRecord, key: string): boolean {
  return !resultFor(record, key) && record.started?.key !== key;
}

/** Records the start of the day's scored attempt. It counts from here: no second scored try. */
export function startAttempt(record: DailyRecord, def: Pick<DailyDef, 'key' | 'number' | 'twist'>): DailyRecord {
  if (!canPlayScored(record, def.key)) return record;
  return { ...record, started: { key: def.key, number: def.number, twist: def.twist.id } };
}

function withResult(record: DailyRecord, result: DailyResult): DailyRecord {
  if (resultFor(record, result.key)) return record;
  const history = [...record.history, result].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(-HISTORY_MAX);
  let { last, count } = record.streak;
  if (!last || result.key > last) {
    count = last && daysBetween(last, result.key) === 1 ? count + 1 : 1;
    last = result.key;
  }
  const started = record.started?.key === result.key ? null : record.started;
  return { ...record, history, started, streak: { last, count }, best: Math.max(record.best, count) };
}

/** The scored attempt of `key` reached an ending. Ignored when that day already has a result. */
export function finishAttempt(record: DailyRecord, result: DailyResult): DailyRecord {
  return withResult(record, result);
}

/** The scored attempt in progress was abandoned (counts as played, with no score). */
export function abandonAttempt(record: DailyRecord): DailyRecord {
  const s = record.started;
  if (!s) return record;
  if (resultFor(record, s.key)) return { ...record, started: null };
  return withResult(record, { key: s.key, number: s.number, twist: s.twist, ending: null, score: 0, days: 0 });
}

export interface Streak {
  /** Consecutive days played up to today (or yesterday, while today is still open). */
  current: number;
  best: number;
}

/** The streak as of `today`: missing a whole day resets it to zero (best is kept). */
export function streakOf(record: DailyRecord, today: string): Streak {
  const { last, count } = record.streak;
  const gap = last ? daysBetween(last, today) : Infinity;
  const current = gap === 0 || gap === 1 ? count : 0;
  return { current, best: Math.max(record.best, current) };
}

/** What the start screen card shows for today. */
export type DailyStatus =
  | { kind: 'fresh' }
  /** Started and saved: it can be continued. */
  | { kind: 'inProgress' }
  | { kind: 'done'; result: DailyResult };

export function dailyStatus(record: DailyRecord, today: string): DailyStatus {
  const result = resultFor(record, today);
  if (result) return { kind: 'done', result };
  if (record.started?.key === today) return { kind: 'inProgress' };
  return { kind: 'fresh' };
}

/**
 * A started attempt that can no longer be continued (no saved run of it and it is not the
 * run in the store) was abandoned: it is settled as such. `liveKey` is the daily key of the
 * saved or current scored run, if any.
 */
export function settleAttempt(record: DailyRecord, liveKey: string | null): DailyRecord {
  if (!record.started || record.started.key === liveKey) return record;
  return abandonAttempt(record);
}

/** The last results, newest first. */
export function historyNewestFirst(record: DailyRecord): DailyResult[] {
  return record.history.slice().reverse();
}
