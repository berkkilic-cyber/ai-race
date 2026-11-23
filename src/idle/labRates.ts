/**
 * Pure reads for the lab layer: stages, milestones, kept models and staff. Imports only
 * types, so rates.ts can fold these into production without an import cycle.
 */
import type { GarageContent, GarageState, ModelStat, StageDef, StageMechanic, StaffLane, TraitDef } from './types';
import { MODEL_STATS, STAFF_LANES } from './types';

// ---------------------------------------------------------------------------------------
// Stages

export function stageCount(content: GarageContent): number {
  return content.stages?.length ?? 0;
}

/** The stage the save is in (undefined for content without stages). */
export function currentStage(state: Pick<GarageState, 'stage'>, content: GarageContent): StageDef | undefined {
  const stages = content.stages;
  if (!stages || stages.length === 0) return undefined;
  return stages[Math.max(0, Math.min(stages.length - 1, state.stage))];
}

/** True once a stage that switches `mechanic` on has been reached. */
export function mechanicOn(state: Pick<GarageState, 'stage'>, content: GarageContent, mechanic: StageMechanic): boolean {
  const stages = content.stages;
  if (!stages) return false;
  const last = Math.min(stages.length - 1, state.stage);
  for (let i = 0; i <= last; i++) if (stages[i].mechanic === mechanic) return true;
  return false;
}

/** The stage index that switches `mechanic` on (-1 if none). */
export function mechanicStage(content: GarageContent, mechanic: StageMechanic): number {
  return content.stages?.findIndex((st) => st.mechanic === mechanic) ?? -1;
}

/** Active model slots at the save's stage. */
export function modelSlots(state: Pick<GarageState, 'stage'>, content: GarageContent): number {
  const stages = content.stages;
  if (!stages) return 0;
  let slots = 0;
  const last = Math.min(stages.length - 1, state.stage);
  for (let i = 0; i <= last; i++) slots = Math.max(slots, stages[i].modelSlots);
  return slots;
}

// ---------------------------------------------------------------------------------------
// Milestones

/** Output multiplier for owning `count` of one generator. */
export function milestoneMult(content: GarageContent, count: number): number {
  const m = content.milestones;
  if (!m || count <= 0) return 1;
  let mult = 1;
  let last = 0;
  for (const step of m.steps) {
    if (count < step.count) return mult;
    mult *= step.mult;
    last = step.count;
  }
  if (m.repeatEvery > 0) mult *= Math.pow(m.repeatMult, Math.floor((count - last) / m.repeatEvery));
  return mult;
}

/** The next milestone above `count` (always one while milestones are defined). */
export function nextMilestone(content: GarageContent, count: number): { count: number; mult: number } | null {
  const m = content.milestones;
  if (!m || m.steps.length === 0) return null;
  for (const step of m.steps) if (count < step.count) return { count: step.count, mult: step.mult };
  if (!(m.repeatEvery > 0)) return null;
  const last = m.steps[m.steps.length - 1].count;
  return { count: last + m.repeatEvery * (Math.floor((count - last) / m.repeatEvery) + 1), mult: m.repeatMult };
}

/** The milestone at or below `count` last passed (0 = none). */
export function lastMilestone(content: GarageContent, count: number): number {
  const m = content.milestones;
  if (!m || m.steps.length === 0) return 0;
  let last = 0;
  for (const step of m.steps) if (count >= step.count) last = step.count;
  const top = m.steps[m.steps.length - 1].count;
  if (count >= top && m.repeatEvery > 0) last = top + m.repeatEvery * Math.floor((count - top) / m.repeatEvery);
  return last;
}

// ---------------------------------------------------------------------------------------
// Models

export function traitDef(content: GarageContent, id: string): TraitDef | undefined {
  const t = content.training;
  if (!t) return undefined;
  return t.traits.find((x) => x.id === id) ?? t.drawbacks.find((x) => x.id === id);
}

export type ModelEffects = Record<ModelStat, number>;

export function zeroEffects(): ModelEffects {
  const out = {} as ModelEffects;
  for (const k of MODEL_STATS) out[k] = 0;
  return out;
}

const effectCache = new WeakMap<object, { content: GarageContent; e: ModelEffects }>();

/** The summed strengths and drawbacks of the kept models (shares; offlineCap in hours). */
export function modelEffects(state: Pick<GarageState, 'models'>, content: GarageContent): ModelEffects {
  const models = state.models ?? [];
  const hit = effectCache.get(models);
  if (hit && hit.content === content) return hit.e;
  const e = zeroEffects();
  for (const m of models) {
    for (const b of m.boons) {
      const def = traitDef(content, b.trait);
      if (def && Number.isFinite(b.value)) e[def.stat] += b.value;
    }
    if (m.drawback) {
      const def = traitDef(content, m.drawback.trait);
      if (def && Number.isFinite(m.drawback.value)) e[def.stat] += m.drawback.value;
    }
  }
  effectCache.set(models, { content, e });
  return e;
}

/** A multiplier from a share, never below `floor`. */
export function factor(share: number, floor = 0.1): number {
  return Math.max(floor, 1 + (Number.isFinite(share) ? share : 0));
}

// ---------------------------------------------------------------------------------------
// Staff

export type StaffShares = Record<StaffLane, number>;

/** Each lane's share of the headcount (a third each while staff is locked). */
export function staffShares(state: Pick<GarageState, 'staff' | 'stage'>, content: GarageContent): StaffShares {
  const cfg = content.staff;
  const even: StaffShares = { research: 1 / 3, product: 1 / 3, safety: 1 / 3 };
  if (!cfg || !mechanicOn(state, content, 'staff') || !state.staff) return even;
  const total = STAFF_LANES.reduce((sum, l) => sum + Math.max(0, state.staff[l] ?? 0), 0);
  if (!(total > 0)) return even;
  return { research: Math.max(0, state.staff.research) / total, product: Math.max(0, state.staff.product) / total, safety: Math.max(0, state.staff.safety) / total };
}

export interface StaffEffects {
  /** Generator output multiplier (Product). */
  production: number;
  /** Incident frequency multiplier (Safety; below 1 = rarer). */
  incidentFreq: number;
  /** Multiplies the share of output an incident takes (Safety). */
  severity: number;
  /** Ship Hype multiplier (Safety). */
  trust: number;
  /** Training speed multiplier (Research). */
  trainingSpeed: number;
  /** Rarity luck, -1..2 (Research; 0 is neutral). */
  luck: number;
}

export function staffEffects(state: Pick<GarageState, 'staff' | 'stage'>, content: GarageContent): StaffEffects {
  const cfg = content.staff;
  if (!cfg || !mechanicOn(state, content, 'staff')) return { production: 1, incidentFreq: 1, severity: 1, trust: 1, trainingSpeed: 1, luck: 0 };
  const sh = staffShares(state, content);
  const d = (share: number) => 3 * share - 1; // -1 .. 2, 0 at a third
  return {
    production: Math.max(0.05, 1 + cfg.productSwing * d(sh.product)),
    incidentFreq: Math.max(0.1, 1 - cfg.safetySwing * d(sh.safety)),
    severity: Math.max(0.1, 1 - cfg.severitySwing * d(sh.safety)),
    trust: Math.max(0.1, 1 + cfg.trustSwing * d(sh.safety)),
    trainingSpeed: Math.max(0.1, 1 + cfg.researchSwing * d(sh.research)),
    luck: d(sh.research),
  };
}
