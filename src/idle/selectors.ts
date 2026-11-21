/** Pure reads for screens and bots: what to show, what is next, what perks are active. */
import { isGeneratorUnlocked, isUpgradeAvailable, requirementMet, requirementProgress } from './garage';
import { bulkCost, generatorRate, maxAffordable, unitCost } from './rates';
import type { GarageContent, GarageState, GeneratorDef, LabPerkDef, Requirement, UpgradeDef } from './types';

export interface GeneratorRow {
  def: GeneratorDef;
  owned: number;
  /** Unlocked by the current generation. */
  unlocked: boolean;
  /** Shown in full (owned, or the next one to buy); otherwise a teaser. */
  revealed: boolean;
  /** Price of the next one. */
  cost: number;
  /** Tokens per second this tier makes now. */
  rate: number;
}

/**
 * The generator list: every tier unlocked by the generation, the first unowned one
 * revealed and the one after it as a teaser; plus the next locked tier (shows which
 * model generation unlocks it).
 */
export function generatorRows(state: GarageState, content: GarageContent): GeneratorRow[] {
  const rows: GeneratorRow[] = [];
  let teasers = 0;
  for (const def of content.generators) {
    const owned = state.generators[def.id] ?? 0;
    const unlocked = isGeneratorUnlocked(state, content, def.id);
    const revealed = unlocked && (owned > 0 || teasers === 0);
    if (!revealed) {
      if (teasers >= 2) break;
      teasers += 1;
    } else if (owned === 0) teasers += 1;
    rows.push({ def, owned, unlocked, revealed, cost: unitCost(def, owned), rate: generatorRate(state, content, def.id) });
  }
  return rows;
}

/** Number and price of a buy in a given mode (1, 10 or max). */
export function buyQuote(state: GarageState, def: GeneratorDef, mode: 1 | 10 | 'max'): { count: number; cost: number } {
  const owned = state.generators[def.id] ?? 0;
  if (mode === 'max') {
    const n = maxAffordable(def, owned, state.tokens);
    return n > 0 ? { count: n, cost: bulkCost(def, owned, n) } : { count: 1, cost: unitCost(def, owned) };
  }
  return { count: mode, cost: bulkCost(def, owned, mode) };
}

/** Upgrades on offer now (requirements met, not owned), cheapest first. */
export function availableUpgrades(state: GarageState, content: GarageContent): UpgradeDef[] {
  return content.upgrades.filter((u) => isUpgradeAvailable(state, u)).sort((a, b) => a.cost - b.cost);
}

export interface UpcomingUpgrade {
  def: UpgradeDef;
  /** The unmet requirement closest to done. */
  requirement: Requirement;
  progress: number;
}

/** Upgrades not yet offered whose requirements are within reach (this generation), closest first. */
export function nextUnlocks(state: GarageState, content: GarageContent, limit = 3): UpcomingUpgrade[] {
  const out: UpcomingUpgrade[] = [];
  for (const def of content.upgrades) {
    if (state.upgrades.includes(def.id)) continue;
    const unmet = def.requires.filter((r) => !requirementMet(state, r));
    if (unmet.length === 0) continue;
    if (unmet.some((r) => r.type === 'generation' || r.type === 'upgrade')) continue;
    if (unmet.some((r) => r.type === 'owned' && !isGeneratorUnlocked(state, content, r.generator))) continue;
    const scored = unmet.map((r) => ({ r, p: requirementProgress(state, r) })).sort((a, b) => a.p - b.p);
    if (scored[0].p <= 0) continue;
    out.push({ def, requirement: scored[0].r, progress: scored[0].p });
  }
  return out.sort((a, b) => b.progress - a.progress || a.def.cost - b.def.cost).slice(0, limit);
}

/** Lab Rep perks active at this rep (start bonuses for race runs; see docs/GARAGE.md). */
export function labPerks(content: GarageContent, labRep: number): LabPerkDef[] {
  return content.labRep.perks.filter((p) => labRep >= p.rep);
}

/** The next perk still to earn, if any. */
export function nextLabPerk(content: GarageContent, labRep: number): LabPerkDef | undefined {
  return content.labRep.perks.filter((p) => labRep < p.rep).sort((a, b) => a.rep - b.rep)[0];
}
