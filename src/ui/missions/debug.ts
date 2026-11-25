import { Platform } from 'react-native';

import { garageNow } from '../garage/clock';
import { useGarageStore } from '../garage/store';
import { DAY_MS, EMPTY_STREAK, garageCounters, utcDay, type MissionDay, type Streak } from './logic';
import { missionsConfig, noteRace, useMissionsStore } from './store';

/**
 * Debug helpers for screenshots, on web with `?debug=1`: `window.__missions` sets up the
 * day's missions, progress, claims and the streak.
 */
export interface MissionsDebug {
  /** A fresh day: three missions, nothing done (`ids` to choose them). */
  fresh(ids?: string[]): void;
  /** The first `done` missions complete, the rest part-way. */
  progress(done?: number): void;
  /** Every mission done and claimed (and the crate opened when `crate`). */
  claimAll(crate?: boolean): void;
  /** Sets the streak (days relative to today: lastDay -1 = yesterday). */
  streak(s: { current: number; best?: number; lastDay?: number; dayOffIn?: number; coveredYesterday?: boolean }): void;
  /** A race counter moves (as a race would). */
  race(counter: string, amount: number): void;
  /** Drops the toasts waiting. */
  clearToasts(): void;
  state(): unknown;
}

let installed = false;

export function installMissionsDebug(): void {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!/[?&]debug=1/.test(window.location?.search ?? '')) return;
  installed = true;
  const today = () => utcDay(garageNow());
  const setDay = (day: MissionDay) => useMissionsStore.getState().replace({ ...useMissionsStore.getState().save, today: day });
  const base = { taps: 0, bought: 0, happenings: 0, golden: 0, upgrades: 0, training: 0, incidents: 0, ships: 0 };
  const api: MissionsDebug = {
    fresh(ids) {
      const cfg = missionsConfig();
      const pick = ids ?? (cfg ? cfg.defs.filter((d) => !d.minStage && !d.minGeneration).reduce<string[]>((out, d) => (out.some((x) => cfg.defs.find((y) => y.id === x)?.slot === d.slot) ? out : [...out, d.id]), []) : []);
      const now = garageCounters(useGarageStore.getState().state?.stats);
      setDay({ day: today(), ids: pick, base: now, garage: now, race: {}, done: [], claimed: [], crate: false });
      useMissionsStore.setState({ toasts: [] });
    },
    progress(done = 1) {
      const cfg = missionsConfig();
      const day = useMissionsStore.getState().save.today;
      if (!cfg || !day) return;
      const garage = { ...(day.base ?? base) };
      const race: Record<string, number> = {};
      day.ids.forEach((id, i) => {
        const g = cfg.defs.find((d) => d.id === id)?.goals[0];
        if (!g) return;
        const value = i < done ? g.goal : Math.floor(g.goal * 0.4);
        if (g.counter in garage) (garage as Record<string, number>)[g.counter] += value;
        else race[g.counter] = value;
      });
      setDay({ ...day, garage, race, done: day.ids.slice(0, done), claimed: [], crate: false });
    },
    claimAll(crate = false) {
      const day = useMissionsStore.getState().save.today;
      if (!day) return;
      setDay({ ...day, done: [...day.ids], claimed: [...day.ids], crate });
    },
    streak({ current, best, lastDay = 0, dayOffIn = 0, coveredYesterday = false }) {
      const d = today();
      const s: Streak = { ...EMPTY_STREAK, current, best: Math.max(best ?? current, current), lastDay: d + lastDay, dayOffFrom: d + dayOffIn, coveredDay: coveredYesterday ? d - 1 : -1 };
      useMissionsStore.getState().replace({ ...useMissionsStore.getState().save, streak: s });
    },
    race: (counter, amount) => noteRace(counter as Parameters<typeof noteRace>[0], amount),
    clearToasts: () => useMissionsStore.setState({ toasts: [] }),
    state: () => ({ ...useMissionsStore.getState().save, dayMs: DAY_MS }),
  };
  (window as unknown as { __missions: MissionsDebug }).__missions = api;
}
