/**
 * Daily mission rewards: a grant of minutes of production (capped so a reward never skips
 * a model), a little Lab Rep progress, and for the daily crate a streak bonus and training
 * runs. Which missions exist and how far along they are is the UI's job (src/ui/missions);
 * the engine only owns what a claim grants. Pure and deterministic like the rest of src/idle.
 */
import { grant } from './core';
import { at, shipThreshold } from './garage';
import { accrueTraining } from './lab';
import { mechanicOn } from './labRates';
import { amount } from './num';
import { emptyRaceLink } from './race';
import { baseRate, tapValue } from './rates';
import type { ActionResult, DailyRewardConfig, GarageContent, GarageState } from './types';

export type DailyRewardKind = 'mission' | 'crate';

export interface DailyRewardOpts {
  /** Current streak in days (the crate's bonus). */
  streak?: number;
  /** Extra multiplier on the crate (a Paradigm tree node); 1 by default. */
  crateMult?: number;
}

export interface DailyRewardQuote {
  tokens: number;
  rep: number;
  trainingRuns: number;
  /** The crate's streak multiplier (1 for a mission). */
  streakMult: number;
}

function baseTokens(state: GarageState, content: GarageContent, cfg: DailyRewardConfig): number {
  const prod = baseRate(state, content) * 60 * cfg.minutes;
  const taps = tapValue({ ...state, frenzy: null, boostUntil: 0 }, content, state.now, 1) * cfg.minTaps;
  const cap = shipThreshold(content, state.generation + 1) * cfg.shipShareCap;
  return amount(Math.min(Math.max(prod, taps), cap > 0 ? cap : Infinity));
}

/** What a mission or the daily crate would grant now. Zero without missions content. */
export function dailyRewardQuote(state: GarageState, content: GarageContent, kind: DailyRewardKind, opts: DailyRewardOpts = {}): DailyRewardQuote {
  const m = content.missions;
  if (!m) return { tokens: 0, rep: 0, trainingRuns: 0, streakMult: 1 };
  if (kind === 'mission') return { tokens: baseTokens(state, content, m.reward), rep: m.reward.rep, trainingRuns: 0, streakMult: 1 };
  const c = m.crate;
  const streak = Number.isFinite(opts.streak) ? Math.max(0, Math.floor(opts.streak ?? 0)) : 0;
  const streakMult = 1 + c.streakBonus * Math.min(streak, c.streakCap);
  const mult = Number.isFinite(opts.crateMult) && (opts.crateMult ?? 1) > 0 ? (opts.crateMult ?? 1) : 1;
  const training = content.training && mechanicOn(state, content, 'training') ? c.trainingRuns : 0;
  return { tokens: amount(baseTokens(state, content, c) * streakMult * mult), rep: c.rep * mult, trainingRuns: Math.round(training * mult), streakMult };
}

/** Adds Lab Rep with its fraction (whole points to labRep, the rest waits in race.repProgress). */
export function addLabRep(s: GarageState, rep: number): void {
  if (!(rep > 0) || !Number.isFinite(rep)) return;
  const race = s.race ?? emptyRaceLink();
  const total = race.repProgress + rep;
  const whole = Math.floor(total + 1e-9);
  s.labRep += whole;
  s.race = { ...race, repProgress: Math.max(0, Math.round((total - whole) * 1000) / 1000) };
}

/**
 * Grants a claimed mission's reward, or the daily crate's. The UI decides that the claim is
 * due (the mission is done and unclaimed today); the engine grants what dailyRewardQuote says.
 * Fails with 'notApplicable' without missions content.
 */
export function claimDailyReward(state: GarageState, content: GarageContent, kind: DailyRewardKind, now: number, opts: DailyRewardOpts = {}): ActionResult {
  if (!content.missions) return { state, ok: false, reason: 'notApplicable' };
  const s = at(state, content, now);
  const q = dailyRewardQuote(s, content, kind, opts);
  const gained = grant(s, q.tokens);
  addLabRep(s, q.rep);
  if (q.trainingRuns > 0) {
    s.training = { ...s.training, charges: s.training.charges + q.trainingRuns };
    accrueTraining(s, content, s.now);
  }
  return { state: s, ok: true, gained };
}
