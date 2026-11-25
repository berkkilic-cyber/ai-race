/**
 * The link between the two modes, as pure functions (no React): Lab Rep perks from the
 * Garage become a race run's start bonus, and a finished race becomes the Garage's reward
 * input. Lab Rep is the account level: it is not spent. See docs/GARAGE.md ("Link with the race").
 */
import { getScoreMultiplier, type ContentPack, type GameSetup, type GameState, type Modifier, type StartBonus } from '@/engine';
import { labPerks, nextLabPerk, type GarageContent, type LabPerkDef, type RaceRewardInput } from '@/idle';

/** What decides whether a run gets perks. */
export interface PerkSetup {
  /** The player's switch on the start screen. */
  perksOn: boolean;
  /** A daily challenge run (src/ui/daily): perks are always off, the same run for everyone. */
  daily?: boolean;
}

export interface SetupBonus {
  /** The run's start bonus (undefined: none). */
  bonus?: StartBonus;
  /** The race perks that went into it (empty when off). */
  perkIds: string[];
}

const NO_BONUS: SetupBonus = { perkIds: [] };

/** True for perks that change a race run (not titles, frames or Garage-only perks such as away storage). */
export function isPowerPerk(perk: LabPerkDef): boolean {
  return perk.effect.kind !== 'title' && perk.effect.kind !== 'frame' && perk.effect.kind !== 'awayHours';
}

/**
 * The race start bonus for a set of perks. startCash / startHype add to the founder's start;
 * hypeIncome / cashIncome become additive income modifiers (+0.03 = +3%). momentRate has no
 * engine equivalent (the engine has no moment-frequency stat) and adds nothing; cosmetic perks
 * add nothing. Undefined when nothing applies.
 */
export function startBonusOf(perks: readonly LabPerkDef[]): StartBonus | undefined {
  let startHype = 0;
  let startCash = 0;
  const modifiers: Modifier[] = [];
  for (const p of perks) {
    const a = p.effect.amount;
    if (!Number.isFinite(a)) continue;
    switch (p.effect.kind) {
      case 'startHype':
        startHype += a;
        break;
      case 'startCash':
        startCash += a;
        break;
      case 'hypeIncome':
        modifiers.push({ stat: 'hypeIncome', op: 'add', value: a });
        break;
      case 'cashIncome':
        modifiers.push({ stat: 'cashIncome', op: 'add', value: a });
        break;
      default:
        break;
    }
  }
  if (startHype === 0 && startCash === 0 && modifiers.length === 0) return undefined;
  return { ...(startHype ? { startHype } : {}), ...(startCash ? { startCash } : {}), ...(modifiers.length ? { modifiers } : {}) };
}

/** The race perks active at a Lab Rep (power perks only). */
export function racePerks(content: GarageContent, labRep: number): LabPerkDef[] {
  return labPerks(content, labRep).filter(isPowerPerk);
}

/**
 * THE bonus for a run's setup: everything that decides whether and which perks apply goes
 * through here (the start screen, Play again, autostart). Perks off = no bonus.
 */
export function bonusForSetup(setup: PerkSetup, labRep: number, content: GarageContent): SetupBonus {
  if (!setup.perksOn || setup.daily) return NO_BONUS;
  const perks = racePerks(content, labRep);
  const bonus = startBonusOf(perks);
  return bonus ? { bonus, perkIds: perks.map((p) => p.id) } : NO_BONUS;
}

/** A run setup with its perk bonus applied (replaces any bonus it had). */
export function withSetupBonus<T extends Omit<GameSetup, 'seed'>>(setup: T, perks: PerkSetup, labRep: number, content: GarageContent): T & { perksOn: boolean; perkIds: string[] } {
  const { bonus, perkIds } = bonusForSetup(perks, labRep, content);
  const rest: T = { ...setup };
  delete rest.bonus;
  return { ...rest, ...(bonus ? { bonus } : {}), perksOn: perks.perksOn, perkIds };
}

export interface PerkTotals {
  cash: number;
  hype: number;
  hypeIncome: number;
  cashIncome: number;
}

/** The race perks added up, for the compact chip ("+30 Cash, +8 Hype"). */
export function perkTotals(perks: readonly LabPerkDef[]): PerkTotals {
  const out: PerkTotals = { cash: 0, hype: 0, hypeIncome: 0, cashIncome: 0 };
  for (const p of perks) {
    if (p.effect.kind === 'startCash') out.cash += p.effect.amount;
    else if (p.effect.kind === 'startHype') out.hype += p.effect.amount;
    else if (p.effect.kind === 'hypeIncome') out.hypeIncome += p.effect.amount;
    else if (p.effect.kind === 'cashIncome') out.cashIncome += p.effect.amount;
  }
  return out;
}

/** The highest title and frame unlocked at a Lab Rep (shown automatically). */
export function cosmeticsAt(content: GarageContent, labRep: number): { title?: LabPerkDef; frame?: LabPerkDef } {
  const unlocked = labPerks(content, labRep);
  const last = (kind: 'title' | 'frame') => unlocked.filter((p) => p.effect.kind === kind).sort((a, b) => b.rep - a.rep)[0];
  const title = last('title');
  const frame = last('frame');
  return { ...(title ? { title } : {}), ...(frame ? { frame } : {}) };
}

export interface LabRepLevel {
  /** Whole Lab Rep. */
  level: number;
  /** The next perk to earn, if any. */
  next?: LabPerkDef;
  /** 0..1 of the way from the last perk (or 0) to the next one (1 when all are earned). */
  progress: number;
}

/** Lab Rep as a level with the progress to the next perk. `total` may carry a fraction. */
export function labRepLevel(content: GarageContent, total: number): LabRepLevel {
  const t = Number.isFinite(total) ? Math.max(0, total) : 0;
  const level = Math.floor(t + 1e-9);
  const next = nextLabPerk(content, level);
  if (!next) return { level, progress: 1 };
  const prev = content.labRep.perks.filter((p) => p.rep <= level).reduce((m, p) => Math.max(m, p.rep), 0);
  const span = next.rep - prev;
  return { level, next, progress: span > 0 ? Math.min(1, Math.max(0, (t - prev) / span)) : 0 };
}

/**
 * The reward input for a finished race (null while it runs, and for a run that did not reach
 * an ending: an abandoned run grants nothing). The score is taken back to before the race's
 * difficulty and run-length multipliers, which the reward counts on its own.
 */
export function raceRewardInputOf(state: GameState | null, pack: ContentPack): RaceRewardInput | null {
  if (!state || state.status !== 'ended' || !state.ending) return null;
  const mult = getScoreMultiplier(state, pack);
  const raw = mult > 0 ? state.ending.score / mult : state.ending.score;
  return {
    won: state.ending.kind === 'win',
    ...(state.difficulty !== undefined ? { difficulty: state.difficulty } : {}),
    ...(state.runLength !== undefined ? { runLength: state.runLength } : {}),
    score: Number.isFinite(raw) ? Math.max(0, raw) : 0,
    seed: state.seed,
  };
}
