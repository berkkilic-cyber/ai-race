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
  | { type: 'upgrade'; id: UpgradeId };

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
  | 'offersClaimed';

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

export interface GarageContent {
  id: string;
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

export type NewsKind = 'headline' | 'launch' | 'golden' | 'incident' | 'fixed' | 'achievement';

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
}

export interface LastShip {
  generation: number;
  hypeGained: number;
  at: number;
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
}

export type GarageFailure = 'cantAfford' | 'locked' | 'owned' | 'unknownId' | 'notReady' | 'none' | 'cooldown' | 'dailyCap' | 'notApplicable';

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
