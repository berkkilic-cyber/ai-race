/**
 * The daily challenge's small store: the local record (one scored attempt per day, streak,
 * last 30 results) kept with the shared storage helper, the clock (UTC date, with a debug
 * override), starting today's daily, and noticing when a daily run ends. Rules: ./logic.ts.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';

import type { ContentPack, GameState } from '@/engine';
import type { DailyContent } from '@/content';

import { logLifecycle } from '../diagnostics/log';
import { garageContent } from '../garage/content';
import { storyFor } from '../frontpage/recorder';
import { raceCells, raceCode } from '../frontpage/story';
import { bonusForSetup } from '../meta/logic';
import { useMetaStore } from '../meta/store';
import { getPackEntry } from '../packs';
import { useGameStore, type NewGameSetup } from '../store/game';
import { loadRunSave } from '../store/runSave';
import { readValue, writeValue } from '../tutorial/storage';
import {
  abandonAttempt,
  canPlayScored,
  dailyFor,
  dailyGameSetup,
  dateKeyOf,
  emptyRecord,
  finishAttempt,
  isDateKey,
  keyToMs,
  parseRecord,
  settleAttempt,
  startAttempt,
  streakOf,
  type DailyDef,
  type DailyRecord,
  type DailyResult,
  type DailyTag,
} from './logic';

/** Storage key of the daily record. */
export const DAILY_KEY = 'ai-race.daily.v1';

// ───────────── Clock ─────────────

let todayOverride: string | null = null;

/** Now, as the daily sees it: real time, or 12:00 UTC of the debug "today". */
export function dailyNow(): number {
  return todayOverride ? keyToMs(todayOverride) + 12 * 3600_000 : Date.now();
}

/**
 * Today's UTC date key. Components pass the store's `clock` so the React Compiler, which
 * treats render as pure, recomputes it when the debug clock moves.
 */
export function todayKey(_clock?: number): string {
  return dateKeyOf(dailyNow());
}

// ───────────── Events (analytics wiring listens) ─────────────

export type DailyEvent = { type: 'start'; day: number } | { type: 'end'; day: number; ending: string; score: number; streak: number };
const listeners = new Set<(e: DailyEvent) => void>();

/** Daily attempts starting and ending (src/ui/analytics). Returns an unsubscribe. */
export function onDailyEvent(listener: (e: DailyEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(e: DailyEvent): void {
  for (const l of listeners) {
    try {
      l(e);
    } catch {
      // a listener never breaks the game
    }
  }
}

// ───────────── Store ─────────────

export interface DailyStore {
  loaded: boolean;
  record: DailyRecord;
  /** Bumped when the debug clock changes, so the card re-renders. */
  clock: number;
  load(): Promise<void>;
  /** Debug: pretend today is this UTC date (null: the real date). */
  setToday(key: string | null): void;
}

function persist(record: DailyRecord): void {
  useDailyStore.setState({ record });
  void writeValue(DAILY_KEY, JSON.stringify(record)).catch(() => undefined);
}

/** The key of the scored daily that can still be continued (saved, or the run in the store), if any. */
async function liveScoredKey(): Promise<string | null> {
  const { state, setup } = useGameStore.getState();
  if (state && state.status === 'running' && setup?.daily?.scored && setup.seed === state.seed) return setup.daily.key;
  const save = await loadRunSave().catch(() => null);
  return save?.setup.daily?.scored ? save.setup.daily.key : null;
}

export const useDailyStore = create<DailyStore>()((set, get) => ({
  loaded: false,
  record: emptyRecord(),
  clock: 0,

  async load() {
    const text = await readValue(DAILY_KEY).catch(() => null);
    const record = parseRecord(text);
    // A started attempt that can no longer be continued was abandoned.
    const settled = settleAttempt(record, await liveScoredKey());
    set({ loaded: true });
    if (settled !== record) persist(settled);
    else set({ record });
  },

  setToday(key) {
    todayOverride = key && isDateKey(key) ? key : null;
    set({ clock: get().clock + 1 });
  },
}));

/** The daily content of a pack (undefined: that theme has no daily). */
export function dailyContent(pack: ContentPack): DailyContent | undefined {
  try {
    return getPackEntry(pack.id).daily;
  } catch {
    return undefined;
  }
}

/** Today's challenge for a pack (null without daily content). */
export function todaysDaily(pack: ContentPack, key: string = todayKey()): DailyDef | null {
  const content = dailyContent(pack);
  return content ? dailyFor(key, pack, content) : null;
}

/**
 * The new-run setup of a daily. Perks go through bonusForSetup like every run, with
 * `daily: true`, which turns them off: the twist's bonus is the only one.
 */
export function dailyNewGameSetup(def: DailyDef, playerName: string, scored: boolean, packId: string): NewGameSetup {
  const perks = bonusForSetup({ perksOn: useMetaStore.getState().perksOn, daily: true }, Math.floor(useMetaStore.getState().labRep + 1e-9), garageContent());
  const base = dailyGameSetup(def, playerName);
  const tag: DailyTag = { key: def.key, number: def.number, scored };
  return { ...base, packId, perksOn: false, perkIds: perks.perkIds, daily: tag };
}

/**
 * Starts today's daily: the scored attempt when it is still available, else practice.
 * Returns whether the run is scored.
 */
export function startDaily(pack: ContentPack, playerName: string, wantScored: boolean): boolean {
  const def = todaysDaily(pack);
  if (!def) return false;
  const record = useDailyStore.getState().record;
  const scored = wantScored && canPlayScored(record, def.key);
  if (scored) {
    persist(startAttempt(record, def));
    emit({ type: 'start', day: def.number });
  }
  useGameStore.getState().newGame(dailyNewGameSetup(def, playerName, scored, pack.id));
  logLifecycle('daily started', { day: def.number, scored: scored ? 1 : 0, twist: def.twist.id });
  return scored;
}

/** A setup replayed from a scored daily (Restart, Rematch) becomes practice: one scored try per day. */
export function asPractice<T extends NewGameSetup>(setup: T): T {
  return setup.daily?.scored ? { ...setup, daily: { ...setup.daily, scored: false } } : setup;
}

/** True when the store's run is today's (or any day's) scored daily attempt still in progress. */
export function isScoredDailyRun(): boolean {
  const { state, setup } = useGameStore.getState();
  return !!(state && setup?.daily?.scored && setup.seed === state.seed && state.status === 'running');
}

/** The run in progress is left for good (Abandon, Restart, a new lab over its save): its attempt counts as played. */
export function abandonScoredDaily(): void {
  const record = useDailyStore.getState().record;
  if (!record.started) return;
  persist(abandonAttempt(record));
  logLifecycle('daily abandoned', { day: record.started.number });
}

/** The daily tag of a finished run that was the scored attempt (else null). */
function scoredTagOf(state: GameState): DailyTag | null {
  const setup = useGameStore.getState().setup;
  return setup?.daily?.scored && setup.seed === state.seed ? setup.daily : null;
}

/** The result a finished scored daily records. */
export function resultOf(state: GameState, tag: DailyTag, twist: string): DailyResult | null {
  const e = state.ending;
  if (!e) return null;
  return { key: tag.key, number: tag.number, twist, ending: e.endingId, trigger: e.trigger, won: e.kind === 'win', score: Math.round(e.score), days: e.tick + 1, race: raceCode(raceCells(storyFor(state), e.tick)) };
}

// A scored daily that reaches its ending records its result once.
useGameStore.subscribe((s, prev) => {
  const next = s.state;
  if (!next || next === prev.state || next.status !== 'ended' || prev.state?.status === 'ended' || !next.ending) return;
  const tag = scoredTagOf(next);
  if (!tag) return;
  const before = useDailyStore.getState().record;
  const def = todaysDaily(s.pack, tag.key);
  const result = resultOf(next, tag, before.started?.twist ?? def?.twist.id ?? '');
  if (!result) return;
  const record = finishAttempt(before, result);
  if (record === before) return;
  persist(record);
  const streak = streakOf(record, tag.key).current;
  emit({ type: 'end', day: tag.number, ending: result.ending ?? 'none', score: result.score, streak });
  logLifecycle('daily finished', { day: tag.number, score: result.score, streak });
});

/**
 * Web debug pages (`?debug=1`): `window.__daily` for screenshot scripts: `setToday('2026-11-26')`
 * moves the daily clock, `record()` reads the record, `reset()` clears it. `?today=YYYY-MM-DD`
 * sets the clock on load.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined' && /[?&]debug=1\b/.test(window.location?.search ?? '')) {
  const m = /[?&]today=(\d{4}-\d{2}-\d{2})\b/.exec(window.location.search);
  if (m) useDailyStore.getState().setToday(m[1]);
  (window as unknown as { __daily?: unknown }).__daily = {
    setToday: (key: string | null) => useDailyStore.getState().setToday(key),
    today: () => todayKey(),
    record: () => useDailyStore.getState().record,
    reset: () => persist(emptyRecord()),
  };
}
