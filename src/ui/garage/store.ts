import { create } from 'zustand';

import {
  advance,
  buy,
  buyParadigmNode,
  buyMax,
  buyUpgrade,
  claimOffer,
  collectGolden,
  collectHappening,
  createGarage,
  deserialize,
  dismissOffline,
  keepModel,
  launchTraining,
  moveStaff,
  paradigmShift,
  prestige,
  runAutoShip,
  retireModel,
  scrapCandidates,
  serialize,
  setAutoBuy,
  setAutoShip,
  tap,
  tapIncident,
  type StaffLane,
  type ActionResult,
  type GarageContent,
  type GarageState,
  type OfferId,
} from '@/idle';

import { logError, logLifecycle } from '../diagnostics/log';
import { useFeelSettings } from '../feel/settings';
import { readValue, writeValue } from '../tutorial/storage';
import { garageNow } from './clock';
import { garageContent } from './content';

export const SAVE_KEY = 'garage.save';
/** Saves at most this often while playing (and at once on important actions and in the background). */
export const SAVE_THROTTLE_MS = 5000;

export type BuyMode = 1 | 10 | 'max';
export type GarageTab = 'build' | 'upgrades' | 'lab' | 'ship';

export interface GarageSettings {
  haptics: boolean;
}

export interface LaunchInfo {
  generation: number;
  gain: number;
  /** The launch-day choice, when the ship went through ship day. */
  choice?: string;
}

/** Ship day: the short launch sequence before a ship (reveal, headline, choice). */
export interface ShipDayInfo {
  step: 'reveal' | 'press' | 'choose';
}

/** A short centred message over the stage (a golden reward, a crate). */
export interface Flash {
  id: number;
  text: string;
}

export interface GarageStore {
  content: GarageContent;
  state: GarageState | null;
  settings: GarageSettings;
  buyMode: BuyMode;
  tab: GarageTab;
  launch: LaunchInfo | null;
  flash: Flash | null;
  /** Ship day in progress (null otherwise). */
  shipDay: ShipDayInfo | null;
  /** A stage the lab just moved into, for the "you moved" card (index, null when none). */
  stageCard: number | null;
  load(): Promise<void>;
  /** Advances to the clock (the screen calls this on a timer). */
  tick(): void;
  /** One tap; returns the tokens it made. */
  tap(): number;
  buy(id: string): boolean;
  buyUpgrade(id: string): boolean;
  ship(bonus?: boolean, choice?: string): boolean;
  openShipDay(): void;
  shipDayStep(step: ShipDayInfo['step']): void;
  closeShipDay(): void;
  dismissStage(): void;
  collectHappening(): ActionResult | null;
  launchTraining(): boolean;
  keepModel(uid: number, replaceUid?: number): boolean;
  scrapCandidates(): void;
  retireModel(uid: number): void;
  moveStaff(from: StaffLane, to: StaffLane): boolean;
  setAutoBuy(on: boolean): void;
  /** Paradigm Shift (after the player confirmed). */
  paradigmShift(): boolean;
  buyParadigmNode(id: string): boolean;
  setAutoShip(on: boolean): void;
  collectGolden(): ActionResult | null;
  tapIncident(): void;
  claim(offer: OfferId, choice?: string): ActionResult | null;
  dismissOffline(): void;
  dismissLaunch(): void;
  setFlash(text: string): void;
  setBuyMode(mode: BuyMode): void;
  setTab(tab: GarageTab): void;
  setHaptics(on: boolean): void;
  reset(): void;
  /** Writes the save now (`force`) or when the throttle allows. */
  save(force?: boolean): void;
  /** Debug: replace the state (screenshots, tests). */
  replace(state: GarageState): void;
}

let lastSave = 0;
let pendingSave: ReturnType<typeof setTimeout> | null = null;
let flashId = 1;

function writeSave(state: GarageState): void {
  lastSave = Date.now();
  writeValue(SAVE_KEY, serialize(state)).catch((e) => logError('garage save', e));
}

export const useGarageStore = create<GarageStore>()((set, get) => {
  /** Applies an action result: keeps the state, saves on success when `important`. */
  const apply = (r: ActionResult, important: boolean): boolean => {
    const before = get().state;
    set({ state: r.state });
    noteStage(before, r.state);
    if (r.ok && important) get().save(true);
    else get().save();
    return r.ok;
  };
  const now = () => garageNow();
  /** Shows the "you moved" card when the lab reaches a new stage. */
  const noteStage = (before: GarageState | null, after: GarageState) => {
    if (before && after.stage > before.stage) {
      logLifecycle('garage stage', { stage: after.stage });
      set({ stageCard: after.stage });
    }
  };
  return {
    content: garageContent(),
    state: null,
    settings: { haptics: true },
    buyMode: 1,
    tab: 'build',
    launch: null,
    flash: null,
    shipDay: null,
    stageCard: null,

    async load() {
      if (get().state) return;
      const content = get().content;
      const text = await readValue(SAVE_KEY);
      if (get().state) return;
      const loaded = deserialize(text, content, now());
      if (loaded.error) logError('garage load', new Error(loaded.error));
      if (loaded.migratedFrom) logLifecycle('garage save migrated', { from: loaded.migratedFrom });
      // Catch up to now: a long gap becomes the "While you were away" report.
      const state = advance(loaded.state, content, now());
      // Haptics live in the feel settings (they adopt the old garage.settings flag once); this is a mirror.
      const settings = { ...get().settings, haptics: useFeelSettings.getState().haptics };
      set({ state, settings });
      logLifecycle('garage opened', { generation: state.generation, away: state.offline ? Math.round(state.offline.awayMs / 1000) : 0 });
      writeSave(state);
    },

    tick() {
      const s = get().state;
      if (!s) return;
      let next = advance(s, get().content, now());
      // Auto-ship (a Paradigm tree node): ships quietly, the ticker carries the headline.
      const auto = runAutoShip(next, get().content, now());
      if (auto.ok) {
        logLifecycle('garage auto-shipped', { generation: auto.state.generation });
        next = auto.state;
      }
      if (next !== s) {
        set({ state: next });
        noteStage(s, next);
        if (auto.ok) get().save(true);
        else get().save();
      }
    },

    tap() {
      const s = get().state;
      if (!s) return 0;
      const r = tap(s, get().content, now());
      set({ state: r.state });
      noteStage(s, r.state);
      get().save();
      return r.gained;
    },

    buy(id) {
      const s = get().state;
      if (!s) return false;
      const mode = get().buyMode;
      const r = mode === 'max' ? buyMax(s, get().content, id, now()) : buy(s, get().content, id, mode, now());
      if (r.ok) logLifecycle('garage bought', { generator: id, owned: r.state.generators[id] });
      return apply(r, true);
    },

    buyUpgrade(id) {
      const s = get().state;
      if (!s) return false;
      const r = buyUpgrade(s, get().content, id, now());
      if (r.ok) logLifecycle('garage upgrade', { upgrade: id });
      return apply(r, true);
    },

    ship(bonus = false, choice) {
      const s = get().state;
      if (!s) return false;
      const r = prestige(s, get().content, now(), { bonus, choice });
      if (!r.ok) return apply(r, false);
      logLifecycle('garage shipped', { generation: r.state.generation, hype: r.state.hype - s.hype, bonus, choice: choice ?? null });
      set({ launch: { generation: r.state.generation, gain: r.state.hype - s.hype, ...(choice ? { choice } : {}) }, tab: 'build', shipDay: null });
      return apply(r, true);
    },

    openShipDay() {
      const s = get().state;
      if (!s) return;
      logLifecycle('garage ship day', { generation: s.generation });
      set({ shipDay: { step: 'reveal' } });
    },

    shipDayStep(step) {
      if (get().shipDay) set({ shipDay: { step } });
    },

    closeShipDay() {
      set({ shipDay: null });
    },

    dismissStage() {
      set({ stageCard: null });
    },

    collectHappening() {
      const s = get().state;
      if (!s) return null;
      const r = collectHappening(s, get().content, now());
      if (r.ok) logLifecycle('garage happening', { id: s.happening?.id });
      apply(r, false);
      return r;
    },

    launchTraining() {
      const s = get().state;
      if (!s) return false;
      const r = launchTraining(s, get().content, now());
      if (r.ok) logLifecycle('garage training run');
      return apply(r, true);
    },

    keepModel(uid, replaceUid) {
      const s = get().state;
      if (!s) return false;
      const r = keepModel(s, get().content, uid, now(), replaceUid);
      if (r.ok) logLifecycle('garage model kept', { uid });
      return apply(r, true);
    },

    scrapCandidates() {
      const s = get().state;
      if (s) apply(scrapCandidates(s, get().content, now()), true);
    },

    retireModel(uid) {
      const s = get().state;
      if (s) apply(retireModel(s, get().content, uid, now()), true);
    },

    moveStaff(from, to) {
      const s = get().state;
      if (!s) return false;
      return apply(moveStaff(s, get().content, from, to, now()), true);
    },

    setAutoBuy(on) {
      const s = get().state;
      if (s) apply(setAutoBuy(s, get().content, on, now()), true);
    },

    paradigmShift() {
      const s = get().state;
      if (!s) return false;
      const r = paradigmShift(s, get().content, now());
      if (!r.ok) return apply(r, false);
      logLifecycle('garage paradigm shift', { count: r.state.paradigm?.count ?? 0 });
      set({ state: r.state, tab: 'build', shipDay: null, launch: null, stageCard: null });
      get().save(true);
      return true;
    },

    buyParadigmNode(id) {
      const s = get().state;
      if (!s) return false;
      const r = buyParadigmNode(s, get().content, id, now());
      if (r.ok) logLifecycle('garage paradigm node', { id });
      return apply(r, true);
    },

    setAutoShip(on) {
      const s = get().state;
      if (s) apply(setAutoShip(s, get().content, on, now()), true);
    },

    collectGolden() {
      const s = get().state;
      if (!s) return null;
      const r = collectGolden(s, get().content, now());
      if (r.ok) logLifecycle('garage golden collected');
      apply(r, true);
      return r;
    },

    tapIncident() {
      const s = get().state;
      if (!s) return;
      const r = tapIncident(s, get().content, now());
      apply(r, !r.state.incident);
    },

    claim(offer, choice) {
      const s = get().state;
      if (!s) return null;
      if (offer === 'prestigeBonus') {
        const ok = get().ship(true, choice);
        return { state: get().state!, ok };
      }
      const r = claimOffer(s, get().content, offer, now());
      if (r.ok) logLifecycle('garage offer claimed', { offer });
      apply(r, true);
      return r;
    },

    dismissOffline() {
      const s = get().state;
      if (s) apply({ state: dismissOffline(s), ok: true }, true);
    },

    dismissLaunch() {
      set({ launch: null });
    },

    setFlash(text) {
      const id = flashId++;
      set({ flash: { id, text } });
      setTimeout(() => {
        if (get().flash?.id === id) set({ flash: null });
      }, 2000);
    },

    setBuyMode(mode) {
      set({ buyMode: mode });
    },

    setTab(tab) {
      set({ tab });
    },

    setHaptics(on) {
      useFeelSettings.getState().setHaptics(on);
      set({ settings: { ...get().settings, haptics: on } });
    },

    reset() {
      const state = createGarage(get().content, now());
      set({ state, launch: null, flash: null, tab: 'build', shipDay: null, stageCard: null });
      logLifecycle('garage reset');
      writeSave(state);
    },

    save(force = false) {
      const s = get().state;
      if (!s) return;
      if (pendingSave) {
        clearTimeout(pendingSave);
        pendingSave = null;
      }
      const wait = SAVE_THROTTLE_MS - (Date.now() - lastSave);
      if (force || wait <= 0) writeSave(s);
      else
        pendingSave = setTimeout(() => {
          pendingSave = null;
          const latest = get().state;
          if (latest) writeSave(latest);
        }, wait);
    },

    replace(state) {
      set({ state, stageCard: null });
      get().save(true);
    },
  };
});
