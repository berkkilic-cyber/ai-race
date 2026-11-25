/**
 * Pure reads for the Paradigm layer: what the owned tree nodes add up to and the production
 * bonus from currency ever earned. Imports only types, so rates.ts, lab.ts and garage.ts can
 * fold these in without an import cycle.
 */
import type { GarageContent, GarageState, GeneratorId, ParadigmNodeDef } from './types';

export interface ParadigmEffects {
  startStage: number;
  candidates: number;
  trainingQueue: number;
  crateMult: number;
  awayHours: number;
  offlineRate: number;
  /** The launch choice auto-ship uses (null: no auto-ship node). */
  autoShip: string | null;
  startGenerators: Record<GeneratorId, number>;
  keepModels: boolean;
  happeningInterval: number;
  comboWindowMs: number;
  shipThreshold: number;
  rarityLuck: number;
  globalMult: number;
  tapMult: number;
}

const NONE: ParadigmEffects = Object.freeze({
  startStage: 0,
  candidates: 0,
  trainingQueue: 0,
  crateMult: 1,
  awayHours: 0,
  offlineRate: 0,
  autoShip: null,
  startGenerators: Object.freeze({}) as Record<GeneratorId, number>,
  keepModels: false,
  happeningInterval: 1,
  comboWindowMs: 0,
  shipThreshold: 1,
  rarityLuck: 0,
  globalMult: 1,
  tapMult: 1,
}) as ParadigmEffects;

export function paradigmNode(content: GarageContent, id: string): ParadigmNodeDef | undefined {
  return content.paradigm?.nodes.find((n) => n.id === id);
}

const cache = new WeakMap<readonly string[], { content: GarageContent; e: ParadigmEffects }>();

/** The owned nodes' effects added up (neutral without the Paradigm layer). */
export function paradigmEffects(state: Pick<GarageState, 'paradigm'>, content: GarageContent): ParadigmEffects {
  const nodes = state.paradigm?.nodes;
  if (!content.paradigm || !nodes || nodes.length === 0) return NONE;
  const hit = cache.get(nodes);
  if (hit && hit.content === content) return hit.e;
  const e: ParadigmEffects = { ...NONE, startGenerators: {} };
  for (const id of nodes) {
    const def = paradigmNode(content, id);
    if (!def) continue;
    const f = def.effect;
    switch (f.kind) {
      case 'startStage':
        e.startStage = Math.max(e.startStage, f.stage);
        break;
      case 'candidates':
        e.candidates += f.add;
        break;
      case 'trainingQueue':
        e.trainingQueue += f.add;
        break;
      case 'crateMult':
        e.crateMult *= f.mult;
        break;
      case 'awayHours':
        e.awayHours += f.hours;
        break;
      case 'offlineRate':
        e.offlineRate += f.add;
        break;
      case 'autoShip':
        e.autoShip = f.choice;
        break;
      case 'startGenerators':
        e.startGenerators[f.generator] = Math.max(e.startGenerators[f.generator] ?? 0, f.count);
        break;
      case 'keepModels':
        e.keepModels = true;
        break;
      case 'happeningInterval':
        e.happeningInterval *= f.mult;
        break;
      case 'comboWindow':
        e.comboWindowMs += f.addMs;
        break;
      case 'shipThreshold':
        e.shipThreshold *= f.mult;
        break;
      case 'rarityLuck':
        e.rarityLuck += f.add;
        break;
      case 'globalMult':
        e.globalMult *= f.mult;
        break;
      case 'tapMult':
        e.tapMult *= f.mult;
        break;
    }
  }
  cache.set(nodes, { content, e });
  return e;
}

/** Production multiplier from the Paradigm layer: productionPerPoint ^ currency ever earned, times tree multipliers. */
export function paradigmMultiplier(state: Pick<GarageState, 'paradigm'>, content: GarageContent): number {
  const cfg = content.paradigm;
  const p = state.paradigm;
  if (!cfg || !p) return 1;
  const earned = Number.isFinite(p.earned) ? Math.max(0, p.earned) : 0;
  const m = Math.pow(Math.max(1, cfg.productionPerPoint), earned) * paradigmEffects(state, content).globalMult;
  return Number.isFinite(m) ? Math.min(m, 1e100) : 1;
}

/** The combo window after the tree. */
export function comboWindowMs(state: Pick<GarageState, 'paradigm'>, content: GarageContent): number {
  return content.tap.comboWindowMs + paradigmEffects(state, content).comboWindowMs;
}
