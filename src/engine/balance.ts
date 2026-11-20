/**
 * Every tunable number of the simulation. A content pack's `balance` is a
 * partial override shallow-merged over `defaultBalance`.
 *
 * Modifier convention: every `Stat` is a multiplier with base 1. `add` modifiers
 * sum into the base ((1 + Σadd) × Πmul), so `add 0.2` and `mul 1.2` are equal alone.
 */
export interface BalanceConfig {
  // ── Start ──
  /** Adoption a lab starts with in its home region (fraction of population). */
  startAdoption: number;
  /** Hype an AI rival starts with. */
  rivalStartHype: number;
  /** Cash an AI rival starts with (millions). */
  rivalStartCash: number;

  // ── Spread ──
  /** Base logistic growth rate of adoption per tick. */
  baseSpread: number;
  /** Appeal bonus per effective capability level. */
  appealPerCapability: number;
  /** Appeal is multiplied by (1 − backlash / this). */
  backlashAppealDivisor: number;
  /** Rate at which a more appealing lab takes share from a less appealing one when a region is full. */
  stealRate: number;
  /** Free share below which stealing happens. */
  stealFreeThreshold: number;
  /** Adoption a region needs before it seeds its neighbours. */
  seedThreshold: number;
  /** Base per-tick chance to seed one absent neighbour (× openness × seedChance stat). */
  seedChance: number;
  /** Adoption a seeded region starts at. */
  seedAmount: number;
  /** Adoption a paid launch starts at. */
  launchAdoption: number;
  /** Fraction of adoption lost per tick in a banned region. */
  banDecayRate: number;
  /** Fraction of adoption lost per tick by an eliminated lab. */
  eliminatedDecayRate: number;
  /** Adoption below this is removed (lab no longer present). */
  minAdoption: number;

  // ── Compute and capability ──
  /** Compute per data centre level. */
  computePerLevel: number;
  /** Compute needed for capability level 1. */
  computePerCapabilityLevel: number;
  /** Level L needs computePerCapabilityLevel × L^this compute (1 = linear). */
  capabilityComputeExponent: number;

  // ── Data centres ──
  /** Cash cost of a lab's first data centre. */
  dataCentreBaseCost: number;
  /** Each data centre already owned raises the build cost by this fraction of the base. */
  dataCentreCountGrowth: number;
  /** Upgrade cost per current level. */
  dataCentreUpgradeCost: number;
  /** Each data centre level already owned (all sites) raises upgrade costs by this fraction. */
  dataCentreUpgradeGrowth: number;
  /** Highest data centre level. */
  maxDataCentreLevel: number;
  /** Data centres one lab may own in a region. */
  maxDataCentresPerRegion: number;
  /** Upkeep per level per tick, × region powerCost × dataCentreUpkeep stat. */
  dataCentreUpkeep: number;
  /** Ticks a data centre stays offline when its upkeep cannot be paid. */
  unpaidOfflineTicks: number;
  /** Offline duration for a 'disable' effect without durationTicks. */
  defaultDisableTicks: number;

  // ── Launch ──
  /** Fixed part of the launch cost. */
  launchBaseCost: number;
  /** Launch cost per million population, × (0.5 + wealth). */
  launchCostPerMillion: number;

  // ── Income ──
  /** Cash per million users per tick, × region wealth. */
  cashPerUser: number;
  /** Cash every active lab earns per tick regardless of users (× cashIncome stat). */
  cashBase: number;
  /** Hype every active lab earns per tick. */
  hypeBase: number;
  /** Hype per million new users this tick. */
  hypePerNewUser: number;

  // ── AGI ──
  /** AGI progress per tick at capability 1 with no compute. */
  agiBase: number;
  /** Exponent applied to capability. */
  agiExponent: number;
  /** AGI speed-up per unit of compute. */
  agiComputeFactor: number;
  /** AI labs' AGI progress per tick is multiplied by this (difficulty; 1 = same rules as the player). */
  aiAgiFactor: number;
  /** AGI speed-up is (1 + agiComputeFactor × compute^this); below 1 gives diminishing returns. */
  agiComputeExponent: number;

  // ── Meters ──
  /** Regulation per million new users, × region strictness. */
  regulationPerGrowth: number;
  /** Regulation per tick at 100% world share. */
  regulationPerShare: number;
  /** Regulation lost per tick. */
  regulationDecay: number;
  /** Backlash per tick per capability level at 100% world share. */
  backlashPerCapability: number;
  /** Backlash per tick per data centre level. */
  backlashPerDataCentreLevel: number;
  /** Backlash lost per tick. */
  backlashDecay: number;
  /** Extra regulation lost per tick by AI labs (they get no event cards to relieve it). */
  aiRegulationDecay: number;
  /** Extra backlash lost per tick by AI labs. */
  aiBacklashDecay: number;
  /** AI labs' per-tick regulation and backlash gains are multiplied by this (1 = same as the player). */
  aiMeterGainFactor: number;

  // ── Bans ──
  /** Regulation thresholds that trigger bans (ascending). */
  banThresholds: number[];
  /** The n-th threshold bans n × this many of the strictest regions where the lab is present. */
  banRegionsPerThreshold: number;
  /** Ticks a threshold ban lasts (× banDuration stat). */
  banDuration: number;
  /** Regulation must fall this far below a threshold before it can trigger again. */
  banResetMargin: number;

  // ── Acquisition ──
  /** Fixed part of the price of a rival. */
  acquireBaseCost: number;
  /** Price per million users of the target. */
  acquirePerUser: number;
  /** Price per unit of the target's compute. */
  acquirePerCompute: number;
  /** Price per point of the target's AGI progress. */
  acquirePerAgi: number;
  /** Share of the target's adoption the buyer takes over. */
  acquireAdoptionShare: number;

  // ── Nodes ──
  /** Each node already owned raises the price of the next by this fraction. */
  nodeCostGrowth: number;

  // ── Pacing ──
  /** AI labs decide every this many ticks. */
  aiDecisionInterval: number;
  /** Most actions an AI lab takes per decision. */
  aiActionsPerDecision: number;
  /** AI keeps this many ticks of upkeep as cash reserve. */
  aiCashReserveTicks: number;
  /** Tick of the first event card. */
  firstEventTick: number;
  /** Minimum ticks between a resolved event and the next one. */
  eventIntervalMin: number;
  /** Maximum ticks between a resolved event and the next one. */
  eventIntervalMax: number;
  /** Retry delay when no event is eligible. */
  eventRetryTicks: number;
  /** Minimum ticks between headlines. */
  headlineIntervalMin: number;
  /** Maximum ticks between headlines. */
  headlineIntervalMax: number;
  /** Most news items kept in state.news. */
  newsLogSize: number;

  // ── Endings and score ──
  /** World share that triggers the dependence ending. */
  dependenceShare: number;
  /** Score bonus for a win. */
  scoreWin: number;
  /** Score per percentage point of peak world share. */
  scorePerSharePoint: number;
  /** Score per point of AGI progress. */
  scorePerAgi: number;
  /** Score per node bought. */
  scorePerNode: number;
  /** Wins before this tick get a speed bonus. */
  scoreTargetTicks: number;
  /** Speed bonus per tick a win comes before scoreTargetTicks. */
  scorePerTickSaved: number;
}

export const defaultBalance: BalanceConfig = {
  startAdoption: 0.01,
  rivalStartHype: 15,
  rivalStartCash: 150,

  baseSpread: 0.003,
  appealPerCapability: 0.25,
  backlashAppealDivisor: 200,
  stealRate: 0.004,
  stealFreeThreshold: 0.05,
  seedThreshold: 0.15,
  seedChance: 0.003,
  seedAmount: 0.004,
  launchAdoption: 0.01,
  banDecayRate: 0.02,
  eliminatedDecayRate: 0.2,
  minAdoption: 0.0001,

  computePerLevel: 10,
  computePerCapabilityLevel: 10,
  capabilityComputeExponent: 1.3,

  dataCentreBaseCost: 50,
  dataCentreCountGrowth: 0.4,
  dataCentreUpgradeCost: 35,
  dataCentreUpgradeGrowth: 0,
  maxDataCentreLevel: 5,
  maxDataCentresPerRegion: 2,
  dataCentreUpkeep: 0.06,
  unpaidOfflineTicks: 30,
  defaultDisableTicks: 60,

  launchBaseCost: 15,
  launchCostPerMillion: 0.08,

  cashPerUser: 0.012,
  cashBase: 0,
  hypeBase: 0.06,
  hypePerNewUser: 0.3,

  agiBase: 0.003,
  agiExponent: 1.5,
  agiComputeFactor: 0.01,
  agiComputeExponent: 1,
  aiAgiFactor: 1,

  regulationPerGrowth: 0.03,
  regulationPerShare: 0.2,
  regulationDecay: 0.01,
  backlashPerCapability: 0.06,
  backlashPerDataCentreLevel: 0.002,
  backlashDecay: 0.01,
  aiRegulationDecay: 0,
  aiBacklashDecay: 0.01,
  aiMeterGainFactor: 0.6,

  banThresholds: [25, 50, 75],
  banRegionsPerThreshold: 1,
  banDuration: 200,
  banResetMargin: 10,

  acquireBaseCost: 1000,
  acquirePerUser: 3,
  acquirePerCompute: 8,
  acquirePerAgi: 15,
  acquireAdoptionShare: 0.6,

  nodeCostGrowth: 0,

  aiDecisionInterval: 10,
  aiActionsPerDecision: 3,
  aiCashReserveTicks: 40,
  firstEventTick: 60,
  eventIntervalMin: 100,
  eventIntervalMax: 160,
  eventRetryTicks: 20,
  headlineIntervalMin: 25,
  headlineIntervalMax: 50,
  newsLogSize: 50,

  dependenceShare: 0.5,
  scoreWin: 1000,
  scorePerSharePoint: 10,
  scorePerAgi: 5,
  scorePerNode: 10,
  scoreTargetTicks: 3600,
  scorePerTickSaved: 0.5,
};

/** Defaults with the pack's overrides applied. */
export function mergeBalance(overrides: Partial<BalanceConfig>): BalanceConfig {
  return { ...defaultBalance, ...overrides };
}
