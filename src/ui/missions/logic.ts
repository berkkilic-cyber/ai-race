/**
 * Daily missions and the login streak: pure rules, no React, no storage. The store
 * (store.ts) keeps one MissionsSave and feeds it counters from the Garage and race stores.
 *
 * Days are UTC days (`utcDay`), so everyone gets the same three missions on the same day
 * (given the same progress: a mission is only offered once the player can do it).
 */
import { MISSION_SLOTS, type GarageStats, type MissionDef, type MissionsConfig } from '@/idle';

export const DAY_MS = 86_400_000;

/** The UTC day number of a timestamp (days since 1970-01-01). */
export function utcDay(ms: number): number {
  return Number.isFinite(ms) ? Math.floor(ms / DAY_MS) : 0;
}

/** Ms until the next UTC day starts (the next set of missions). */
export function msToNextDay(ms: number): number {
  if (!Number.isFinite(ms)) return DAY_MS;
  return (utcDay(ms) + 1) * DAY_MS - ms;
}

// ---------------------------------------------------------------------------------------
// Counters

/** Counters read from the Garage's lifetime stats (progress = now − the day's baseline). */
export const GARAGE_COUNTERS = ['taps', 'bought', 'happenings', 'golden', 'upgrades', 'training', 'incidents', 'ships'] as const;
/** Counters the race tracker adds to (or raises, for `MAX_COUNTERS`). */
export const RACE_COUNTERS = ['raceFinish', 'sprintFinish', 'raceWin', 'regions', 'raceTier', 'moments'] as const;
/** Race counters that keep the best value of the day instead of a sum. */
export const MAX_COUNTERS: readonly string[] = ['raceTier'];

export type GarageCounter = (typeof GARAGE_COUNTERS)[number];
export type RaceCounter = (typeof RACE_COUNTERS)[number];
export type CounterId = GarageCounter | RaceCounter;

export const ALL_COUNTERS: readonly string[] = [...GARAGE_COUNTERS, ...RACE_COUNTERS];

export type Counts = Partial<Record<CounterId, number>>;

const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The Garage counters in a set of lifetime stats (player purchases only: the auto-buy helper does not count). */
export function garageCounters(stats: Partial<GarageStats> | null | undefined): Record<GarageCounter, number> {
  const s = stats ?? {};
  return {
    taps: n(s.taps),
    bought: Math.max(0, n(s.generatorsBought) - n(s.autoBought)),
    happenings: n(s.happeningsCaught),
    golden: n(s.goldenCaught),
    upgrades: n(s.upgradesBought),
    training: n(s.trainingRuns),
    incidents: n(s.incidentsFixed),
    ships: n(s.modelsShipped),
  };
}

/** A short signature of the Garage counters: equal signatures mean nothing a mission counts changed. */
export function garageSignature(stats: Partial<GarageStats> | null | undefined): string {
  const c = garageCounters(stats);
  return `${c.taps}|${c.bought}|${c.happenings}|${c.golden}|${c.upgrades}|${c.training}|${c.incidents}|${c.ships}`;
}

// ---------------------------------------------------------------------------------------
// The day's missions

export interface MissionDay {
  day: number;
  /** The three missions (garage, race, stretch), fixed for the day once picked. */
  ids: string[];
  /** Garage counters when the day started (null until the Garage save was first seen that day). */
  base: Record<GarageCounter, number> | null;
  /** Garage counters as last seen. */
  garage: Record<GarageCounter, number> | null;
  /** Race counters this day. */
  race: Counts;
  /** Missions completed (in the order they completed). */
  done: string[];
  claimed: string[];
  crate: boolean;
}

export interface Streak {
  /** Consecutive days (a day off bridging one gap) with at least one mission claimed. */
  current: number;
  best: number;
  /** The last day a mission was claimed (-1: never). */
  lastDay: number;
  /** The first day a day off can cover (a day off recharges `dayOffEveryDays` after it is used). */
  dayOffFrom: number;
  /** The last day a day off covered (-1: none). */
  coveredDay: number;
}

export interface MissionsSave {
  v: 1;
  today: MissionDay | null;
  streak: Streak;
}

export const EMPTY_STREAK: Streak = { current: 0, best: 0, lastDay: -1, dayOffFrom: 0, coveredDay: -1 };
export const EMPTY_SAVE: MissionsSave = { v: 1, today: null, streak: EMPTY_STREAK };

/** What decides which missions a player may get: their Garage stage and model generation. */
export interface PickContext {
  stage: number;
  generation: number;
}

/** A small seeded generator (mulberry32) for the daily pick; independent of the game's PRNG. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True if the player can do this mission at their progress. */
export function eligible(def: MissionDef, ctx: PickContext): boolean {
  return (def.minStage ?? 0) <= ctx.stage && (def.minGeneration ?? 0) <= ctx.generation;
}

/**
 * The day's three missions: one per slot (garage, race, stretch), drawn by weight from the
 * missions the player can do, from a generator seeded by the UTC day. The stretch avoids a
 * counter already used that day when it can.
 */
export function pickMissions(cfg: MissionsConfig, day: number, ctx: PickContext): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  MISSION_SLOTS.forEach((slot, i) => {
    const rnd = seeded(Math.imul(day + 1, 2654435761) ^ (i * 40503 + 17));
    let pool = cfg.defs.filter((d) => d.slot === slot && eligible(d, ctx));
    const fresh = pool.filter((d) => !d.goals.some((g) => used.has(g.counter)));
    if (fresh.length) pool = fresh;
    const total = pool.reduce((sum, d) => sum + Math.max(0, d.weight ?? 1), 0);
    if (!pool.length || total <= 0) return;
    let roll = rnd() * total;
    let pick = pool[pool.length - 1];
    for (const d of pool) {
      roll -= Math.max(0, d.weight ?? 1);
      if (roll < 0) {
        pick = d;
        break;
      }
    }
    out.push(pick.id);
    for (const g of pick.goals) used.add(g.counter);
  });
  return out;
}

/** A fresh day: its missions picked, the Garage baseline if the save is known. */
export function newDay(cfg: MissionsConfig, day: number, ctx: PickContext, stats: Partial<GarageStats> | null): MissionDay {
  const base = stats ? garageCounters(stats) : null;
  return { day, ids: pickMissions(cfg, day, ctx), base, garage: base, race: {}, done: [], claimed: [], crate: false };
}

/** A counter's value today. */
export function counterValue(day: MissionDay, counter: string): number {
  if ((GARAGE_COUNTERS as readonly string[]).includes(counter)) {
    if (!day.base || !day.garage) return 0;
    const k = counter as GarageCounter;
    return Math.max(0, n(day.garage[k]) - n(day.base[k]));
  }
  return n(day.race[counter as RaceCounter]);
}

export interface MissionProgress {
  def: MissionDef;
  /** 0..1 (the best of its goals). */
  progress: number;
  /** The best goal's value and target, for "120 / 300". */
  value: number;
  goal: number;
  done: boolean;
  claimed: boolean;
}

export function missionProgress(def: MissionDef, day: MissionDay): MissionProgress {
  let best = { progress: 0, value: 0, goal: def.goals[0]?.goal ?? 1 };
  for (const g of def.goals) {
    const value = counterValue(day, g.counter);
    const progress = g.goal > 0 ? Math.min(1, value / g.goal) : 1;
    if (progress > best.progress || (progress === best.progress && best.value === 0 && value > 0)) best = { progress, value: Math.min(value, g.goal), goal: g.goal };
  }
  const done = day.done.includes(def.id) || best.progress >= 1;
  return { def, ...best, value: done ? best.goal : best.value, progress: done ? 1 : best.progress, done, claimed: day.claimed.includes(def.id) };
}

/** The day's missions with their progress (unknown ids skipped). */
export function dayProgress(cfg: MissionsConfig, day: MissionDay | null): MissionProgress[] {
  if (!day) return [];
  const out: MissionProgress[] = [];
  for (const id of day.ids) {
    const def = cfg.defs.find((d) => d.id === id);
    if (def) out.push(missionProgress(def, day));
  }
  return out;
}

/** Missions that reached their goal and are not yet marked done (in day order). */
export function newlyDone(cfg: MissionsConfig, day: MissionDay): string[] {
  return dayProgress(cfg, day)
    .filter((p) => p.progress >= 1 && !day.done.includes(p.def.id))
    .map((p) => p.def.id);
}

/** The Garage counters seen now: sets the day's baseline the first time. Same object when nothing changed. */
export function withGarage(day: MissionDay, stats: Partial<GarageStats>): MissionDay {
  const now = garageCounters(stats);
  if (!day.base) return { ...day, base: now, garage: now };
  const prev = day.garage;
  if (prev && GARAGE_COUNTERS.every((k) => prev[k] === now[k])) return day;
  // A lower count than the baseline means another save (a reset): start the day's count from here.
  if (GARAGE_COUNTERS.some((k) => now[k] < (day.base as Record<GarageCounter, number>)[k])) return { ...day, base: now, garage: now };
  return { ...day, garage: now };
}

/** A race counter moved: added to (or raised, for MAX_COUNTERS). */
export function withRace(day: MissionDay, counter: RaceCounter, amount: number): MissionDay {
  if (!Number.isFinite(amount) || amount <= 0) return day;
  const prev = n(day.race[counter]);
  const next = MAX_COUNTERS.includes(counter) ? Math.max(prev, amount) : prev + amount;
  return next === prev ? day : { ...day, race: { ...day.race, [counter]: next } };
}

/** The mission can be claimed now. */
export function canClaim(cfg: MissionsConfig, day: MissionDay | null, id: string): boolean {
  if (!day || !day.ids.includes(id) || day.claimed.includes(id)) return false;
  const def = cfg.defs.find((d) => d.id === id);
  return !!def && missionProgress(def, day).done;
}

/** The daily crate can be opened: all the day's missions claimed, crate not yet opened. */
export function canOpenCrate(day: MissionDay | null): boolean {
  return !!day && day.ids.length > 0 && !day.crate && day.ids.every((id) => day.claimed.includes(id));
}

/** Missions done and waiting for a claim (plus the crate when ready): the badge. */
export function badgeCount(cfg: MissionsConfig, day: MissionDay | null): number {
  if (!day) return 0;
  return dayProgress(cfg, day).filter((p) => p.done && !p.claimed).length + (canOpenCrate(day) ? 1 : 0);
}

// ---------------------------------------------------------------------------------------
// The streak

/** True if a day off can cover `day`. */
export function dayOffReady(s: Streak, day: number): boolean {
  return day >= s.dayOffFrom;
}

/**
 * A claim on `day`: the streak grows by one if the last claim was yesterday, or the day
 * before with a day off ready to cover the gap (it is used and recharges `every` days
 * later); otherwise it starts again at 1. A second claim on the same day changes nothing.
 */
export function streakOnClaim(s: Streak, day: number, every: number): { streak: Streak; usedDayOff: boolean; changed: boolean } {
  if (s.lastDay === day) return { streak: s, usedDayOff: false, changed: false };
  const gap = s.lastDay < 0 ? Infinity : day - s.lastDay;
  let current = 1;
  let usedDayOff = false;
  let { dayOffFrom, coveredDay } = s;
  if (gap === 1) current = s.current + 1;
  else if (gap === 2 && dayOffReady(s, day - 1)) {
    current = s.current + 1;
    usedDayOff = true;
    coveredDay = day - 1;
    dayOffFrom = day - 1 + every;
  }
  const streak: Streak = { current, best: Math.max(s.best, current), lastDay: day, dayOffFrom, coveredDay };
  return { streak, usedDayOff, changed: true };
}

export interface StreakView {
  /** The streak as it stands today (0 once a gap has broken it; it never shows a loss as a warning). */
  current: number;
  best: number;
  /** A mission claimed today already counts. */
  countedToday: boolean;
  /** A day off is ready to cover a missed day. */
  dayOffReady: boolean;
  /** Days until the day off is ready again (0 when ready). */
  dayOffInDays: number;
  /** Yesterday was missed and is (or will be, with today's claim) covered by the day off. */
  coveringYesterday: boolean;
  /** The last day a day off covered (-1: none). */
  coveredDay: number;
}

export function streakView(s: Streak, today: number): StreakView {
  const gap = s.lastDay < 0 ? Infinity : today - s.lastDay;
  const covering = gap === 2 && dayOffReady(s, today - 1);
  const alive = gap <= 1 || covering;
  return {
    current: alive ? s.current : 0,
    best: s.best,
    countedToday: gap === 0,
    dayOffReady: dayOffReady(s, today),
    dayOffInDays: Math.max(0, s.dayOffFrom - today),
    coveringYesterday: covering,
    coveredDay: s.coveredDay,
  };
}

// ---------------------------------------------------------------------------------------
// Saves

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : fallback);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 10) : []);

function counts<K extends string>(v: unknown, keys: readonly K[]): Record<K, number> | null {
  if (!isObj(v)) return null;
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = Math.max(0, int(v[k], 0));
  return out;
}

function raceCounts(v: unknown): Counts {
  const out: Counts = {};
  if (!isObj(v)) return out;
  for (const k of RACE_COUNTERS) if (k in v) out[k] = Math.max(0, int(v[k], 0));
  return out;
}

/** Reads a stored save, repairing what it cannot trust; anything unreadable is a fresh save. */
export function readSave(text: string | null | undefined): MissionsSave {
  if (!text) return EMPTY_SAVE;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return EMPTY_SAVE;
  }
  if (!isObj(raw) || raw.v !== 1) return EMPTY_SAVE;
  const st = isObj(raw.streak) ? raw.streak : {};
  const streak: Streak = {
    current: Math.max(0, int(st.current, 0)),
    best: Math.max(0, int(st.best, 0)),
    lastDay: int(st.lastDay, -1),
    dayOffFrom: int(st.dayOffFrom, 0),
    coveredDay: int(st.coveredDay, -1),
  };
  streak.best = Math.max(streak.best, streak.current);
  const d = isObj(raw.today) ? raw.today : null;
  const today: MissionDay | null = d
    ? {
        day: int(d.day, 0),
        ids: strs(d.ids).slice(0, 3),
        base: counts(d.base, GARAGE_COUNTERS),
        garage: counts(d.garage, GARAGE_COUNTERS),
        race: raceCounts(d.race),
        done: strs(d.done),
        claimed: strs(d.claimed),
        crate: d.crate === true,
      }
    : null;
  return { v: 1, today, streak };
}

export function writeSave(save: MissionsSave): string {
  return JSON.stringify(save);
}
