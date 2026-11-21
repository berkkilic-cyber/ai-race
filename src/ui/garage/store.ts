import { create } from 'zustand';

import {
  advance,
  buy,
  buyMax,
  buyUpgrade,
  claimOffer,
  collectGolden,
  createGarage,
  deserialize,
  dismissOffline,
  prestige,
  serialize,
  tap,
  tapIncident,
  type ActionResult,
  type GarageContent,
  type GarageState,
  type OfferId,
} from '@/idle';

import { logError, logLifecycle } from '../diagnostics/log';
import { readValue, writeValue } from '../tutorial/storage';
import { garageNow } from './clock';
import { garageContent } from './content';

export const SAVE_KEY = 'garage.save';
const SETTINGS_KEY = 'garage.settings';
/** Saves at most this often while playing (and at once on important actions and in the background). */
export const SAVE_THROTTLE_MS = 5000;

export type BuyMode = 1 | 10 | 'max';
export type GarageTab = 'build' | 'upgrades' | 'ship';

export interface GarageSettings {
  haptics: boolean;
}

export interface LaunchInfo {
  generation: number;
  gain: number;
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
  load(): Promise<void>;
  /** Advances to the clock (the screen calls this on a timer). */
  tick(): void;
  /** One tap; returns the tokens it made. */
  tap(): number;
  buy(id: string): boolean;
  buyUpgrade(id: string): boolean;
  ship(bonus?: boolean): boolean;
  collectGolden(): ActionResult | null;
  tapIncident(): void;
  claim(offer: OfferId): ActionResult | null;
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
    set({ state: r.state });
    if (r.ok && important) get().save(true);
    else get().save();
    return r.ok;
  };
  const now = () => garageNow();
  return {
    content: garageContent(),
    state: null,
    settings: { haptics: true },
    buyMode: 1,
    tab: 'build',
    launch: null,
    flash: null,

    async load() {
      if (get().state) return;
      const content = get().content;
      const [text, settingsText] = await Promise.all([readValue(SAVE_KEY), readValue(SETTINGS_KEY)]);
      if (get().state) return;
      const loaded = deserialize(text, content, now());
      if (loaded.error) logError('garage load', new Error(loaded.error));
      if (loaded.migratedFrom) logLifecycle('garage save migrated', { from: loaded.migratedFrom });
      // Catch up to now: a long gap becomes the "While you were away" report.
      const state = advance(loaded.state, content, now());
      let settings = get().settings;
      try {
        const raw = settingsText ? (JSON.parse(settingsText) as Partial<GarageSettings>) : null;
        if (raw && typeof raw.haptics === 'boolean') settings = { ...settings, haptics: raw.haptics };
      } catch {
        // defaults
      }
      set({ state, settings });
      logLifecycle('garage opened', { generation: state.generation, away: state.offline ? Math.round(state.offline.awayMs / 1000) : 0 });
      writeSave(state);
    },

    tick() {
      const s = get().state;
      if (!s) return;
      const next = advance(s, get().content, now());
      if (next !== s) {
        set({ state: next });
        get().save();
      }
    },

    tap() {
      const s = get().state;
      if (!s) return 0;
      const r = tap(s, get().content, now());
      set({ state: r.state });
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

    ship(bonus = false) {
      const s = get().state;
      if (!s) return false;
      const r = prestige(s, get().content, now(), { bonus });
      if (!r.ok) return apply(r, false);
      logLifecycle('garage shipped', { generation: r.state.generation, hype: r.state.hype - s.hype, bonus });
      set({ launch: { generation: r.state.generation, gain: r.state.hype - s.hype }, tab: 'build' });
      return apply(r, true);
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

    claim(offer) {
      const s = get().state;
      if (!s) return null;
      if (offer === 'prestigeBonus') {
        get().ship(true);
        return { state: get().state!, ok: true };
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
      const settings = { ...get().settings, haptics: on };
      set({ settings });
      void writeValue(SETTINGS_KEY, JSON.stringify(settings));
    },

    reset() {
      const state = createGarage(get().content, now());
      set({ state, launch: null, flash: null, tab: 'build' });
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
      set({ state });
      get().save(true);
    },
  };
});
