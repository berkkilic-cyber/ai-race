/**
 * Content pack validation: zod schemas that mirror src/engine/types.ts, plus
 * integrity checks the type system cannot express (references, cycles, graph
 * connectivity, strings). `validatePack` returns human-readable problems;
 * an empty array means the pack is valid.
 */
import { z } from 'zod';

import { defaultBalance } from '@/engine/balance';
import { ENGINE_NEWS_KEYS } from '@/engine/news';
import { CHANNEL_FLAG_PREFIX } from '@/engine/channels';

import type {
  BarrierDef,
  ChannelDef,
  AchievementDef,
  Condition,
  ContentPack,
  Effect,
  EndingDef,
  EndingTrigger,
  EventDef,
  FounderDef,
  HeadlineDef,
  Modifier,
  MomentDef,
  NodeDef,
  RegionDef,
  RegionScope,
  RivalDef,
} from '@/engine/types';

// ───────────────────────────── Schemas ─────────────────────────────

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase kebab-case');
const key = z.string().min(1);
const unit = z.number().min(0).max(1);
const meterAmount = z.number().min(-100).max(100);
const duration = z.number().int().positive();

export const STATS = [
  'spreadRate',
  'seedChance',
  'cashIncome',
  'hypeIncome',
  'computeCapacity',
  'agiRate',
  'regulationGain',
  'backlashGain',
  'riskChance',
  'dataCentreCost',
  'dataCentreUpkeep',
  'launchCost',
  'nodeCost',
  'acquireCost',
  'banDuration',
] as const;
const TREES = ['capability', 'reach', 'shadow'] as const;
export const TRIGGERS = ['agi', 'dependence', 'monopoly', 'banned', 'revolt', 'rivalAgi'] as const;
const tree = z.enum(TREES);
const tone = z.enum(['good', 'bad', 'neutral']);
const resource = z.enum(['hype', 'cash']);
const meter = z.enum(['regulation', 'backlash']);
const target = z.enum(['self', 'rivals', 'leadRival', 'randomRival']).optional();

export const modifierSchema = z
  .strictObject({
    stat: z.enum(STATS),
    op: z.enum(['add', 'mul']),
    value: z.number(),
    regionTag: z.string().min(1).optional(),
  })
  .refine((m) => m.op !== 'mul' || (m.value > 0 && m.value <= 5), {
    message: "'mul' modifiers must be in (0, 5]",
  });

const scopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('home') }),
  z.strictObject({ kind: z.literal('region'), id }),
  z.strictObject({ kind: z.literal('tag'), tag: z.string().min(1) }),
  z.strictObject({ kind: z.literal('all') }),
  z.strictObject({ kind: z.literal('random'), count: z.number().int().min(1).max(40), tag: z.string().min(1).optional() }),
  z.strictObject({ kind: z.literal('top'), count: z.number().int().min(1).max(40) }),
]);

const effectSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('resource'),
    resource,
    amount: z.number().min(-10000).max(10000),
    target,
    scaleWithIncome: z.number().min(0).max(1000).optional(),
  }),
  z.strictObject({ type: z.literal('resourcePercent'), resource, percent: z.number().min(-100).max(1000), target }),
  z.strictObject({ type: z.literal('meter'), meter, amount: meterAmount, target }),
  z.strictObject({ type: z.literal('agiProgress'), amount: meterAmount, target }),
  z.strictObject({ type: z.literal('adoption'), scope: scopeSchema, factor: z.number().min(0).max(10), target, atMoment: z.boolean().optional() }),
  z.strictObject({
    type: z.literal('ban'),
    scope: scopeSchema,
    durationTicks: z.number().int().refine((d) => d === -1 || d > 0, 'ban duration must be -1 or > 0'),
    target,
  }),
  z.strictObject({ type: z.literal('unban'), scope: scopeSchema, target }),
  z.strictObject({ type: z.literal('timedModifier'), modifier: modifierSchema, durationTicks: duration, target }),
  z.strictObject({
    type: z.literal('dataCentre'),
    action: z.enum(['disable', 'destroy']),
    scope: scopeSchema,
    durationTicks: duration.optional(),
    target,
    atMoment: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal('compute'), amount: z.number().min(-1000).max(1000), target }),
  z.strictObject({ type: z.literal('setFlag'), flag: z.string().min(1), durationTicks: z.number().int().positive().max(100000).optional() }),
  z.strictObject({ type: z.literal('news'), textKey: key, tone: tone.optional() }),
]);

const tick = z.number().int().min(0);
const meterOrRival = z.enum(['regulation', 'backlash', 'rival']);
const labStat = z.enum([
  'nodesBought',
  'eventsResolved',
  'dataCentresBuilt',
  'peakWorldShare',
  'cashEarned',
  'hypeEarned',
  'momentsCollected',
  'momentsMissed',
]);
const conditionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('tickAtLeast'), value: tick }),
  z.strictObject({ type: z.literal('tickAtMost'), value: tick }),
  z.strictObject({ type: z.literal('hasNode'), nodeId: id }),
  z.strictObject({ type: z.literal('lacksNode'), nodeId: id }),
  z.strictObject({ type: z.literal('nodesInTreeAtLeast'), tree, value: z.number().int().min(0).max(100) }),
  z.strictObject({ type: z.literal('meterAtLeast'), meter: meterOrRival, value: z.number().min(0).max(100) }),
  z.strictObject({ type: z.literal('meterAtMost'), meter: meterOrRival, value: z.number().min(0).max(100) }),
  z.strictObject({ type: z.literal('agiAtLeast'), value: z.number().min(0).max(100) }),
  z.strictObject({ type: z.literal('worldShareAtLeast'), value: unit }),
  z.strictObject({ type: z.literal('worldShareAtMost'), value: unit }),
  z.strictObject({ type: z.literal('resourceAtLeast'), resource, value: z.number().min(0) }),
  z.strictObject({ type: z.literal('resourceAtMost'), resource, value: z.number().min(0) }),
  z.strictObject({ type: z.literal('dataCentresAtLeast'), value: z.number().int().min(0) }),
  z.strictObject({ type: z.literal('dataCentresAtMost'), value: z.number().int().min(0) }),
  z.strictObject({ type: z.literal('presentInRegion'), scope: scopeSchema }),
  z.strictObject({ type: z.literal('hasFlag'), flag: z.string().min(1) }),
  z.strictObject({ type: z.literal('lacksFlag'), flag: z.string().min(1) }),
  z.strictObject({ type: z.literal('founderIs'), founderId: id }),
  z.strictObject({ type: z.literal('labNameIs'), names: z.array(z.string().trim().min(1)).min(1) }),
  z.strictObject({ type: z.literal('endingIs'), endingId: id }),
  z.strictObject({ type: z.literal('bannedIn'), scope: scopeSchema }),
  z.strictObject({ type: z.literal('statAtLeast'), stat: labStat, value: z.number().min(0) }),
  z.strictObject({ type: z.literal('statAtMost'), stat: labStat, value: z.number().min(0) }),
  z.strictObject({ type: z.literal('endingKindIs'), kind: z.enum(['win', 'lose']) }),
]);

const regionSchema = z.strictObject({
  id,
  nameKey: key,
  countries: z.array(z.string().regex(/^\d{3}$/, 'country codes are 3-digit ISO 3166-1 numeric strings')).min(1),
  population: z.number().positive().max(2000),
  wealth: unit,
  openness: unit,
  strictness: unit,
  powerCost: unit,
  neighbors: z.array(id).min(1),
  tags: z.array(z.string().min(1)),
  barriers: z.array(z.string().min(1)).optional(),
  linkBarriers: z.record(z.string(), z.array(z.string().min(1))).optional(),
});

/** Barrier and channel ids: kebab-case, optionally "group:name" (e.g. "language:spanish"). */
const channelId = z.string().regex(/^[a-z0-9][a-z0-9-]*(:[a-z0-9][a-z0-9-]*)?$/, 'barrier and channel ids are kebab-case, optionally group:name');

const barrierSchema = z.strictObject({ id: channelId, nameKey: key });

const channelSchema = z.strictObject({
  id: channelId,
  nameKey: key,
  kind: z.enum(['clear', 'jump', 'open']),
  clears: z.array(channelId).optional(),
  entryTextKey: key.optional(),
});

const nodeSchema = z.strictObject({
  id,
  tree,
  nameKey: key,
  descKey: key,
  cost: z.number().positive().max(1000),
  cashCost: z.number().positive().max(5000).optional(),
  requires: z.array(id),
  row: z.number().int().min(1).max(5),
  col: z.number().int().min(1).max(3),
  modifiers: z.array(modifierSchema),
  onBuy: z.array(effectSchema).optional(),
  capabilityLevel: z.number().int().min(1).max(5).optional(),
  grantsFlags: z.array(z.string().min(1)).optional(),
  channels: z.array(channelId).optional(),
});

const costSchema = z.strictObject({ hype: z.number().min(0).optional(), cash: z.number().min(0).optional() });

const choiceSchema = z.strictObject({
  id,
  labelKey: key,
  resultKey: key.optional(),
  requirements: z.array(conditionSchema).optional(),
  cost: costSchema.optional(),
  effects: z.array(effectSchema),
  risk: z.strictObject({ chance: unit, effects: z.array(effectSchema).min(1), resultKey: key }).optional(),
});

const weight = z.number().positive().max(100);

const eventSchema = z.strictObject({
  id,
  titleKey: key,
  bodyKey: key,
  tone,
  weight,
  once: z.boolean(),
  conditions: z.array(conditionSchema),
  choices: z.array(choiceSchema).min(2, 'events need 2 or 3 choices').max(3, 'events need 2 or 3 choices'),
});

const headlineSchema = z.strictObject({
  id,
  textKey: key,
  tone,
  weight,
  about: z.enum(['player', 'rival', 'world']),
  conditions: z.array(conditionSchema),
  effects: z.array(effectSchema).optional(),
});

const founderSchema = z.strictObject({
  id,
  nameKey: key,
  descKey: key,
  startHype: z.number().min(0).max(1000),
  startCash: z.number().min(0).max(10000),
  modifiers: z.array(modifierSchema),
});

const rivalSchema = z.strictObject({
  id,
  nameKey: key,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'colour must be #RRGGBB'),
  homeRegion: id,
  personality: z.strictObject({
    capability: z.number().min(0).max(1),
    reach: z.number().min(0).max(1),
    shadow: z.number().min(0).max(1),
    expansion: unit,
  }),
  entryTick: tick,
});

const endingSchema = z.strictObject({
  id,
  kind: z.enum(['win', 'lose']),
  trigger: z.enum(TRIGGERS),
  titleKey: key,
  bodyKey: key,
  conditions: z.array(conditionSchema).optional(),
});

const achievementSchema = z.strictObject({
  id,
  nameKey: key,
  descKey: key,
  secret: z.boolean(),
  checkAt: z.enum(['tick', 'end']),
  conditions: z.array(conditionSchema).min(1),
});

/**
 * Icon ids a moment may use. The UI maps each to a drawing; a pack may use only these.
 * Adding one needs a drawing in the UI first.
 */
export const MOMENT_ICONS = [
  'megaphone',
  'star',
  'cash',
  'chip',
  'document',
  'gavel',
  'recruiter',
  'thermometer',
  'camera',
  'speech',
  'crowd',
  'trophy',
  'mortarboard',
  'heart',
  'bug',
  'bolt',
] as const;

const momentSchema = z.strictObject({
  id,
  kind: z.enum(['boost', 'threat']),
  nameKey: key,
  icon: z.string().min(1),
  weight,
  conditions: z.array(conditionSchema),
  lifetimeTicks: z.number().int().min(4).max(600),
  onCollect: z.array(effectSchema),
  onExpire: z.array(effectSchema).optional(),
  collectTextKey: key.optional(),
  expireTextKey: key.optional(),
});

const difficultySchema = z.strictObject({
  id,
  nameKey: key,
  descKey: key,
  balance: z.record(z.string(), z.number()),
  scoreMultiplier: z.number().positive().max(100),
});

const runLengthSchema = z.strictObject({
  id,
  nameKey: key,
  descKey: key,
  balance: z.record(z.string(), z.number()),
  scoreMultiplier: z.number().positive().max(100),
});

/** Run-length presets may set `pace`, between these (a sprint, never a crawl or a blur). */
export const RUN_LENGTH_PACE_RANGE = { min: 0.25, max: 6 } as const;

/** Each run length's `runLength.<id>.minutes` string: how long it lasts, shown beside its name. */
export function runLengthMinutesKey(id: string): string {
  return `runLength.${id}.minutes`;
}

/**
 * Balance keys a difficulty may not override: selectors the UI calls with only the pack
 * (getComputeRequired) read them, so they must be the same for every run of a pack.
 */
export const PACK_ONLY_BALANCE_KEYS: readonly string[] = ['computePerCapabilityLevel', 'capabilityComputeExponent'];

export const packSchema = z.strictObject({
  id,
  version: z.number().int().positive(),
  regions: z.array(regionSchema).min(1),
  nodes: z.array(nodeSchema).min(1),
  events: z.array(eventSchema),
  headlines: z.array(headlineSchema),
  founders: z.array(founderSchema).min(1),
  rivals: z.array(rivalSchema),
  endings: z.array(endingSchema).min(1),
  achievements: z.array(achievementSchema),
  moments: z.array(momentSchema),
  barriers: z.array(barrierSchema).optional(),
  channels: z.array(channelSchema).optional(),
  balance: z.record(z.string(), z.number()),
  difficulties: z.array(difficultySchema).optional(),
  defaultDifficulty: id.optional(),
  runLengths: z.array(runLengthSchema).optional(),
  defaultRunLength: id.optional(),
  strings: z.record(z.string(), z.record(z.string(), z.string())).refine((s) => Object.keys(s).length > 0, 'no locales'),
});

// Compile-time guard: the schemas must describe exactly the contract types.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type SchemaMatchesContract = [
  Assert<Same<z.infer<typeof modifierSchema>, Modifier>>,
  Assert<Same<z.infer<typeof scopeSchema>, RegionScope>>,
  Assert<Same<z.infer<typeof effectSchema>, Effect>>,
  Assert<Same<z.infer<typeof conditionSchema>, Condition>>,
  Assert<Same<z.infer<typeof regionSchema>, RegionDef>>,
  Assert<Same<z.infer<typeof nodeSchema>, NodeDef>>,
  Assert<Same<z.infer<typeof eventSchema>, EventDef>>,
  Assert<Same<z.infer<typeof headlineSchema>, HeadlineDef>>,
  Assert<Same<z.infer<typeof founderSchema>, FounderDef>>,
  Assert<Same<z.infer<typeof rivalSchema>, RivalDef>>,
  Assert<Same<z.infer<typeof endingSchema>, EndingDef>>,
  Assert<Same<z.infer<typeof achievementSchema>, AchievementDef>>,
  Assert<Same<z.infer<typeof momentSchema>, MomentDef>>,
  Assert<Same<z.infer<typeof barrierSchema>, BarrierDef>>,
  Assert<Same<z.infer<typeof channelSchema>, ChannelDef>>,
];

// ───────────────────────────── Text rules ─────────────────────────────

/**
 * Placeholders the UI knows how to fill. {achievement} is an achievement id (engine achievement news);
 * {model} is a node's name key (engine launch news), which the UI translates; {tier} a number.
 */
export const ALLOWED_PLACEHOLDERS = ['lab', 'rival', 'region', 'amount', 'achievement', 'model', 'tier', 'pct'];

/** Theme words the shared UI reads from every pack. */
export const REQUIRED_TERM_KEYS = [
  'term.hype',
  'term.cash',
  'term.compute',
  'term.capability',
  'term.regulation',
  'term.backlash',
  'term.rival',
  'term.rivals',
  'term.dataCentre',
  'term.tree.capability',
  'term.tree.reach',
  'term.tree.shadow',
  'term.users',
] as const;

/**
 * Plain-language phrases for every stat, for the UI to describe modifiers: `stat.<Stat>.gain` when
 * the stat goes up and `stat.<Stat>.loss` when it goes down, with {pct} the size of the change
 * ("Spreads {pct} faster").
 */
export const STAT_PHRASE_KEYS: readonly string[] = STATS.flatMap((stat) => [`stat.${stat}.gain`, `stat.${stat}.loss`]);

/** Keys every pack must define although no pack data references them: engine news, UI theme words and stat phrases. */
export const REQUIRED_KEYS: readonly string[] = [...Object.values(ENGINE_NEWS_KEYS), ...REQUIRED_TERM_KEYS, ...STAT_PHRASE_KEYS];

/**
 * Daily challenge and front page text (src/content/daily.ts): read by the UI from the pack's
 * daily content, checked key by key by `validateDaily`. These keys may also use
 * DAILY_PLACEHOLDERS ({event}, {choice}: an event card's title and the choice the player made).
 */
export const DAILY_KEY_PREFIXES: readonly string[] = ['daily.', 'front.', 'share.', 'pack.'];
export const DAILY_PLACEHOLDERS: readonly string[] = ['event', 'choice'];

/**
 * Prefixes of keys read by the engine or the UI rather than by pack data; never reported as unused.
 * `brand.<id>.name` / `brand.<id>.kind` define a pack's background parody brands once, so text and
 * tests can use the same names (validatePack checks each name has a kind and vice versa).
 */
const EXTERNAL_KEY_PREFIXES = ['term.', 'engine.news.', 'brand.', ...DAILY_KEY_PREFIXES];

/** Maximum length per kind of string key (by suffix / prefix). */
const LENGTH_LIMITS: { test: (k: string) => boolean; max: number; what: string }[] = [
  { test: (k) => k.startsWith('moment.') && k.endsWith('.name'), max: 27, what: 'moment name' },
  { test: (k) => k.startsWith('moment.'), max: 90, what: 'moment text' },
  { test: (k) => k.startsWith('headline.'), max: 90, what: 'headline' },
  { test: (k) => k.startsWith('difficulty.') && k.endsWith('.name'), max: 14, what: 'difficulty name' },
  { test: (k) => k.startsWith('difficulty.') && k.endsWith('.desc'), max: 60, what: 'difficulty description' },
  { test: (k) => k.startsWith('runLength.') && k.endsWith('.name'), max: 14, what: 'run length name' },
  { test: (k) => k.startsWith('runLength.') && k.endsWith('.desc'), max: 60, what: 'run length description' },
  { test: (k) => k.startsWith('runLength.') && k.endsWith('.minutes'), max: 12, what: 'run length minutes' },
  { test: (k) => k.startsWith('event.') && k.endsWith('.title'), max: 50, what: 'event title' },
  { test: (k) => k.startsWith('event.') && k.endsWith('.body'), max: 220, what: 'event body' },
  { test: (k) => k.endsWith('.label'), max: 40, what: 'choice label' },
  { test: (k) => k.startsWith('ending.') && k.endsWith('.title'), max: 50, what: 'ending title' },
  { test: (k) => k.endsWith('.result') || k.endsWith('.risk'), max: 120, what: 'result text' },
  { test: (k) => k.endsWith('.name'), max: 40, what: 'name' },
  { test: (k) => k.endsWith('.desc'), max: 140, what: 'description' },
  { test: (k) => k.startsWith('ending.') && k.endsWith('.body'), max: 260, what: 'ending body' },
];

// ───────────────────────────── Integrity ─────────────────────────────

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const i of ids) (seen.has(i) ? dup : seen).add(i);
  return [...dup];
}

function formatPath(path: readonly PropertyKey[], pack: unknown): string {
  // Replace array indexes with the item's id where possible: "events[sandbox].choices[1]".
  let node: unknown = pack;
  let out = '';
  for (const p of path) {
    const next = node && typeof node === 'object' ? (node as Record<PropertyKey, unknown>)[p] : undefined;
    if (typeof p === 'number') {
      const itemId = next && typeof next === 'object' ? (next as { id?: unknown }).id : undefined;
      out += typeof itemId === 'string' ? `[${itemId}]` : `[${p}]`;
    } else {
      out += out ? `.${String(p)}` : String(p);
    }
    node = next;
  }
  return out || '(pack)';
}

/** Validates a content pack. Returns a list of problems; empty means valid. */
export function validatePack(pack: unknown): string[] {
  const parsed = packSchema.safeParse(pack);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${formatPath(i.path, pack)}: ${i.message}`);
  }
  return checkIntegrity(pack as ContentPack);
}

function checkIntegrity(pack: ContentPack): string[] {
  const problems: string[] = [];
  const err = (msg: string) => problems.push(msg);

  // Balance overrides must name real BalanceConfig numbers.
  const checkBalance = (where: string, balance: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(balance)) {
      if (!(k in defaultBalance)) err(`${where}: unknown key "${k}"`);
      else if (typeof defaultBalance[k as keyof typeof defaultBalance] !== 'number') err(`${where}: "${k}" is not a number setting`);
      else if (!Number.isFinite(v) || (v as number) < 0) err(`${where}: "${k}" must be a finite number >= 0`);
    }
  };
  checkBalance('balance', pack.balance);

  // Difficulties: real balance keys (not the pack-only ones), a known default.
  const difficulties = pack.difficulties ?? [];
  for (const d of difficulties) {
    checkBalance(`difficulties[${d.id}].balance`, d.balance);
    for (const k of PACK_ONLY_BALANCE_KEYS) if (k in d.balance) err(`difficulties[${d.id}].balance: "${k}" can only be set in the pack's balance`);
  }
  if (pack.defaultDifficulty !== undefined && !difficulties.some((d) => d.id === pack.defaultDifficulty)) {
    err(`defaultDifficulty: "${pack.defaultDifficulty}" is not one of the pack's difficulties`);
  }
  if (difficulties.length > 0 && pack.defaultDifficulty === undefined) err('defaultDifficulty: required when the pack has difficulties');
  // `pace` (how much game a tick holds) belongs to run lengths only, so a difficulty never changes the clock.
  if ('pace' in pack.balance) err('balance: "pace" can only be set by a run length');
  for (const d of difficulties) if ('pace' in d.balance) err(`difficulties[${d.id}].balance: "pace" can only be set by a run length`);

  // Run lengths: real balance keys (not the pack-only ones), a pace in range, a known default.
  const runLengths = pack.runLengths ?? [];
  for (const r of runLengths) {
    checkBalance(`runLengths[${r.id}].balance`, r.balance);
    for (const k of PACK_ONLY_BALANCE_KEYS) if (k in r.balance) err(`runLengths[${r.id}].balance: "${k}" can only be set in the pack's balance`);
    const pace = r.balance.pace;
    if (pace !== undefined && !(pace >= RUN_LENGTH_PACE_RANGE.min && pace <= RUN_LENGTH_PACE_RANGE.max)) {
      err(`runLengths[${r.id}].balance: "pace" must be between ${RUN_LENGTH_PACE_RANGE.min} and ${RUN_LENGTH_PACE_RANGE.max}`);
    }
  }
  if (pack.defaultRunLength !== undefined && !runLengths.some((r) => r.id === pack.defaultRunLength)) {
    err(`defaultRunLength: "${pack.defaultRunLength}" is not one of the pack's run lengths`);
  }
  if (runLengths.length > 0 && pack.defaultRunLength === undefined) err('defaultRunLength: required when the pack has run lengths');

  // Unique ids
  const collections: [string, { id: string }[]][] = [
    ['regions', pack.regions],
    ['nodes', pack.nodes],
    ['events', pack.events],
    ['headlines', pack.headlines],
    ['founders', pack.founders],
    ['rivals', pack.rivals],
    ['endings', pack.endings],
    ['achievements', pack.achievements],
    ['moments', pack.moments],
    ['barriers', pack.barriers ?? []],
    ['channels', pack.channels ?? []],
    ['difficulties', pack.difficulties ?? []],
    ['runLengths', pack.runLengths ?? []],
  ];
  for (const [name, list] of collections) {
    for (const d of duplicates(list.map((x) => x.id))) err(`${name}: duplicate id "${d}"`);
  }
  for (const e of pack.events) {
    for (const d of duplicates(e.choices.map((c) => c.id))) err(`events[${e.id}]: duplicate choice id "${d}"`);
  }

  const regionIds = new Set(pack.regions.map((r) => r.id));
  const nodeById = new Map(pack.nodes.map((n) => [n.id, n]));
  const founderIds = new Set(pack.founders.map((f) => f.id));
  const endingIds = new Set(pack.endings.map((e) => e.id));
  const allTags = new Set(pack.regions.flatMap((r) => r.tags));

  // References inside scopes, conditions, effects and modifiers
  const checkTag = (tag: string | undefined, where: string) => {
    if (tag !== undefined && !allTags.has(tag)) err(`${where}: tag "${tag}" is not used by any region`);
  };
  const checkScope = (s: RegionScope, where: string) => {
    if (s.kind === 'region' && !regionIds.has(s.id)) err(`${where}: unknown region "${s.id}"`);
    if (s.kind === 'tag' || s.kind === 'random') checkTag(s.tag, where);
  };
  const checkModifier = (m: Modifier, where: string) => checkTag(m.regionTag, where);
  const checkCondition = (c: Condition, where: string) => {
    if ((c.type === 'hasNode' || c.type === 'lacksNode') && !nodeById.has(c.nodeId)) {
      err(`${where}: unknown node "${c.nodeId}"`);
    }
    if (c.type === 'founderIs' && !founderIds.has(c.founderId)) err(`${where}: unknown founder "${c.founderId}"`);
    if (c.type === 'endingIs' && !endingIds.has(c.endingId)) err(`${where}: unknown ending "${c.endingId}"`);
    if (c.type === 'presentInRegion' || c.type === 'bannedIn') checkScope(c.scope, where);
  };
  const checkEffect = (e: Effect, where: string, inMoment = false) => {
    if ('scope' in e) checkScope(e.scope, where);
    if ('atMoment' in e && e.atMoment && !inMoment) err(`${where}: atMoment only works in a moment's effects`);
    if (e.type === 'timedModifier') checkModifier(e.modifier, where);
  };
  const conds = (list: Condition[] | undefined, where: string) => list?.forEach((c) => checkCondition(c, where));
  const effs = (list: Effect[] | undefined, where: string, inMoment = false) => list?.forEach((e) => checkEffect(e, where, inMoment));

  for (const n of pack.nodes) {
    const w = `nodes[${n.id}]`;
    n.modifiers.forEach((m) => checkModifier(m, w));
    effs(n.onBuy, w);
    for (const r of n.requires) {
      const req = nodeById.get(r);
      if (!req) err(`${w}: requires unknown node "${r}"`);
      else if (req.row >= n.row) err(`${w}: requires "${r}" which is not in an earlier row`);
    }
    if (n.capabilityLevel !== undefined && n.tree !== 'capability') err(`${w}: capabilityLevel on a non-capability node`);
  }
  for (const e of pack.events) {
    const w = `events[${e.id}]`;
    conds(e.conditions, w);
    for (const c of e.choices) {
      const cw = `${w}.choices[${c.id}]`;
      conds(c.requirements, cw);
      effs(c.effects, cw);
      effs(c.risk?.effects, `${cw}.risk`);
    }
  }
  for (const h of pack.headlines) {
    conds(h.conditions, `headlines[${h.id}]`);
    effs(h.effects, `headlines[${h.id}]`);
  }
  for (const f of pack.founders) f.modifiers.forEach((m) => checkModifier(m, `founders[${f.id}]`));
  for (const e of pack.endings) conds(e.conditions, `endings[${e.id}]`);
  for (const a of pack.achievements) conds(a.conditions, `achievements[${a.id}]`);
  const icons: readonly string[] = MOMENT_ICONS;
  for (const m of pack.moments) {
    const w = `moments[${m.id}]`;
    conds(m.conditions, w);
    effs(m.onCollect, `${w}.onCollect`, true);
    effs(m.onExpire, `${w}.onExpire`, true);
    if (!icons.includes(m.icon)) err(`${w}: unknown icon "${m.icon}" (allowed: ${MOMENT_ICONS.join(', ')})`);
    if (m.kind === 'boost' && m.onCollect.length === 0) err(`${w}: a boost needs at least one onCollect effect`);
    if (m.kind === 'boost' && m.expireTextKey !== undefined) err(`${w}: boosts add no news when they expire; drop expireTextKey`);
    if (m.kind === 'threat' && (m.onExpire ?? []).length === 0) err(`${w}: a threat needs at least one onExpire effect`);
    if (m.kind === 'threat' && m.expireTextKey === undefined) err(`${w}: a threat needs an expireTextKey for its news item`);
    if ([...m.onCollect, ...(m.onExpire ?? [])].some((e) => e.type === 'news')) err(`${w}: moments must not add news effects (they would flood the log)`);
  }
  for (const r of pack.rivals) {
    if (!regionIds.has(r.homeRegion)) err(`rivals[${r.id}]: unknown home region "${r.homeRegion}"`);
  }
  for (const d of duplicates(pack.rivals.map((r) => r.color.toUpperCase()))) err(`rivals: colour ${d} used twice`);

  // Node layout: one node per tree cell, and no prerequisite cycles
  for (const d of duplicates(pack.nodes.map((n) => `${n.tree} row ${n.row} col ${n.col}`))) {
    err(`nodes: two nodes share ${d}`);
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (nid: string, trail: string[]): void => {
    const s = state.get(nid);
    if (s === 'done') return;
    if (s === 'visiting') {
      err(`nodes: requires cycle ${[...trail.slice(trail.indexOf(nid)), nid].join(' -> ')}`);
      return;
    }
    state.set(nid, 'visiting');
    for (const r of nodeById.get(nid)?.requires ?? []) if (nodeById.has(r)) visit(r, [...trail, nid]);
    state.set(nid, 'done');
  };
  for (const n of pack.nodes) visit(n.id, []);

  // Region graph: known, symmetric, no self links, connected; countries unique
  const regionById = new Map(pack.regions.map((r) => [r.id, r]));
  for (const r of pack.regions) {
    for (const nb of r.neighbors) {
      if (nb === r.id) err(`regions[${r.id}]: lists itself as a neighbour`);
      else if (!regionById.has(nb)) err(`regions[${r.id}]: unknown neighbour "${nb}"`);
      else if (!regionById.get(nb)!.neighbors.includes(r.id)) {
        err(`regions[${r.id}]: neighbour "${nb}" does not list it back`);
      }
    }
    for (const d of duplicates(r.neighbors)) err(`regions[${r.id}]: neighbour "${d}" listed twice`);
  }
  if (pack.regions.length > 0) {
    const seen = new Set<string>([pack.regions[0].id]);
    const queue = [pack.regions[0].id];
    while (queue.length > 0) {
      for (const nb of regionById.get(queue.shift()!)?.neighbors ?? []) {
        if (regionById.has(nb) && !seen.has(nb)) {
          seen.add(nb);
          queue.push(nb);
        }
      }
    }
    const cut = pack.regions.filter((r) => !seen.has(r.id)).map((r) => r.id);
    if (cut.length > 0) err(`regions: graph is not connected; unreachable: ${cut.join(', ')}`);
  }
  // Barriers and channels: known ids, symmetric links, channel flags name real channels
  const barrierIds = new Set((pack.barriers ?? []).map((b) => b.id));
  const channelIds = new Set((pack.channels ?? []).map((c) => c.id));
  if (barrierIds.size > 31) err(`barriers: at most 31 barriers (has ${barrierIds.size})`);
  for (const r of pack.regions) {
    for (const b of r.barriers ?? []) if (!barrierIds.has(b)) err(`regions[${r.id}]: unknown barrier "${b}"`);
    for (const [nb, list] of Object.entries(r.linkBarriers ?? {})) {
      if (!r.neighbors.includes(nb)) err(`regions[${r.id}]: linkBarriers for "${nb}", which is not a neighbour`);
      for (const b of list) if (!barrierIds.has(b)) err(`regions[${r.id}]: unknown barrier "${b}" on the link to "${nb}"`);
      const back = regionById.get(nb)?.linkBarriers?.[r.id] ?? [];
      if (list.some((b) => !back.includes(b)) || back.some((b) => !list.includes(b))) {
        err(`regions[${r.id}]: link barriers to "${nb}" are not listed the same way back`);
      }
    }
  }
  for (const c of pack.channels ?? []) {
    if (c.kind !== 'clear' && c.clears !== undefined) err(`channels[${c.id}]: only 'clear' channels have clears`);
    for (const b of c.kind === 'clear' ? (c.clears ?? [c.id]) : []) if (!barrierIds.has(b)) err(`channels[${c.id}]: clears unknown barrier "${b}"`);
  }
  for (const n of pack.nodes) for (const c of n.channels ?? []) if (!channelIds.has(c)) err(`nodes[${n.id}]: unknown channel "${c}"`);
  const flagEffects: [Effect, string][] = [
    ...pack.nodes.flatMap((n) => (n.onBuy ?? []).map((e): [Effect, string] => [e, `nodes[${n.id}]`])),
    ...pack.events.flatMap((ev) =>
      ev.choices.flatMap((c) => [...c.effects, ...(c.risk?.effects ?? [])].map((e): [Effect, string] => [e, `events[${ev.id}].${c.id}`])),
    ),
    ...pack.headlines.flatMap((h) => (h.effects ?? []).map((e): [Effect, string] => [e, `headlines[${h.id}]`])),
    ...pack.moments.flatMap((m) => [...m.onCollect, ...(m.onExpire ?? [])].map((e): [Effect, string] => [e, `moments[${m.id}]`])),
  ];
  for (const [e, where] of flagEffects) {
    if (e.type === 'setFlag' && e.flag.startsWith(CHANNEL_FLAG_PREFIX) && !channelIds.has(e.flag.slice(CHANNEL_FLAG_PREFIX.length))) {
      err(`${where}: flag "${e.flag}" names an unknown channel`);
    }
  }
  const countryOwner = new Map<string, string>();
  for (const r of pack.regions) {
    for (const c of r.countries) {
      const owner = countryOwner.get(c);
      if (owner !== undefined) err(`regions[${r.id}]: country ${c} already belongs to "${owner}"`);
      else countryOwner.set(c, r.id);
    }
  }

  // Endings: every trigger has a default (no conditions), listed after its variants
  for (const trigger of TRIGGERS as readonly EndingTrigger[]) {
    const list = pack.endings.filter((e) => e.trigger === trigger);
    const defaultIndex = list.findIndex((e) => !e.conditions || e.conditions.length === 0);
    if (defaultIndex === -1) err(`endings: trigger "${trigger}" has no default ending (one without conditions)`);
    else if (defaultIndex !== list.length - 1) {
      err(`endings: default for "${trigger}" must come after its variants, or they can never be chosen`);
    }
  }

  // Strings: every referenced key exists in every locale; no unused keys; placeholders; lengths
  const used = new Set<string>();
  const markKey = (k: string | undefined) => {
    if (k !== undefined) used.add(k);
  };
  const markEffectKeys = (list: Effect[] | undefined) => list?.forEach((e) => e.type === 'news' && markKey(e.textKey));
  for (const r of pack.regions) markKey(r.nameKey);
  for (const n of pack.nodes) {
    markKey(n.nameKey);
    markKey(n.descKey);
    markEffectKeys(n.onBuy);
  }
  for (const e of pack.events) {
    markKey(e.titleKey);
    markKey(e.bodyKey);
    for (const c of e.choices) {
      markKey(c.labelKey);
      markKey(c.resultKey);
      markEffectKeys(c.effects);
      markKey(c.risk?.resultKey);
      markEffectKeys(c.risk?.effects);
    }
  }
  for (const h of pack.headlines) {
    markKey(h.textKey);
    markEffectKeys(h.effects);
  }
  for (const f of pack.founders) {
    markKey(f.nameKey);
    markKey(f.descKey);
  }
  for (const r of pack.rivals) markKey(r.nameKey);
  for (const e of pack.endings) {
    markKey(e.titleKey);
    markKey(e.bodyKey);
  }
  for (const a of pack.achievements) {
    markKey(a.nameKey);
    markKey(a.descKey);
  }
  for (const m of pack.moments) {
    markKey(m.nameKey);
    markKey(m.collectTextKey);
    markKey(m.expireTextKey);
  }
  for (const b of pack.barriers ?? []) {
    markKey(b.nameKey);
    // Optional mid-sentence form of the name ("the ocean"), read by the UI when present.
    const inline = b.nameKey.replace(/\.name$/, '.inline');
    if (inline !== b.nameKey) for (const table of Object.values(pack.strings)) if (inline in table) used.add(inline);
  }
  for (const c of pack.channels ?? []) {
    markKey(c.nameKey);
    markKey(c.entryTextKey);
  }
  for (const d of pack.difficulties ?? []) {
    markKey(d.nameKey);
    markKey(d.descKey);
  }
  for (const r of pack.runLengths ?? []) {
    markKey(r.nameKey);
    markKey(r.descKey);
    markKey(runLengthMinutesKey(r.id));
  }

  for (const k of REQUIRED_KEYS) used.add(k);

  // The first locale is the base (complete). Other locales may lack keys (the UI falls back
  // to the base) but may not add keys or placeholders the base text lacks.
  const [baseLocale, baseTable] = Object.entries(pack.strings)[0] ?? ['', {}];
  const placeholderSet = (text: string) => [...new Set([...text.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]))].sort().join(',');
  for (const [locale, table] of Object.entries(pack.strings)) {
    const isBase = locale === baseLocale;
    if (!isBase) {
      for (const [k, text] of Object.entries(table)) {
        if (!(k in baseTable)) err(`strings.${locale}: "${k}" is not in ${baseLocale}`);
        else {
          // A placeholder the base text lacks would reach the screen raw. (One the translation
          // drops is a stale translation: the Jest locale test and `npm run i18n:check` report it.)
          const base = placeholderSet(baseTable[k]).split(',');
          const extra = placeholderSet(text).split(',').filter((p) => p && !base.includes(p));
          if (extra.length) err(`strings.${locale}: "${k}" uses placeholders not in ${baseLocale}: {${extra.join('}, {')}}`);
        }
      }
    }
    for (const k of Object.keys(table)) {
      const brand = /^brand\.([a-z0-9-]+)\.(name|kind)$/.exec(k);
      if (k.startsWith('brand.') && !brand) err(`strings.${locale}: brand keys are brand.<id>.name or brand.<id>.kind, not "${k}"`);
      else if (brand && !(`brand.${brand[1]}.${brand[2] === 'name' ? 'kind' : 'name'}` in table)) {
        err(`strings.${locale}: "${k}" has no matching brand.${brand[1]}.${brand[2] === 'name' ? 'kind' : 'name'}`);
      }
    }
    if (isBase) for (const k of used) if (!(k in table)) err(`strings.${locale}: missing key "${k}"`);
    for (const [k, text] of Object.entries(table)) {
      if (!used.has(k) && !EXTERNAL_KEY_PREFIXES.some((prefix) => k.startsWith(prefix))) err(`strings.${locale}: unused key "${k}"`);
      if (text.trim() === '') err(`strings.${locale}: "${k}" is empty`);
      for (const m of text.matchAll(/\{([^}]*)\}/g)) {
        const dailyKey = DAILY_KEY_PREFIXES.some((prefix) => k.startsWith(prefix));
        if (!ALLOWED_PLACEHOLDERS.includes(m[1]) && !(dailyKey && DAILY_PLACEHOLDERS.includes(m[1]))) err(`strings.${locale}: "${k}" uses unknown placeholder {${m[1]}}`);
      }
      const limit = LENGTH_LIMITS.find((l) => l.test(k));
      if (limit && text.length > limit.max) {
        err(`strings.${locale}: ${limit.what} "${k}" is ${text.length} chars (max ${limit.max})`);
      }
    }
  }

  return problems;
}
