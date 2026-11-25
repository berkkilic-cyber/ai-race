/**
 * Daily missions and the streak: one small persisted store. Progress comes from the
 * existing stores (the Garage's lifetime stats, the race's actions and run endings) through
 * `installMissions()`; nothing here runs per game tick beyond a few comparisons. Rewards go
 * through the idle engine's claimDailyReward, into the open Garage or its save.
 */
import { create } from 'zustand';

import { getOwnedCapabilityLevel, getRunLengths, type GameState } from '@/engine';
import { claimDailyReward, deserialize, paradigmEffects, serialize, type GarageContent, type GarageState, type MissionsConfig } from '@/idle';

import { logError } from '../diagnostics/log';
import { garageNow } from '../garage/clock';
import { garageContent } from '../garage/content';
import { SAVE_KEY as GARAGE_SAVE_KEY, useGarageStore } from '../garage/store';
import { onGameAction, useGameStore } from '../store/game';
import { readValue, writeValue } from '../tutorial/storage';
import { EMPTY_SAVE, canClaim, canOpenCrate, newDay, newlyDone, readSave, streakOnClaim, streakView, utcDay, withGarage, withRace, writeSave, type MissionDay, type MissionsSave, type RaceCounter } from './logic';

export const MISSIONS_KEY = 'missions.v1';

/** A mission that just completed, for the toast. */
export interface MissionToast {
  key: number;
  id: string;
}

export interface MissionsStore {
  loaded: boolean;
  save: MissionsSave;
  /** Completed missions waiting for their toast. */
  toasts: MissionToast[];
  /** The last claim used the day off (for the streak_day event and the sheet). */
  lastUsedDayOff: boolean;
  /** Bumps on every claim (analytics, feel). */
  claimSeq: number;
  /** The missions sheet is open (buttons open it; the host at the screen's root draws it). */
  sheetOpen: boolean;
  openSheet(open: boolean): void;
  load(): Promise<void>;
  /** Starts a new day's missions if the UTC day changed (reads the Garage save for the player's progress). */
  ensureDay(): Promise<void>;
  claim(id: string): Promise<boolean>;
  openCrate(): Promise<boolean>;
  dismissToast(key: number): void;
  /** Debug and tests: replace the save. */
  replace(save: MissionsSave): void;
}

/** Clock for missions: the Garage clock (debug builds can move it). */
export const missionsNow = (): number => garageNow();

export function missionsConfig(content: GarageContent = garageContent()): MissionsConfig | undefined {
  return content.missions;
}

/** The Garage as it is now: the open Garage's state, else the save. */
async function readGarage(): Promise<GarageState> {
  const open = useGarageStore.getState().state;
  if (open) return open;
  const text = await readValue(GARAGE_SAVE_KEY).catch(() => null);
  return deserialize(text, garageContent(), garageNow()).state;
}

/** Writes a changed Garage back where it came from (the open Garage, else the save). */
async function writeGarage(next: GarageState): Promise<void> {
  const store = useGarageStore.getState();
  if (store.state) {
    useGarageStore.setState({ state: next });
    store.save(true);
    return;
  }
  await writeValue(GARAGE_SAVE_KEY, serialize(next)).catch((e) => logError('garage save', e));
}

let toastKey = 1;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
/** Writes are batched (progress changes often during play); claims write at once. */
const WRITE_DELAY_MS = 3000;

/** The crate's extra multiplier from the Garage (a Paradigm tree node); 1 without one. */
function crateMultOf(garage: GarageState): number {
  return paradigmEffects(garage, garageContent()).crateMult;
}

export const useMissionsStore = create<MissionsStore>()((set, get) => {
  const persist = (now = false) => schedulePersist(now);
  return {
    loaded: false,
    save: EMPTY_SAVE,
    toasts: [],
    lastUsedDayOff: false,
    claimSeq: 0,
    sheetOpen: false,

    openSheet(open) {
      set({ sheetOpen: open });
    },

    async load() {
      if (get().loaded) return;
      const text = await readValue(MISSIONS_KEY).catch(() => null);
      if (get().loaded) return;
      set({ loaded: true, save: readSave(text) });
      await get().ensureDay();
    },

    async ensureDay() {
      const cfg = missionsConfig();
      if (!cfg || !get().loaded) return;
      const day = utcDay(missionsNow());
      if (get().save.today?.day === day) return;
      const garage = await readGarage();
      if (get().save.today?.day === day) return;
      set({ save: { ...get().save, today: newDay(cfg, day, { stage: garage.stage, generation: garage.generation }, garage.stats) } });
      persist(true);
    },

    async claim(id) {
      const cfg = missionsConfig();
      await get().ensureDay();
      const today = get().save.today;
      if (!cfg || !today || !canClaim(cfg, today, id)) return false;
      const garage = await readGarage();
      const streakBefore = get().save.streak;
      const r = claimDailyReward(garage, garageContent(), 'mission', garageNow());
      if (!r.ok) return false;
      await writeGarage(r.state);
      const st = streakOnClaim(streakBefore, today.day, cfg.dayOffEveryDays);
      const latest = get().save.today ?? today;
      set({ save: { ...get().save, streak: st.streak, today: { ...latest, claimed: [...latest.claimed, id] } }, lastUsedDayOff: st.changed ? st.usedDayOff : get().lastUsedDayOff, claimSeq: get().claimSeq + 1 });
      persist(true);
      return true;
    },

    async openCrate() {
      const cfg = missionsConfig();
      const today = get().save.today;
      if (!cfg || !canOpenCrate(today)) return false;
      const garage = await readGarage();
      const streak = streakView(get().save.streak, today!.day).current;
      const r = claimDailyReward(garage, garageContent(), 'crate', garageNow(), { streak, crateMult: crateMultOf(garage) });
      if (!r.ok) return false;
      await writeGarage(r.state);
      const latest = get().save.today ?? today!;
      set({ save: { ...get().save, today: { ...latest, crate: true } }, claimSeq: get().claimSeq + 1 });
      persist(true);
      return true;
    },

    dismissToast(key) {
      set({ toasts: get().toasts.filter((x) => x.key !== key) });
    },

    replace(save) {
      set({ save, loaded: true, toasts: [] });
      persist(true);
    },
  };
});

/** Feeds Garage counters into today's missions (a no-op unless a counted stat changed). */
export function noteGarage(state: GarageState | null): void {
  const st = useMissionsStore.getState();
  const cfg = missionsConfig();
  const today = st.save.today;
  if (!cfg || !state || !today) return;
  if (utcDay(missionsNow()) !== today.day) {
    void st.ensureDay();
    return;
  }
  const next = withGarage(today, state.stats);
  if (next !== today) commit(next, cfg);
}

/** Feeds a race counter into today's missions. */
export function noteRace(counter: RaceCounter, amount: number): void {
  const st = useMissionsStore.getState();
  const cfg = missionsConfig();
  const today = st.save.today;
  if (!cfg || !today) return;
  if (utcDay(missionsNow()) !== today.day) {
    void st.ensureDay().then(() => noteRace(counter, amount));
    return;
  }
  const next = withRace(today, counter, amount);
  if (next !== today) commit(next, cfg);
}

function commit(day: MissionDay, cfg: MissionsConfig): void {
  const st = useMissionsStore.getState();
  const fresh = newlyDone(cfg, day);
  const next = fresh.length ? { ...day, done: [...day.done, ...fresh] } : day;
  useMissionsStore.setState({ save: { ...st.save, today: next }, toasts: fresh.length ? [...st.toasts, ...fresh.map((id) => ({ key: toastKey++, id }))] : st.toasts });
  schedulePersist(fresh.length > 0);
}

function schedulePersist(now: boolean): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  const write = () => void writeValue(MISSIONS_KEY, writeSave(useMissionsStore.getState().save)).catch((e) => logError('missions save', e));
  if (now) write();
  else
    writeTimer = setTimeout(() => {
      writeTimer = null;
      write();
    }, WRITE_DELAY_MS);
}

/** The race's player-action counters: launches, moments and the model tier reached. */
function raceEnded(next: GameState): void {
  const { pack } = useGameStore.getState();
  noteRace('raceFinish', 1);
  const shortest = getRunLengths(pack)[0]?.id;
  if (shortest && next.runLength === shortest) noteRace('sprintFinish', 1);
  if (next.ending?.kind === 'win') noteRace('raceWin', 1);
  noteRace('raceTier', getOwnedCapabilityLevel(next, pack, next.playerLabId));
}

let installed = false;
let unsubscribe: (() => void)[] = [];

/**
 * Subscribes the missions to the Garage and race stores (once; safe to call from every
 * place that shows missions). Per Garage tick: a reference check and eight number
 * comparisons; per race tick: a reference and a status check.
 */
export function installMissions(): void {
  if (installed) return;
  installed = true;
  void useMissionsStore.getState().load();
  let lastStats: GarageState['stats'] | null = null;
  let lastSig = '';
  const offGarage = useGarageStore.subscribe((st) => {
    const s = st.state;
    if (!s || s.stats === lastStats) return;
    lastStats = s.stats;
    const c = s.stats;
    const sig = `${c.taps}|${c.generatorsBought}|${c.autoBought}|${c.happeningsCaught}|${c.goldenCaught}|${c.upgradesBought}|${c.trainingRuns}|${c.incidentsFixed}|${c.modelsShipped}`;
    if (sig === lastSig) return;
    lastSig = sig;
    noteGarage(s);
  });
  const offRace = useGameStore.subscribe((st, prev) => {
    const next = st.state;
    const before = prev.state;
    if (!next || next === before) return;
    if (next.status === 'ended' && before?.status === 'running' && next.seed === before.seed) raceEnded(next);
  });
  const offActions = onGameAction((action, state) => {
    if (action.labId !== state.playerLabId) return;
    if (action.type === 'launchInRegion') noteRace('regions', 1);
    else if (action.type === 'collectMoment') noteRace('moments', 1);
    else if (action.type === 'buyNode') noteRace('raceTier', getOwnedCapabilityLevel(state, useGameStore.getState().pack, state.playerLabId));
  });
  unsubscribe = [offGarage, offRace, offActions];
}

/** Tests: drop the subscriptions and the state. */
export function resetMissionsForTests(): void {
  installed = false;
  for (const off of unsubscribe) off();
  unsubscribe = [];
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  useMissionsStore.setState({ loaded: false, save: EMPTY_SAVE, toasts: [], lastUsedDayOff: false, claimSeq: 0, sheetOpen: false });
}
