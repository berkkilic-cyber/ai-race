import { happeningDef, nextMilestone, type GarageContent, type GarageState, type ModelCandidate, type StaffSplit } from '@/idle';

/**
 * Discrete Garage moments between two states, read-only and pure: what the sound mapping
 * (src/ui/feel/garageSounds.ts) and the analytics wiring (src/ui/analytics/subscriptions.ts)
 * both need, derived from counters and references so the clock advancing alone yields
 * nothing. O(1) for an unchanged state; the generator loop runs only when the owned
 * counts changed.
 */
export interface GarageMoments {
  /** The lab moved to a new stage (its index). */
  stage: number | null;
  /** A model was shipped (the new generation number) and the launch choice, if any. */
  ship: { generation: number; choice: string | null } | null;
  /** A training run came ready (the queue grew without a launch). */
  trainingReady: boolean;
  /** A run was launched: its candidates are revealed. */
  trainingStarted: boolean;
  /** A candidate was picked: kept in a free slot, swapped in for a kept model, or all scrapped. */
  pick: { action: 'keep' | 'swap' | 'scrap'; rarity: string; strength: string } | null;
  /** The staff split changed (the new split). */
  staff: StaffSplit | null;
  /** A lab happening appeared (its id). */
  happeningShown: string | null;
  /** The happening on screen went: tapped by the player, missed, or collected by a helper. */
  happening: { id: string; outcome: 'tapped' | 'missed' | 'auto'; averted: boolean } | null;
  /** Milestones reached, one per tier (1-based) with the highest count reached. */
  milestones: { tier: number; count: number }[];
  /** The bonus multiplier offer was claimed. */
  multiplied: boolean;
  /** Generators the auto-buy helper bought. */
  autoBought: number;
  /** Generators the player bought (auto-buy excluded). */
  bought: number;
}

const NONE: GarageMoments = Object.freeze({
  stage: null,
  ship: null,
  trainingReady: false,
  trainingStarted: false,
  pick: null,
  staff: null,
  happeningShown: null,
  happening: null,
  milestones: [],
  multiplied: false,
  autoBought: 0,
  bought: 0,
}) as GarageMoments;

/** The model's rarity and main strength (its first boon's stat), for analytics. */
function describe(content: GarageContent, m: ModelCandidate | undefined): { rarity: string; strength: string } {
  if (!m) return { rarity: 'unknown', strength: 'unknown' };
  const trait = m.boons[0] ? content.training?.traits.find((t) => t.id === m.boons[0].trait) : undefined;
  return { rarity: m.rarity, strength: trait?.stat ?? m.boons[0]?.trait ?? 'none' };
}

/** The rarest of the candidates (by the content's rarity order), for a scrap. */
function rarest(content: GarageContent, list: readonly ModelCandidate[]): ModelCandidate | undefined {
  const order = content.training?.rarities.map((r) => r.id) ?? [];
  let best: ModelCandidate | undefined;
  for (const c of list) if (!best || order.indexOf(c.rarity) > order.indexOf(best.rarity)) best = c;
  return best;
}

function lastOf(list: readonly number[] | undefined): number {
  return list && list.length ? list[list.length - 1] : -Infinity;
}

export function garageMoments(prev: GarageState | null, next: GarageState | null, content: GarageContent): GarageMoments {
  if (!prev || !next || prev === next) return NONE;
  // A reset or a different save: nothing happened in play.
  if (next.createdAt !== prev.createdAt) return NONE;
  const a = prev.stats;
  const b = next.stats;
  const shipped = next.generation > prev.generation;
  const out: GarageMoments = { ...NONE, milestones: [] };

  if (next.stage > prev.stage) out.stage = next.stage;
  if (shipped) out.ship = { generation: next.generation, choice: next.shipChoice ?? next.lastShip?.choice ?? null };

  if (b.trainingRuns > a.trainingRuns) out.trainingStarted = true;
  else if (next.training.charges > prev.training.charges && !shipped) out.trainingReady = true;

  const before = prev.training.candidates;
  if (before && before.length && !next.training.candidates && !shipped) {
    if (b.modelsKept > a.modelsKept) {
      const kept = next.models.find((m) => before.some((c) => c.uid === m.uid));
      out.pick = { action: next.models.length > prev.models.length ? 'keep' : 'swap', ...describe(content, kept) };
    } else out.pick = { action: 'scrap', ...describe(content, rarest(content, before)) };
  }

  const sa = prev.staff;
  const sb = next.staff;
  if (sa !== sb && (sa.research !== sb.research || sa.product !== sb.product || sa.safety !== sb.safety)) out.staff = sb;

  const h = prev.happening;
  if (next.happening && next.happening.uid !== h?.uid) out.happeningShown = next.happening.id;
  if (h && next.happening?.uid !== h.uid) {
    const averted = !!happeningDef(content, h.id)?.penaltySeconds;
    if (b.happeningsCaught > a.happeningsCaught) out.happening = { id: h.id, outcome: next.now >= h.expiresAt ? 'auto' : 'tapped', averted };
    else if (b.happeningsMissed > a.happeningsMissed) out.happening = { id: h.id, outcome: 'missed', averted };
  }

  out.autoBought = Math.max(0, b.autoBought - a.autoBought);
  out.bought = Math.max(0, b.generatorsBought - a.generatorsBought - out.autoBought);

  if (next.generators !== prev.generators && !shipped && content.milestones) {
    const gens = content.generators;
    for (let i = 0; i < gens.length; i++) {
      const was = prev.generators[gens[i].id] ?? 0;
      const now = next.generators[gens[i].id] ?? 0;
      if (now <= was) continue;
      let goal = nextMilestone(content, was);
      let reached = 0;
      while (goal && now >= goal.count) {
        reached = goal.count;
        goal = nextMilestone(content, goal.count);
      }
      if (reached) out.milestones.push({ tier: i + 1, count: reached });
    }
  }

  if (next.offers !== prev.offers && lastOf(next.offers.bonusMultiply) > lastOf(prev.offers.bonusMultiply)) out.multiplied = true;
  return out;
}
