/**
 * The idle economy ("Garage"): pure, deterministic TypeScript like src/engine, importing
 * nothing outside src/idle. See docs/GARAGE.md.
 */
export * from './types';
export {
  DAY_MS,
  GARAGE_VERSION,
  advance,
  buy,
  buyMax,
  buyUpgrade,
  canAfford,
  claimOffer,
  collectGolden,
  costOf,
  crateValue,
  createGarage,
  dismissOffline,
  emptyStats,
  generationName,
  hypeForLifetime,
  isGeneratorUnlocked,
  isUpgradeAvailable,
  offerStatus,
  offlineCapMs,
  offlineEarnings,
  prestige,
  prestigePreview,
  requirementMet,
  requirementProgress,
  shipThreshold,
  tap,
  tapIncident,
  type OfferStatus,
  type PrestigePreview,
} from './garage';
export {
  HOUR_MS,
  activeEffects,
  baseRate,
  bulkCost,
  comboAt,
  comboMultiplier,
  generatorDef,
  generatorRate,
  hypeMultiplier,
  incidentDef,
  maxAffordable,
  multipliers,
  offerDef,
  tapValue,
  timedMultiplier,
  totalRate,
  unitCost,
  upgradeDef,
  type Multipliers,
} from './rates';
export { availableUpgrades, buyQuote, generatorRows, labPerks, nextLabPerk, nextUnlocks, type GeneratorRow, type UpcomingUpgrade } from './selectors';
export { MAX_AMOUNT, amount, finite, formatAmount, formatDuration } from './num';
export { deserialize, migrateV1, sanitize, serialize, type LoadResult } from './save';
export { validateGarage } from './validate';
export { nextRandom, seedFrom } from './rng';
