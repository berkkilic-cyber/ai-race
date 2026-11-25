/**
 * Away storage: the offline cap shown as a store that fills while the player is away.
 * Pure reads for the screen and the bots; the rules themselves are offlineTerms (rates.ts)
 * and the catch-up in garage.ts.
 */
import { modelEffects } from './labRates';
import { HOUR_MS, offlineTerms, perkAwayHours, upgradeDef } from './rates';
import type { GarageContent, GarageState, UpgradeDef } from './types';

/** Where an hour of away storage comes from. */
export type StorageSourceKind = 'base' | 'upgrade' | 'generation' | 'model' | 'perk' | 'paradigm' | 'paid';

export interface StorageSource {
  kind: StorageSourceKind;
  /** The upgrade, generation, perk or tree node id ('' for the base and models). */
  id: string;
  hours: number;
}

/** The cheapest way still open to raise away storage. */
export interface StorageNext {
  kind: 'upgrade' | 'perk';
  id: string;
  hours: number;
  /** Upgrade cost in tokens, or the Lab Rep the perk needs. */
  cost: number;
  /** The upgrade is offered now (its requirements hold); a perk is never "available" before its Rep. */
  available: boolean;
}

export interface AwayStorage {
  capMs: number;
  rate: number;
  sources: StorageSource[];
  next: StorageNext | null;
}

function capHoursOf(def: UpgradeDef): number {
  let h = 0;
  for (const e of def.effects) if (e.kind === 'offlineCap') h += e.hours;
  return h;
}

/** Away storage now: capacity, rate, what fills it, and the next way to raise it. */
export function awayStorage(state: GarageState, content: GarageContent, paradigmHours = 0): AwayStorage {
  const { capMs, rate } = offlineTerms(state, content);
  const sources: StorageSource[] = [{ kind: 'base', id: '', hours: content.offline.capHours }];
  for (const id of state.upgrades) {
    const def = upgradeDef(content, id);
    const h = def ? capHoursOf(def) : 0;
    if (h) sources.push({ kind: 'upgrade', id, hours: h });
  }
  const reached = Math.min(state.generation, content.generations.length - 1);
  for (let g = 0; g <= reached; g++) {
    const h = (content.generations[g]?.perks ?? []).reduce((sum, e) => sum + (e.kind === 'offlineCap' ? e.hours : 0), 0);
    if (h) sources.push({ kind: 'generation', id: content.generations[g].id, hours: h });
  }
  const model = modelEffects(state, content).offlineCap;
  if (model) sources.push({ kind: 'model', id: '', hours: model });
  for (const p of content.labRep.perks) if (p.effect.kind === 'awayHours' && state.labRep >= p.rep) sources.push({ kind: 'perk', id: p.id, hours: p.effect.amount });
  if (paradigmHours) sources.push({ kind: 'paradigm', id: '', hours: paradigmHours });
  const summed = sources.reduce((sum, src) => sum + src.hours, 0) * HOUR_MS;
  if (capMs > summed + 1) sources.push({ kind: 'paid', id: '', hours: (capMs - summed) / HOUR_MS });
  return { capMs, rate, sources, next: nextStorage(state, content) };
}

/** The cheapest unowned upgrade that adds storage, else the next storage perk. */
export function nextStorage(state: GarageState, content: GarageContent): StorageNext | null {
  const ups = content.upgrades.filter((u) => !state.upgrades.includes(u.id) && capHoursOf(u) > 0).sort((a, b) => a.cost - b.cost);
  const meets = (u: UpgradeDef) =>
    u.requires.every((r) => {
      switch (r.type) {
        case 'generation':
          return state.generation >= r.min;
        case 'lifetime':
          return state.genLifetime >= r.tokens;
        case 'allTime':
          return state.stats.tokensAllTime >= r.tokens;
        case 'owned':
          return (state.generators[r.generator] ?? 0) >= r.count;
        case 'taps':
          return state.stats.taps >= r.count;
        case 'upgrade':
          return state.upgrades.includes(r.id);
      }
    });
  if (ups.length) {
    const u = ups.find(meets) ?? ups[0];
    return { kind: 'upgrade', id: u.id, hours: capHoursOf(u), cost: u.cost, available: meets(u) };
  }
  const perk = content.labRep.perks.filter((p) => p.effect.kind === 'awayHours' && state.labRep < p.rep).sort((a, b) => a.rep - b.rep)[0];
  return perk ? { kind: 'perk', id: perk.id, hours: perk.effect.amount, cost: perk.rep, available: false } : null;
}

/**
 * Hours of away storage the content's fixed sources can reach (base, every storage upgrade,
 * generation perks, Lab Rep perks, plus `extraHours`); kept models can go past it.
 */
export function storageReachHours(content: GarageContent, extraHours = 0): number {
  let h = content.offline.capHours + extraHours;
  for (const u of content.upgrades) h += capHoursOf(u);
  for (const g of content.generations) for (const e of g.perks) if (e.kind === 'offlineCap') h += e.hours;
  for (const p of content.labRep.perks) if (p.effect.kind === 'awayHours') h += p.effect.amount;
  return h;
}

/** How full the storage would be after `awayMs` away (0..1). */
export function storageFill(capMs: number, awayMs: number): number {
  if (!(capMs > 0) || !Number.isFinite(awayMs)) return 0;
  return Math.max(0, Math.min(1, awayMs / capMs));
}

export { perkAwayHours };
