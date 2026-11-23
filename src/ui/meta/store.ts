/**
 * The meta layer's small store: the account's Lab Rep (read from the Garage save), the
 * player's perks switch, and the last race reward. The rules are in ./logic.ts and src/idle.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';

import type { ContentPack, GameState } from '@/engine';
import { deserialize, grantRaceReward, labRepTotal, serialize, type GarageState, type RaceRewardRecord } from '@/idle';

import { logError, logLifecycle } from '../diagnostics/log';
import { garageNow } from '../garage/clock';
import { garageContent } from '../garage/content';
import { SAVE_KEY as GARAGE_SAVE_KEY, useGarageStore } from '../garage/store';
import type { NewGameSetup } from '../store/game';
import { readValue, writeValue } from '../tutorial/storage';
import { raceRewardInputOf, withSetupBonus } from './logic';

/** Storage key of the perks switch ('0' = off; anything else or nothing = on). */
export const PERKS_KEY = 'ai-race.meta.perks.v1';

export interface MetaStore {
  loaded: boolean;
  /** Lab Rep with its fraction (labRep + race.repProgress). */
  labRep: number;
  /** The start screen's switch: play with Lab Rep perks. */
  perksOn: boolean;
  /** Bumped by the player's own toggles (analytics; not by loading). */
  toggles: number;
  /** The reward the last finished race granted (the end screen's line), with a sequence number. */
  reward: (RaceRewardRecord & { seq: number }) | null;
  /** Reads the Garage save and the switch. Safe to call often. */
  load(): Promise<void>;
  setPerksOn(on: boolean): void;
  /** Grants the Garage the reward for a finished race (once per state object). */
  grantForRace(state: GameState, pack: ContentPack): Promise<RaceRewardRecord | null>;
  /** Debug (screenshots): sets the Garage save's Lab Rep and reloads. */
  debugSetLabRep(rep: number): Promise<void>;
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

const granted = new WeakSet<GameState>();
let seq = 0;

export const useMetaStore = create<MetaStore>()((set, get) => ({
  loaded: false,
  labRep: 0,
  perksOn: true,
  toggles: 0,
  reward: null,

  async load() {
    const [garage, flag] = await Promise.all([readGarage(), readValue(PERKS_KEY).catch(() => null)]);
    set({ loaded: true, labRep: labRepTotal(garage), perksOn: flag !== '0' });
  },

  setPerksOn(on) {
    if (on === get().perksOn) return;
    set({ perksOn: on, toggles: get().toggles + 1 });
    void writeValue(PERKS_KEY, on ? '1' : '0').catch(() => undefined);
  },

  async grantForRace(state, pack) {
    if (granted.has(state)) return get().reward;
    const input = raceRewardInputOf(state, pack);
    if (!input) return null;
    granted.add(state);
    try {
      const garage = await readGarage();
      const result = grantRaceReward(garage, garageContent(), input, garageNow());
      if (!result.ok || !result.state.race?.last) return null;
      await writeGarage(result.state);
      const record = result.state.race.last;
      set({ labRep: labRepTotal(result.state), reward: { ...record, seq: ++seq } });
      logLifecycle('race reward granted', { rep: record.rep, boostMin: Math.round(record.boostMs / 60000), repeat: record.repeat });
      return record;
    } catch (e) {
      logError('race reward', e);
      return null;
    }
  },

  async debugSetLabRep(rep) {
    const garage = await readGarage();
    const whole = Math.max(0, Math.floor(rep));
    await writeGarage({ ...garage, labRep: whole, race: garage.race ? { ...garage.race, repProgress: Math.max(0, rep - whole) } : undefined });
    await get().load();
  },
}));

/** A new run's setup with the Lab Rep perk bonus as the switch and the current Lab Rep say. */
export function withPerks(setup: NewGameSetup, perksOn: boolean = useMetaStore.getState().perksOn): NewGameSetup {
  return withSetupBonus(setup, { perksOn }, Math.floor(useMetaStore.getState().labRep + 1e-9), garageContent());
}

/**
 * Web debug pages (`?debug=1`): `window.__meta` for screenshot scripts: `setLabRep(n)` writes the
 * Garage save's Lab Rep and reloads; `state()` reads this store.
 */
if (Platform.OS === 'web' && typeof window !== 'undefined' && /[?&]debug=1\b/.test(window.location?.search ?? '')) {
  (window as unknown as { __meta?: unknown }).__meta = {
    setLabRep: (n: number) => useMetaStore.getState().debugSetLabRep(n),
    state: () => useMetaStore.getState(),
  };
}
