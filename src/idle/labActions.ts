/**
 * The lab layer's player actions (training runs, kept models, staff, happenings, the
 * auto-buy switch) and its reads for screens and bots (next stage, training status, the
 * ship-day reveal). Every action advances to `now` first and returns a new state.
 */
import { at, hypeForLifetime, maybeOfferMultiply, requirementProgress } from './garage';
import { accrueTraining, happeningDef, happeningPenalty, happeningReward, labRequirementMet, queueMax, resolveHappening, rollCandidates, stageRequirement, trainingCooldownMs } from './lab';
import { mechanicOn, mechanicStage, modelSlots } from './labRates';
import type { ActionResult, GarageContent, GarageState, ModelCandidate, Requirement, StaffSplit, StageDef } from './types';
import { STAFF_LANES } from './types';

// ---------------------------------------------------------------------------------------
// Training runs and models

export interface TrainingStatus {
  unlocked: boolean;
  /** Stage index that unlocks training (-1 if the content has none). */
  unlockStage: number;
  charges: number;
  queueMax: number;
  /** When the next run comes ready (0 when the queue is full or locked). */
  readyAt: number;
  cooldownMs: number;
  /** Candidates waiting for a pick. */
  pending: boolean;
  slots: number;
}

export function trainingStatus(state: GarageState, content: GarageContent): TrainingStatus {
  const cfg = content.training;
  const unlocked = !!cfg && mechanicOn(state, content, 'training');
  return {
    unlocked,
    unlockStage: mechanicStage(content, 'training'),
    charges: unlocked ? state.training.charges : 0,
    queueMax: queueMax(state, content),
    readyAt: unlocked ? state.training.nextChargeAt : 0,
    cooldownMs: unlocked ? trainingCooldownMs(state, content) : 0,
    pending: !!state.training.candidates && state.training.candidates.length > 0,
    slots: modelSlots(state, content),
  };
}

/** Spends one queued run: rolls the candidates to choose from. */
export function launchTraining(state: GarageState, content: GarageContent, now: number): ActionResult {
  if (!content.training) return { state, ok: false, reason: 'unknownId' };
  const s = at(state, content, now);
  if (!mechanicOn(s, content, 'training')) return { state: s, ok: false, reason: 'locked' };
  if (s.training.candidates && s.training.candidates.length > 0) return { state: s, ok: false, reason: 'pending' };
  if (s.training.charges < 1) return { state: s, ok: false, reason: 'cooldown' };
  const wasFull = s.training.charges >= queueMax(s, content);
  s.training = { ...s.training, charges: s.training.charges - 1, nextChargeAt: wasFull || s.training.nextChargeAt === 0 ? 0 : s.training.nextChargeAt };
  accrueTraining(s, content, s.now);
  s.training = { ...s.training, candidates: rollCandidates(s, content) };
  s.stats.trainingRuns += 1;
  return { state: s, ok: true };
}

/**
 * Keeps candidate `uid` in an active slot. With every slot taken, `replaceUid` names the
 * kept model it retires (otherwise 'full'). The other candidates are scrapped.
 */
export function keepModel(state: GarageState, content: GarageContent, uid: number, now: number, replaceUid?: number): ActionResult {
  const s = at(state, content, now);
  const pick = s.training.candidates?.find((c) => c.uid === uid);
  if (!pick) return { state: s, ok: false, reason: 'none' };
  const slots = modelSlots(s, content);
  let models: ModelCandidate[] = s.models;
  if (replaceUid !== undefined) {
    if (!models.some((m) => m.uid === replaceUid)) return { state: s, ok: false, reason: 'unknownId' };
    models = models.filter((m) => m.uid !== replaceUid);
  }
  if (models.length >= slots) return { state: s, ok: false, reason: 'full' };
  s.models = [...models, pick];
  s.training = { ...s.training, candidates: null };
  s.stats.modelsKept += 1;
  return { state: s, ok: true };
}

/** Scraps the waiting candidates (keeps none). */
export function scrapCandidates(state: GarageState, content: GarageContent, now: number): ActionResult {
  const s = at(state, content, now);
  if (!s.training.candidates) return { state: s, ok: false, reason: 'none' };
  s.training = { ...s.training, candidates: null };
  return { state: s, ok: true };
}

/** Retires a kept model, freeing its slot. */
export function retireModel(state: GarageState, content: GarageContent, uid: number, now: number): ActionResult {
  const s = at(state, content, now);
  if (!s.models.some((m) => m.uid === uid)) return { state: s, ok: false, reason: 'unknownId' };
  s.models = s.models.filter((m) => m.uid !== uid);
  return { state: s, ok: true };
}

// ---------------------------------------------------------------------------------------
// Staff

/** Sets the headcount split. It must use whole numbers and add up to the staff total. */
export function setStaff(state: GarageState, content: GarageContent, split: StaffSplit, now: number): ActionResult {
  const cfg = content.staff;
  if (!cfg) return { state, ok: false, reason: 'unknownId' };
  const s = at(state, content, now);
  if (!mechanicOn(s, content, 'staff')) return { state: s, ok: false, reason: 'locked' };
  const ok = STAFF_LANES.every((l) => Number.isInteger(split[l]) && split[l] >= 0) && STAFF_LANES.reduce((sum, l) => sum + split[l], 0) === cfg.total;
  if (!ok) return { state: s, ok: false, reason: 'notApplicable' };
  s.staff = { research: split.research, product: split.product, safety: split.safety };
  return { state: s, ok: true };
}

/** Moves one person from lane `from` to lane `to`. */
export function moveStaff(state: GarageState, content: GarageContent, from: keyof StaffSplit, to: keyof StaffSplit, now: number): ActionResult {
  if (from === to || (state.staff[from] ?? 0) < 1) return { state, ok: false, reason: 'none' };
  return setStaff(state, content, { ...state.staff, [from]: state.staff[from] - 1, [to]: state.staff[to] + 1 }, now);
}

// ---------------------------------------------------------------------------------------
// Happenings and automation

/** Taps the happening on screen: its reward (and side effect) now. */
export function collectHappening(state: GarageState, content: GarageContent, now: number): ActionResult {
  const s = at(state, content, now);
  const h = s.happening;
  if (!h || !happeningDef(content, h.id)) return { state: s, ok: false, reason: 'none' };
  const gained = resolveHappening(s, content, 1);
  maybeOfferMultiply(s, content, gained, 'happening', h.id, h.x, h.y);
  s.stats.happeningsCaught += 1;
  return { state: s, ok: true, gained };
}

/** What the happening on screen is worth (reward on tap, cost if it slips away). */
export function happeningQuote(state: GarageState, content: GarageContent): { reward: number; penalty: number } {
  const def = state.happening ? happeningDef(content, state.happening.id) : undefined;
  if (!def) return { reward: 0, penalty: 0 };
  return { reward: happeningReward(state, content, def), penalty: mechanicOn(state, content, 'autoCollect') ? 0 : happeningPenalty(state, content, def) };
}

export function setAutoBuy(state: GarageState, content: GarageContent, on: boolean, now: number): ActionResult {
  const s = at(state, content, now);
  if (!content.automation || !mechanicOn(s, content, 'autoBuy')) return { state: s, ok: false, reason: 'locked' };
  s.autoBuy = on;
  if (on) s.nextAutoBuyAt = s.now + content.automation.buyIntervalMs;
  return { state: s, ok: true };
}

// ---------------------------------------------------------------------------------------
// Next goals

export interface NextStage {
  index: number;
  def: StageDef;
  /** The unmet requirement closest to done, and its progress. */
  requirement: Requirement;
  progress: number;
}

/** The stage the lab moves to next, with the requirement still to meet (null at the last). */
export function nextStage(state: GarageState, content: GarageContent): NextStage | null {
  const stages = content.stages;
  if (!stages || state.stage + 1 >= stages.length) return null;
  const def = stages[state.stage + 1];
  const all = def.requires.map((r) => stageRequirement(state, content, r));
  const unmet = all.filter((r) => !labRequirementMet(state, r));
  const reqs = unmet.length ? unmet : all;
  if (reqs.length === 0) return { index: state.stage + 1, def, requirement: { type: 'generation', min: 0 }, progress: 1 };
  const scored = reqs.map((r) => ({ r, p: requirementProgress(state, r) })).sort((a, b) => a.p - b.p);
  return { index: state.stage + 1, def, requirement: scored[0].r, progress: scored[0].p };
}

// ---------------------------------------------------------------------------------------
// Ship day

export interface LeaderRow {
  id: string;
  nameKey: string | null;
  score: number;
  /** True for the player's model. */
  you: boolean;
}

export interface ShipReveal {
  benchmarkKey: string;
  reactionKey: string;
  /** The rival who reacts (name key). */
  rivalKey: string;
  rows: LeaderRow[];
  rank: number;
}

/**
 * The ship-day sequence's numbers: the benchmark, the parody leaderboard with the player's
 * score and the rivals', and the reacting rival. Deterministic for a save (no PRNG draw):
 * picks rotate with the generation.
 */
export function shipReveal(state: GarageState, content: GarageContent): ShipReveal | null {
  const cfg = content.shipDay;
  if (!cfg || cfg.rivals.length === 0) return null;
  const gen = state.generation;
  const gain = hypeForLifetime(content, state.genLifetime);
  const ours = Math.round((cfg.scoreBase + cfg.scorePerGeneration * gen + cfg.scorePerHype * Math.log2(1 + gain)) * 10) / 10;
  const rows: LeaderRow[] = cfg.rivals.map((r, i) => ({ id: r.id, nameKey: r.nameKey, score: Math.round((r.base + r.growth * gen + ((gen * 7 + i * 3) % 5) * 0.7) * 10) / 10, you: false }));
  rows.push({ id: 'you', nameKey: null, score: ours, you: true });
  rows.sort((a, b) => b.score - a.score);
  const rank = rows.findIndex((r) => r.you) + 1;
  const rivals = rows.filter((r) => !r.you);
  const reacting = rank === 1 ? rivals[0] : rows[0].you ? rivals[0] : rows[0];
  return {
    benchmarkKey: cfg.benchmarkKeys[gen % Math.max(1, cfg.benchmarkKeys.length)] ?? '',
    reactionKey: cfg.reactionKeys[gen % Math.max(1, cfg.reactionKeys.length)] ?? '',
    rivalKey: reacting?.nameKey ?? '',
    rows,
    rank,
  };
}

