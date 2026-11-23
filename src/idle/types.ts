/**
 * The idle economy's contract: content (data a theme pack supplies) and state (what a
 * save holds). Theme-agnostic: no names, numbers or text of any theme live here.
 *
 * Numbers are plain doubles (see docs/GARAGE.md, "Big numbers"): every amount is a
 * finite, non-negative number below MAX_AMOUNT, and every time is a millisecond
 * timestamp on the caller's clock.
 */

export type GeneratorId = string;
export type UpgradeId = string;

/** A producer bought with tokens; owning more raises its price exponentially. */
export interface GeneratorDef {
  id: GeneratorId;
  nameKey: string;
  descKey: string;
  /** Icon name in the UI's icon set (unknown names draw a fallback). */
  icon: string;
  /** Price of the first one. */
  baseCost: number;
  /** Each one owned multiplies the price by this (> 1). */
  costGrowth: number;
  /** Tokens per second for one, before multipliers. */
  baseRate: number;
  /** First generation (0 = from the start) in which the tier can be bought. */
  unlockGeneration: number;
}

export type UpgradeEffect =
  /** Multiplies the token value of a tap. */
  | { kind: 'tapMult'; mult: number }
  /** Each tap also yields this share of the current total rate per second. */
  | { kind: 'tapFromRate'; share: number }
  /** Multiplies one generator tier. */
  | { kind: 'generatorMult'; generator: GeneratorId; mult: number }
  /** Multiplies all production (generators and taps). */
  | { kind: 'globalMult'; mult: number }
  /** Adds hours to the offline earnings cap. */
  | { kind: 'offlineCap'; hours: number }
  /** Adds to the offline earnings rate (0..1). */
  | { kind: 'offlineRate'; add: number }
  /** Adds stacks to the combo cap. */
  | { kind: 'comboStacks'; add: number }
  /** Multiplies golden-moment rewards. */
  | { kind: 'goldenMult'; mult: number }
  /** Multiplies the time between golden moments (below 1 = more often). */
  | { kind: 'goldenInterval'; mult: number };

export type Requirement =
  /** At least `count` of a generator owned. */
  | { type: 'owned'; generator: GeneratorId; count: number }
  /** At least this many tokens earned in the current generation. */
  | { type: 'lifetime'; tokens: number }
  /** Generation index at least `min`. */
  | { type: 'generation'; min: number }
  /** At least this many taps, all time. */
  | { type: 'taps'; count: number }
  /** Another upgrade owned. */
  | { type: 'upgrade'; id: UpgradeId }
  /** At least this many tokens earned, all time (never resets). */
  | { type: 'allTime'; tokens: number };

export interface UpgradeDef {
  id: UpgradeId;
  nameKey: string;
  descKey: string;
  icon: string;
  cost: number;
  effects: UpgradeEffect[];
  /** All must hold for the upgrade to be offered. */
  requires: Requirement[];
  /** Survives shipping a model (most upgrades reset). */
  keep?: boolean;
}

/** A model generation. Generation 0 is where a save starts. */
export interface GenerationDef {
  id: string;
  nameKey: string;
  /** The tabloid launch headline shown when this generation ships. */
  headlineKey: string;
  /** Short line naming what the generation unlocks (shown in the ship panel). */
  unlockKey: string;
  /** Tokens earned in the previous generation needed to ship this one (0 for generation 0). */
  shipAt: number;
  /** Permanent effects while the save is at this generation or later. */
  perks: UpgradeEffect[];
}

export interface PrestigeConfig {
  /** Hype gained = floor((tokens earned this generation / scale) ^ exponent). */
  scale: number;
  exponent: number;
  /** Each Hype point adds this to the production multiplier (0.1 = +10%). */
  hypePerPoint: number;
  /** After the last named generation, each further one needs this many times more tokens. */
  endlessGrowth: number;
}

export interface TapConfig {
  /** Tokens per tap before multipliers. */
  base: number;
  /** Taps closer together than this keep the combo going. */
  comboWindowMs: number;
  /** Taps per combo stack. */
  comboStep: number;
  /** Stack cap before upgrades. */
  comboMaxStacks: number;
  /** Each stack adds this to the tap multiplier (0.1 = +10%). */
  comboStackBonus: number;
}

export type GoldenReward =
  /** `seconds` of current production at once (at least `min` taps' worth). */
  | { kind: 'burst'; seconds: number; minTaps: number }
  /** Production times `mult` for `seconds`. */
  | { kind: 'frenzy'; mult: number; seconds: number }
  /** Taps times `mult` for `seconds`. */
  | { kind: 'tapFrenzy'; mult: number; seconds: number };

export interface GoldenDef {
  id: string;
  textKey: string;
  /** What appears on screen (short). */
  labelKey: string;
  icon: string;
  weight: number;
  reward: GoldenReward;
  minGeneration?: number;
}

export interface GoldenConfig {
  firstAfterMs: number;
  intervalMinMs: number;
  intervalMaxMs: number;
  lifetimeMs: number;
  defs: GoldenDef[];
}

export interface IncidentDef {
  id: string;
  textKey: string;
  /** Headline when fixed. */
  fixKey: string;
  icon: string;
  weight: number;
  /** The hit tier's rate is multiplied by this while the incident lasts. */
  mult: number;
  durationMs: number;
  tapsToFix: number;
  minGeneration?: number;
}

export interface IncidentConfig {
  firstAfterMs: number;
  intervalMinMs: number;
  intervalMaxMs: number;
  /** A tier needs at least this many owned to be hit. */
  minOwned: number;
  /** First generation with incidents. */
  minGeneration: number;
  defs: IncidentDef[];
}

export interface OfflineConfig {
  /** A gap longer than this counts as time away (earned at the offline rate, capped). */
  thresholdMs: number;
  /** Share of production earned while away (0..1). */
  rate: number;
  capHours: number;
  /** A "While you were away" report appears after at least this long away. */
  reportMinMs: number;
}

export type OfferId = 'offlineDouble' | 'boost' | 'frenzyExtend' | 'incidentFix' | 'crate' | 'prestigeBonus';

export const OFFER_IDS: readonly OfferId[] = ['offlineDouble', 'boost', 'frenzyExtend', 'incidentFix', 'crate', 'prestigeBonus'];

/**
 * A bonus the player opts into (the UI backs each with a rewarded ad). Every offer has a
 * cooldown and a cap per rolling 24 hours; the reward fields that apply to its id are set.
 */
export interface OfferDef {
  id: OfferId;
  cooldownMs: number;
  dailyCap: number;
  /** offlineDouble: offline earnings multiplied by this. */
  offlineMult?: number;
  /** boost: production multiplier, added duration and the stack cap. */
  boostMult?: number;
  boostMs?: number;
  boostCapMs?: number;
  /** frenzyExtend: added frenzy time. */
  extendMs?: number;
  /** crate: seconds of production granted (at least `crateMinTaps` taps' worth). */
  crateSeconds?: number;
  crateMinTaps?: number;
  /** prestigeBonus: extra share of the Hype gained (0.25 = +25%). */
  prestigeBonus?: number;
}

export type StatKey =
  | 'taps'
  | 'tokensAllTime'
  | 'modelsShipped'
  | 'bestCombo'
  | 'goldenCaught'
  | 'goldenMissed'
  | 'incidentsFixed'
  | 'incidentsSuffered'
  | 'offlineReturns'
  | 'generatorsBought'
  | 'upgradesBought'
  | 'cratesOpened'
  | 'boostsUsed'
  | 'offersClaimed'
  | 'happeningsCaught'
  | 'trainingRuns'
  | 'modelsKept'
  | 'autoBought';

export type AchievementRule =
  | { type: 'stat'; stat: StatKey; gte: number }
  | { type: 'owned'; generator: GeneratorId; gte: number }
  /** Taps this generation with no generator owned. */
  | { type: 'pureTaps'; gte: number }
  /** Shipped a model with no upgrade bought in that generation. */
  | { type: 'shipNoUpgrades' }
  /** Fixed an incident within this many ms of it starting. */
  | { type: 'fastFix'; ms: number }
  /** Exactly this many of one generator owned. */
  | { type: 'exactOwned'; count: number };

export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  secret?: boolean;
  rule: AchievementRule;
}

/** A small start bonus for race runs, earned with Lab Rep (data only; see labPerks). */
export interface LabPerkDef {
  id: string;
  rep: number;
  textKey: string;
  /** What a race run would apply; the race engine does not read this yet. */
  effect: { kind: 'startHype' | 'startCash' | 'hypeIncome' | 'cashIncome' | 'momentRate'; amount: number };
}

export interface LabRepConfig {
  /** Rep per model shipped. */
  perShip: number;
  /** Extra rep per generation index reached (rewards depth). */
  perGeneration: number;
  perks: LabPerkDef[];
}

export interface HeadlineDef {
  key: string;
  minGeneration?: number;
  weight?: number;
}

export interface NewsConfig {
  intervalMinMs: number;
  intervalMaxMs: number;
  /** Ticker items kept in state. */
  keep: number;
  /** Ticker line for an unlocked achievement; `{name}` = its name key. */
  achievementKey: string;
  headlines: HeadlineDef[];
}

// ---------------------------------------------------------------------------------------
// The lab (stages, milestones, training runs, staff, ship day, happenings, automation).
// All optional: content without them plays as the plain clicker.

/** What a stage switches on. */
export type StageMechanic = 'none' | 'training' | 'staff' | 'autoCollect' | 'autoBuy';

/** A place the lab moves to as it grows. Reached stages are never lost (shipping keeps them). */
export interface StageDef {
  id: string;
  nameKey: string;
  /** One line about the place. */
  descKey: string;
  /** What the stage switches on, in words. */
  unlockKey: string;
  /** Which room the UI draws (theme-defined scene id). */
  scene: string;
  /** All must hold to move in. */
  requires: Requirement[];
  mechanic: StageMechanic;
  /** Active model slots from this stage on (0 before training runs). */
  modelSlots: number;
}

/** Owning `count` of one generator multiplies its output by `mult` (cumulative). */
export interface MilestoneConfig {
  steps: { count: number; mult: number }[];
  /** After the last step, every `repeatEvery` more owned multiply by `repeatMult` again. */
  repeatEvery: number;
  repeatMult: number;
}

/** What a trained model changes. Values are shares (0.1 = +10%) except offlineCap (hours). */
export type ModelStat = 'production' | 'tap' | 'offlineCap' | 'offlineRate' | 'shipHype' | 'happening' | 'incident' | 'trainingSpeed';

export const MODEL_STATS: readonly ModelStat[] = ['production', 'tap', 'offlineCap', 'offlineRate', 'shipHype', 'happening', 'incident', 'trainingSpeed'];

/** A strength (or, as a drawback, a weakness) a candidate model can roll. */
export interface TraitDef {
  id: string;
  stat: ModelStat;
  /** Value range before the rarity's power (signed: an `incident` boon is negative). */
  min: number;
  max: number;
  weight: number;
  /** `{value}` = the rolled value in words. */
  labelKey: string;
}

export interface RarityDef {
  id: string;
  nameKey: string;
  weight: number;
  /** Number of strengths rolled. */
  boons: number;
  /** Multiplies every rolled strength. */
  power: number;
  /** Chance of one drawback (0..1). */
  drawbackChance: number;
  /** How much Research staff raises this rarity's weight (0 for the commonest). */
  luck: number;
}

export interface TrainingConfig {
  /** Real time for one queued run to come ready. */
  cooldownMs: number;
  /** Runs that can wait in the queue (it fills while away). */
  queueMax: number;
  /** Candidates per run. */
  candidates: number;
  rarities: RarityDef[];
  traits: TraitDef[];
  drawbacks: TraitDef[];
  /** Name parts: "{prefix}-{suffix} {version}". */
  prefixKeys: string[];
  suffixKeys: string[];
  /** One-line descriptions by the candidate's main strength. */
  descKeys: Partial<Record<ModelStat, string[]>>;
}

/** Staff lanes. Each one's share of the headcount moves its effect around a neutral third. */
export type StaffLane = 'research' | 'product' | 'safety';

export const STAFF_LANES: readonly StaffLane[] = ['research', 'product', 'safety'];

export interface StaffConfig {
  /** Headcount to split (a third each is neutral). */
  total: number;
  /** Product: production × (1 + productSwing × (3p − 1)). */
  productSwing: number;
  /** Safety: incident frequency × (1 − safetySwing × (3s − 1)), severity × (1 − severitySwing × (3s − 1)), ship Hype × (1 + trustSwing × (3s − 1)). */
  safetySwing: number;
  severitySwing: number;
  trustSwing: number;
  /** Research: training speed × (1 + researchSwing × (3r − 1)); rarity luck × (3r − 1). */
  researchSwing: number;
}

/** A launch-day choice: modifies the Hype of this ship and carries a risk into the next run. */
export interface ShipChoiceDef {
  id: string;
  labelKey: string;
  descKey: string;
  hypeMult: number;
  /** Incident frequency multiplier for the whole next generation. */
  incidentMult: number;
  /** Training runs added to the queue (may exceed the queue cap once). */
  trainingRuns?: number;
  /** Extra Lab Rep. */
  labRep?: number;
}

export interface ShipRivalDef {
  id: string;
  nameKey: string;
  /** Leaderboard score at generation 0 and per generation. */
  base: number;
  growth: number;
}

export interface ShipDayConfig {
  choices: ShipChoiceDef[];
  /** Our leaderboard score: base + perGeneration × generation + perHype × log2(1 + Hype gained). */
  scoreBase: number;
  scorePerGeneration: number;
  scorePerHype: number;
  rivals: ShipRivalDef[];
  /** A rival's reaction; `{rival}` = its name key. */
  reactionKeys: string[];
  /** The benchmark the reveal runs on. */
  benchmarkKeys: string[];
}

/** A small tappable thing in the lab: tap for a reward, or let it go (some cost a little). */
export interface HappeningDef {
  id: string;
  labelKey: string;
  /** Ticker line when handled. */
  textKey: string;
  icon: string;
  weight: number;
  /** Where in the room it appears (theme-defined). */
  spot: string;
  minStage?: number;
  /** Seconds of production on tap (at least `rewardMinTaps` taps' worth). */
  rewardSeconds: number;
  rewardMinTaps: number;
  /** Seconds of production lost if it expires untouched (0 or absent: none). */
  penaltySeconds?: number;
  /** Ticker line when it expires untouched and costs something. */
  missKey?: string;
  /** On tap, the next training run comes this much sooner (once training is on). */
  trainingMs?: number;
}

export interface HappeningConfig {
  firstAfterMs: number;
  intervalMinMs: number;
  intervalMaxMs: number;
  lifetimeMs: number;
  /** A missed happening never takes more than this share of the tokens in hand. */
  penaltyCapShare: number;
  defs: HappeningDef[];
}

export interface AutomationConfig {
  /** autoCollect: happenings are handled at expiry for this share of their reward. */
  collectShare: number;
  /** autoBuy: one purchase every this often while the lab is open. */
  buyIntervalMs: number;
  /** autoBuy spends at most this share of the tokens in hand on one purchase. */
  buyBudgetShare: number;
}

export interface GarageContent {
  id: string;
  stages?: StageDef[];
  milestones?: MilestoneConfig;
  training?: TrainingConfig;
  staff?: StaffConfig;
  shipDay?: ShipDayConfig;
  happenings?: HappeningConfig;
  automation?: AutomationConfig;
  generators: GeneratorDef[];
  upgrades: UpgradeDef[];
  generations: GenerationDef[];
  /** Name of an endless generation past the named ones; `{n}` = its number. */
  endlessNameKey: string;
  endlessHeadlineKey: string;
  prestige: PrestigeConfig;
  tap: TapConfig;
  golden: GoldenConfig;
  incidents: IncidentConfig;
  offline: OfflineConfig;
  offers: OfferDef[];
  achievements: AchievementDef[];
  labRep: LabRepConfig;
  news: NewsConfig;
  /** Text for every key above (English). */
  strings: Record<string, string>;
}

// ---------------------------------------------------------------------------------------
// State

export interface GoldenState {
  uid: number;
  id: string;
  spawnedAt: number;
  expiresAt: number;
  /** Position on the stage, 0..1 of its width and height. */
  x: number;
  y: number;
}

export interface IncidentState {
  uid: number;
  id: string;
  generator: GeneratorId;
  startedAt: number;
  until: number;
  taps: number;
}

export interface FrenzyState {
  /** Production multiplier. */
  mult: number;
  /** Tap multiplier. */
  tapMult: number;
  until: number;
}

export type NewsKind = 'headline' | 'launch' | 'golden' | 'incident' | 'fixed' | 'achievement' | 'stage' | 'happening' | 'training';

export interface HappeningState {
  uid: number;
  id: string;
  spawnedAt: number;
  expiresAt: number;
  /** Position in the room, 0..1 of its width and height (the UI may snap it to `spot`). */
  x: number;
  y: number;
}

/** A trained model: a candidate, or one kept in an active slot. */
export interface ModelCandidate {
  uid: number;
  /** Indexes into the name parts. */
  prefix: number;
  suffix: number;
  version: number;
  rarity: string;
  /** Index into the description lines of its main strength. */
  desc: number;
  boons: { trait: string; value: number }[];
  drawback?: { trait: string; value: number };
}

export interface TrainingState {
  /** Runs ready to launch. */
  charges: number;
  /** When the next run comes ready (0 = the queue is full). */
  nextChargeAt: number;
  /** The last run's candidates, waiting for a pick. */
  candidates: ModelCandidate[] | null;
}

export type StaffSplit = Record<StaffLane, number>;

export interface GarageNews {
  uid: number;
  key: string;
  kind: NewsKind;
  at: number;
  params?: Record<string, string | number>;
}

export interface OfflineReport {
  awayMs: number;
  creditedMs: number;
  tokens: number;
  doubled: boolean;
}

export interface GarageStats {
  taps: number;
  tokensAllTime: number;
  modelsShipped: number;
  bestCombo: number;
  goldenCaught: number;
  goldenMissed: number;
  incidentsFixed: number;
  incidentsSuffered: number;
  offlineReturns: number;
  offlineTokens: number;
  generatorsBought: number;
  upgradesBought: number;
  cratesOpened: number;
  boostsUsed: number;
  offersClaimed: number;
  /** Time with the garage open, ms. */
  playMs: number;
  /** Taps this generation while no generator was owned. */
  pureTaps: number;
  /** Upgrades bought this generation. */
  genUpgrades: number;
  /** Fastest incident fix, ms (0 = none yet). */
  fastestFixMs: number;
  /** Set once a model ships with no upgrade bought in its generation. */
  shippedClean: number;
  happeningsCaught: number;
  happeningsMissed: number;
  trainingRuns: number;
  modelsKept: number;
  autoBought: number;
}

export interface LastShip {
  generation: number;
  hypeGained: number;
  at: number;
  choice?: string;
}

export interface GarageState {
  version: number;
  rng: number;
  createdAt: number;
  /** Time the state was last advanced to. */
  now: number;
  tokens: number;
  /** Tokens earned in the current generation (drives shipping and Hype). */
  genLifetime: number;
  generators: Record<GeneratorId, number>;
  upgrades: UpgradeId[];
  generation: number;
  hype: number;
  labRep: number;
  combo: { count: number; lastAt: number };
  frenzy: FrenzyState | null;
  boostUntil: number;
  golden: GoldenState | null;
  nextGoldenAt: number;
  incident: IncidentState | null;
  nextIncidentAt: number;
  nextHeadlineAt: number;
  news: GarageNews[];
  /** Use times per offer within the last 24 hours. */
  offers: Record<OfferId, number[]>;
  offline: OfflineReport | null;
  achievements: string[];
  stats: GarageStats;
  lastShip: LastShip | null;
  uidSeq: number;
  /** Highest stage reached (index into content.stages). */
  stage: number;
  happening: HappeningState | null;
  nextHappeningAt: number;
  training: TrainingState;
  /** Kept models in their active slots. */
  models: ModelCandidate[];
  /** Headcount per lane (sum = staff.total). */
  staff: StaffSplit;
  /** The launch choice made at the last ship (its risk applies to this generation). */
  shipChoice: string | null;
  /** Auto-buy helper switched on (once unlocked). */
  autoBuy: boolean;
  nextAutoBuyAt: number;
}

export type GarageFailure = 'cantAfford' | 'locked' | 'owned' | 'unknownId' | 'notReady' | 'none' | 'cooldown' | 'dailyCap' | 'notApplicable' | 'full' | 'pending';

export interface ActionResult {
  state: GarageState;
  ok: boolean;
  reason?: GarageFailure;
  /** Tokens granted by the action (golden burst, crate, offline double), if any. */
  gained?: number;
}

export interface TapOutcome {
  state: GarageState;
  /** Tokens the tap produced. */
  gained: number;
  /** Combo count after the tap. */
  combo: number;
}
