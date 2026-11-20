/**
 * Typed-array view of every lab's adoption, used inside one tick's lab updates.
 * The contract stores adoption as Record<RegionId, number>; the per-region loops
 * run many times per tick, so they work on arrays indexed like pack.regions and
 * the records are rebuilt once at the end of the lab phase.
 */
import type { EngineContext } from './context';
import { isBannedAt } from './derived';
import type { GameState, LabState } from './types';
import { max, min } from './natives';

export interface LabArrays {
  adoption: Float64Array;
  /** 1 where the lab was banned at the start of the tick. */
  banned: Uint8Array;
  /** The record `adoption` was last synced with; undefined = never. */
  source?: Record<string, number>;
}

/**
 * Adoption records changed outside the tick's lab phase since they were last synced
 * (setAdoption marks them). Lets a reused workspace skip reloading unchanged labs.
 */
const changedRecords = new WeakSet<Record<string, number>>();

export function markAdoptionChanged(record: Record<string, number>): void {
  changedRecords.add(record);
}

export interface Workspace {
  labs: Map<string, LabArrays>;
  /** Σ adoption of all labs per region. */
  totals: Float64Array;
  /** Scratch: regions seeded during the current lab's update. */
  fresh: Uint8Array;
}

/** Workspaces reused across ticks of the same draft (headless runs). */
const reuse = new WeakMap<GameState, Workspace>();

function emptyWorkspace(state: GameState, regionCount: number): Workspace {
  const labs = new Map<string, LabArrays>();
  for (const id of state.labOrder) labs.set(id, { adoption: new Float64Array(regionCount), banned: new Uint8Array(regionCount) });
  return { labs, totals: new Float64Array(regionCount), fresh: new Uint8Array(regionCount) };
}

function loadLab(lab: LabState, arrays: LabArrays, context: EngineContext, tick: number): void {
  if (arrays.source !== lab.adoption || changedRecords.has(lab.adoption)) {
    arrays.adoption.fill(0);
    for (const regionId in lab.adoption) {
      const index = context.regionIndex.get(regionId);
      if (index !== undefined) arrays.adoption[index] = lab.adoption[regionId];
    }
    arrays.source = lab.adoption;
    changedRecords.delete(lab.adoption);
  }
  arrays.banned.fill(0);
  for (const regionId in lab.bans) {
    const index = context.regionIndex.get(regionId);
    if (index !== undefined && isBannedAt(lab, regionId, tick)) arrays.banned[index] = 1;
  }
}

export function loadWorkspace(state: GameState, context: EngineContext): Workspace {
  const regionCount = context.pack.regions.length;
  let ws = reuse.get(state);
  if (!ws || ws.labs.size !== state.labOrder.length || ws.totals.length !== regionCount) {
    ws = emptyWorkspace(state, regionCount);
    reuse.set(state, ws);
  }
  ws.totals.fill(0);
  for (const id of state.labOrder) {
    const arrays = ws.labs.get(id) ?? { adoption: new Float64Array(regionCount), banned: new Uint8Array(regionCount) };
    ws.labs.set(id, arrays);
    loadLab(state.labs[id], arrays, context, state.tick);
    for (let i = 0; i < regionCount; i++) ws.totals[i] += arrays.adoption[i];
  }
  return ws;
}

/** Writes adoption back to the records in place; regions below minAdoption are removed. */
export function storeWorkspace(state: GameState, context: EngineContext, ws: Workspace): void {
  const regions = context.pack.regions;
  const { minAdoption } = context.balance;
  for (const id of state.labOrder) {
    const arrays = ws.labs.get(id);
    if (!arrays) continue;
    const record = state.labs[id].adoption;
    for (let i = 0; i < regions.length; i++) {
      const value = arrays.adoption[i];
      const regionId = regions[i].id;
      if (value >= minAdoption) record[regionId] = min(1, value);
      else if (record[regionId] !== undefined) delete record[regionId];
    }
    arrays.source = record;
    changedRecords.delete(record);
  }
}

/** Sets a lab's adoption in region `index`, keeping totals in step. Values below minAdoption become 0. */
export function setAdoptionAt(ws: Workspace, arrays: LabArrays, index: number, value: number, minAdoption: number): void {
  const next = value < minAdoption ? 0 : min(1, value);
  ws.totals[index] += next - arrays.adoption[index];
  arrays.adoption[index] = next;
}

export function freeShareAt(ws: Workspace, index: number): number {
  return max(0, 1 - ws.totals[index]);
}

/** Users (millions) of a lab from its arrays. */
export function usersFromArrays(arrays: LabArrays, context: EngineContext): number {
  const regions = context.pack.regions;
  let users = 0;
  for (let i = 0; i < regions.length; i++) users += arrays.adoption[i] * regions[i].population;
  return users;
}
