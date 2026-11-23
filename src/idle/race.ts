/**
 * The Garage's side of the link with the race: what a finished race run grants (Lab Rep and
 * "blueprints", a temporary production boost) and the note the Garage shows about it.
 * Pure and deterministic like the rest of src/idle; numbers in content.raceReward.
 */
import type { ActionResult, GarageContent, GarageState, RaceLinkState, RaceRewardConfig, RaceRewardInput, RaceRewardRecord } from './types';

/** The race link of a save that has none yet. */
export function emptyRaceLink(): RaceLinkState {
  return { repProgress: 0, repFromRaces: 0, races: 0, boostFrom: 0, boostUntil: 0, last: null, seeds: [] };
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const factorOf = (table: Record<string, number>, id: string | undefined) => {
  const v = id !== undefined ? table[id] : undefined;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 1;
};

export interface RaceRewardQuote {
  /** Lab Rep, rounded to 0.1. */
  rep: number;
  /** Blueprints boost time added (before the cap). */
  boostMs: number;
  /** Earlier rewarded plays of this seed. */
  plays: number;
}

/** What a race result would grant now (without granting it). Zero without content.raceReward. */
export function raceRewardQuote(state: GarageState, content: GarageContent, input: RaceRewardInput): RaceRewardQuote {
  const cfg = content.raceReward;
  const plays = state.race?.seeds.find((e) => e.seed === input.seed)?.plays ?? 0;
  if (!cfg) return { rep: 0, boostMs: 0, plays };
  const raw =
    cfg.baseRep *
    (input.won ? 1 : cfg.lossFactor) *
    factorOf(cfg.difficulty, input.difficulty) *
    factorOf(cfg.runLength, input.runLength) *
    (1 + cfg.scoreBonus * clamp01(cfg.scoreForBest > 0 ? input.score / cfg.scoreForBest : 0)) *
    Math.pow(cfg.repeatFactor, plays);
  const rep = Math.max(0, Math.round(raw * 10) / 10);
  return { rep, boostMs: Math.round(rep * cfg.boostMsPerRep), plays };
}

/**
 * Grants a finished race run's reward at `now`: Lab Rep (whole points to labRep, the rest kept
 * in race.repProgress), blueprints (extends a running boost, capped at boostCapMs left), and
 * the record the Garage's note shows. A replay of a remembered seed gets repeatFactor per
 * earlier play. Does not advance the Garage's clock: production catches up when it opens.
 * Fails with 'notApplicable' when the content has no raceReward.
 */
export function grantRaceReward(state: GarageState, content: GarageContent, input: RaceRewardInput, now: number): ActionResult {
  const cfg: RaceRewardConfig | undefined = content.raceReward;
  if (!cfg || !Number.isFinite(now)) return { state, ok: false, reason: 'notApplicable' };
  const quote = raceRewardQuote(state, content, input);
  const prev = state.race ?? emptyRaceLink();
  const total = prev.repProgress + quote.rep;
  const whole = Math.floor(total + 1e-9);
  const repProgress = Math.max(0, Math.round((total - whole) * 1000) / 1000);
  const start = Math.max(now, state.now);
  let boostFrom = prev.boostFrom;
  let boostUntil = prev.boostUntil;
  if (quote.boostMs > 0) {
    const running = prev.boostUntil > start;
    boostFrom = running ? prev.boostFrom : start;
    boostUntil = Math.min((running ? prev.boostUntil : start) + quote.boostMs, start + cfg.boostCapMs);
  }
  const seeds = prev.seeds.filter((e) => e.seed !== input.seed);
  seeds.push({ seed: input.seed, plays: quote.plays + 1 });
  const last: RaceRewardRecord = { rep: quote.rep, boostMs: quote.boostMs, won: input.won, repeat: quote.plays > 0, at: start, seen: false };
  const race: RaceLinkState = {
    repProgress,
    repFromRaces: Math.round((prev.repFromRaces + quote.rep) * 10) / 10,
    races: prev.races + 1,
    boostFrom,
    boostUntil,
    last,
    seeds: seeds.slice(-Math.max(1, cfg.seedMemory)),
  };
  return { state: { ...state, labRep: state.labRep + whole, race }, ok: true };
}

/** Marks the last race's note as shown. Same state when there is nothing to mark. */
export function markRaceNoteSeen(state: GarageState): GarageState {
  const race = state.race;
  if (!race?.last || race.last.seen) return state;
  return { ...state, race: { ...race, last: { ...race.last, seen: true } } };
}

/** Lab Rep as a level with its fraction (labRep + race.repProgress). */
export function labRepTotal(state: Pick<GarageState, 'labRep' | 'race'>): number {
  return state.labRep + (state.race?.repProgress ?? 0);
}

/** Blueprints boost time left at `at`, counted from its start when it has not started yet (0 when none). */
export function raceBoostLeftMs(state: GarageState, at: number = state.now): number {
  const race = state.race;
  if (!race || race.boostUntil <= at) return 0;
  return race.boostUntil - Math.max(at, race.boostFrom);
}
