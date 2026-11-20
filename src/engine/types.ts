/**
 * ENGINE CONTRACT. This file is the shared interface between the engine
 * (src/engine), the content packs (src/content) and the UI (src/ui, app).
 * Change it only through the orchestrator: other tasks are built against it.
 *
 * Rules:
 * - Everything here is plain JSON-serialisable data (no classes, functions, Map/Set, Date).
 * - The engine is theme-agnostic. All names, numbers and text live in a ContentPack.
 * - Every lab (human or AI) uses the same LabState and the same Actions, so an AI
 *   rival can later be replaced by a human player without changing the engine.
 */
import type { BalanceConfig } from './balance';

export type RegionId = string;
export type LabId = string;
export type NodeId = string;
export type EventId = string;
export type TreeId = 'capability' | 'reach' | 'shadow';
export type MeterId = 'regulation' | 'backlash';
export type ResourceId = 'hype' | 'cash';

// ───────────────────────────── Content pack ─────────────────────────────

export interface RegionDef {
  id: RegionId;
  nameKey: string;
  /** ISO 3166-1 numeric country codes (as strings, e.g. "840") merged into this region. */
  countries: string[];
  /** Population in millions. */
  population: number;
  /** 0..1 — income per user. */
  wealth: number;
  /** 0..1 — willingness to adopt new tech. */
  openness: number;
  /** 0..1 — how hard this region regulates. */
  strictness: number;
  /** 0..1 — data centre running cost factor. */
  powerCost: number;
  neighbors: RegionId[];
  /** Free-form tags used by scopes and modifiers, e.g. "eu", "english", "island". */
  tags: string[];
}

/** Stats that modifiers can change. 'mul' values multiply together, 'add' values sum. */
export type Stat =
  | 'spreadRate'
  | 'seedChance'
  | 'cashIncome'
  | 'hypeIncome'
  | 'computeCapacity'
  | 'agiRate'
  | 'regulationGain'
  | 'backlashGain'
  | 'riskChance'
  | 'dataCentreCost'
  | 'dataCentreUpkeep'
  | 'launchCost'
  | 'nodeCost'
  | 'acquireCost'
  | 'banDuration';

export interface Modifier {
  stat: Stat;
  op: 'add' | 'mul';
  value: number;
  /** If set, the modifier only applies in regions carrying this tag. */
  regionTag?: string;
}

export type RegionScope =
  | { kind: 'home' }
  | { kind: 'region'; id: RegionId }
  | { kind: 'tag'; tag: string }
  | { kind: 'all' }
  /** `count` random regions where the lab is present (optionally filtered by tag). */
  | { kind: 'random'; count: number; tag?: string }
  /** The lab's `count` regions with the highest adoption. */
  | { kind: 'top'; count: number };

/** Who an effect lands on, relative to the lab that triggered it. Default 'self'. */
export type EffectTarget = 'self' | 'rivals' | 'leadRival' | 'randomRival';

export type Effect =
  | {
      type: 'resource';
      resource: ResourceId;
      amount: number;
      target?: EffectTarget;
      /**
       * Optional progress scaling: adds this many ticks of the receiving lab's average income
       * of `resource` so far in the run (stats.hypeEarned or cashEarned ÷ tick) to `amount`.
       */
      scaleWithIncome?: number;
    }
  /** Adds `percent` % of the lab's current amount (can be negative). */
  | { type: 'resourcePercent'; resource: ResourceId; percent: number; target?: EffectTarget }
  | { type: 'meter'; meter: MeterId; amount: number; target?: EffectTarget }
  | { type: 'agiProgress'; amount: number; target?: EffectTarget }
  /** Multiplies the lab's adoption in the scoped regions by `factor`. */
  | {
      type: 'adoption';
      scope: RegionScope;
      factor: number;
      target?: EffectTarget;
      /** In a moment's effects: act on the moment's region instead of `scope` (ignored elsewhere). */
      atMoment?: boolean;
    }
  /** Bans the lab from the scoped regions. durationTicks -1 = permanent. */
  | { type: 'ban'; scope: RegionScope; durationTicks: number; target?: EffectTarget }
  | { type: 'unban'; scope: RegionScope; target?: EffectTarget }
  | { type: 'timedModifier'; modifier: Modifier; durationTicks: number; target?: EffectTarget }
  /** Takes data centres in the scoped regions offline for a while, or destroys them. */
  | {
      type: 'dataCentre';
      action: 'disable' | 'destroy';
      scope: RegionScope;
      durationTicks?: number;
      target?: EffectTarget;
      /** In a moment's effects: act on the moment's region instead of `scope` (ignored elsewhere). */
      atMoment?: boolean;
    }
  /** Permanent bonus compute (a GPU allocation). Can be negative. */
  | { type: 'compute'; amount: number; target?: EffectTarget }
  | { type: 'setFlag'; flag: string }
  | { type: 'news'; textKey: string; tone?: NewsTone };

export type Condition =
  | { type: 'tickAtLeast'; value: number }
  | { type: 'tickAtMost'; value: number }
  | { type: 'hasNode'; nodeId: NodeId }
  | { type: 'lacksNode'; nodeId: NodeId }
  | { type: 'nodesInTreeAtLeast'; tree: TreeId; value: number }
  | { type: 'meterAtLeast'; meter: MeterId | 'rival'; value: number }
  | { type: 'meterAtMost'; meter: MeterId | 'rival'; value: number }
  | { type: 'agiAtLeast'; value: number }
  /** Lab's share of world population, 0..1. */
  | { type: 'worldShareAtLeast'; value: number }
  | { type: 'worldShareAtMost'; value: number }
  | { type: 'resourceAtLeast'; resource: ResourceId; value: number }
  | { type: 'resourceAtMost'; resource: ResourceId; value: number }
  | { type: 'dataCentresAtLeast'; value: number }
  | { type: 'dataCentresAtMost'; value: number }
  | { type: 'presentInRegion'; scope: RegionScope }
  | { type: 'hasFlag'; flag: string }
  | { type: 'lacksFlag'; flag: string }
  | { type: 'founderIs'; founderId: string }
  /** Case-insensitive, trimmed match on the lab name (easter eggs). */
  | { type: 'labNameIs'; names: string[] }
  | { type: 'endingIs'; endingId: string }
  /** True if the lab is currently banned in at least one scoped region ('random' and 'top' count as 'all'). */
  | { type: 'bannedIn'; scope: RegionScope }
  | { type: 'statAtLeast'; stat: keyof LabState['stats']; value: number }
  | { type: 'statAtMost'; stat: keyof LabState['stats']; value: number }
  /** True only once the run has ended with an ending of this kind. */
  | { type: 'endingKindIs'; kind: 'win' | 'lose' };

export interface NodeDef {
  id: NodeId;
  tree: TreeId;
  nameKey: string;
  descKey: string;
  /** Cost in Hype. */
  cost: number;
  /** Optional extra cost in Cash. */
  cashCost?: number;
  /** All of these must be owned first. */
  requires: NodeId[];
  /** Layout hint for the tree screen: row 1 is the root row. */
  row: number;
  col: number;
  modifiers: Modifier[];
  /** One-off effects applied when bought. */
  onBuy?: Effect[];
  /** Capability nodes: the model tier this node provides (1, 2, 3 ...). */
  capabilityLevel?: number;
  /** Flags granted while owned, e.g. "canAcquire". */
  grantsFlags?: string[];
}

export interface EventChoiceDef {
  id: string;
  labelKey: string;
  /** Short text shown after choosing. */
  resultKey?: string;
  /** Choice is shown disabled unless all hold. */
  requirements?: Condition[];
  cost?: Partial<Record<ResourceId, number>>;
  effects: Effect[];
  /** Optional gamble: with `chance` (0..1, scaled by the riskChance stat) these fire too. */
  risk?: { chance: number; effects: Effect[]; resultKey: string };
}

export type NewsTone = 'good' | 'bad' | 'neutral';

/** A card that pauses the run and asks the player to choose. */
export interface EventDef {
  id: EventId;
  titleKey: string;
  bodyKey: string;
  tone: NewsTone;
  /** Relative draw weight among eligible events. Rare easter-egg cards use ~0.01. */
  weight: number;
  /** If true the card is drawn at most once per run. */
  once: boolean;
  conditions: Condition[];
  /** 2 or 3 choices. */
  choices: EventChoiceDef[];
}

/** A ticker headline with no choice. May carry small automatic effects. */
export interface HeadlineDef {
  id: string;
  textKey: string;
  tone: NewsTone;
  weight: number;
  /** 'player' = about the player's lab, 'rival' = about a random rival ({lab} in the text), 'world' = flavour. */
  about: 'player' | 'rival' | 'world';
  conditions: Condition[];
  effects?: Effect[];
}

export type MomentKind = 'boost' | 'threat';

/**
 * A short-lived thing that appears on a region of the map and can be tapped.
 * A boost is collected for a reward (ignoring it just loses the reward); a threat
 * is contained by tapping it in time, and lands a penalty if it expires.
 */
export interface MomentDef {
  id: string;
  kind: MomentKind;
  nameKey: string;
  /** An icon id the UI maps to a drawing (the pack validator lists the allowed ids), e.g. "megaphone". */
  icon: string;
  /** Relative spawn weight among eligible moments. */
  weight: number;
  /** All must hold for the lab for this moment to spawn. */
  conditions: Condition[];
  /** Ticks the moment stays on the map. */
  lifetimeTicks: number;
  /** Applied when the player taps it in time (collecting a boost, containing a threat). */
  onCollect: Effect[];
  /** Applied when it expires untapped. */
  onExpire?: Effect[];
  /** Short text the UI may show on collect. */
  collectTextKey?: string;
  /** Threats: news text added when it expires ({lab}, {region}). */
  expireTextKey?: string;
}

export interface FounderDef {
  id: string;
  nameKey: string;
  descKey: string;
  startHype: number;
  startCash: number;
  modifiers: Modifier[];
}

/** Weights the AI controller uses when choosing what to buy. */
export interface AiPersonality {
  capability: number;
  reach: number;
  shadow: number;
  /** 0..1 — how readily it builds data centres and launches in new regions. */
  expansion: number;
}

export interface RivalDef {
  id: LabId;
  nameKey: string;
  /** Hex colour used on the map. */
  color: string;
  homeRegion: RegionId;
  personality: AiPersonality;
  /** Tick at which this rival enters the race (0 = from the start). */
  entryTick: number;
}

export type EndingTrigger =
  | 'agi' // player reaches AGI first
  | 'dependence' // player world share reaches the threshold
  | 'monopoly' // every rival eliminated or acquired
  | 'banned' // player regulation meter full
  | 'revolt' // player backlash meter full
  | 'rivalAgi'; // a rival reaches AGI first

export interface EndingDef {
  id: string;
  kind: 'win' | 'lose';
  trigger: EndingTrigger;
  titleKey: string;
  bodyKey: string;
  /**
   * Optional variant: if several endings share a trigger, the first whose
   * conditions all hold is used; one with no conditions is the default.
   */
  conditions?: Condition[];
}

export interface AchievementDef {
  id: string;
  nameKey: string;
  descKey: string;
  /** Secret achievements are hidden until earned (easter eggs). */
  secret: boolean;
  /** Checked every tick ('tick') or once when the run ends ('end'). */
  checkAt: 'tick' | 'end';
  conditions: Condition[];
}

export interface ContentPack {
  id: string;
  version: number;
  regions: RegionDef[];
  nodes: NodeDef[];
  events: EventDef[];
  headlines: HeadlineDef[];
  founders: FounderDef[];
  rivals: RivalDef[];
  endings: EndingDef[];
  achievements: AchievementDef[];
  /** Tap-to-collect moments (only human-controlled labs get them). */
  moments: MomentDef[];
  /** Overrides of the engine's default balance constants. */
  balance: Partial<BalanceConfig>;
  /** locale -> key -> text. Text may contain {lab}, {region}, {rival}, {amount}. */
  strings: Record<string, Record<string, string>>;
}

// ───────────────────────────── Game state ─────────────────────────────

export interface DataCentre {
  id: string;
  regionId: RegionId;
  level: number;
  /** Offline until this tick (exclusive). Absent = online. */
  disabledUntilTick?: number;
}

export interface LabState {
  id: LabId;
  name: string;
  color: string;
  controller: 'human' | 'ai';
  founderId?: string;
  personality?: AiPersonality;
  homeRegion: RegionId;
  /** False before entryTick and after elimination. */
  active: boolean;
  eliminated?: { reason: 'banned' | 'revolt' | 'acquired'; tick: number; byLabId?: LabId };
  hype: number;
  cash: number;
  /** Permanent bonus compute from effects. */
  computeBonus: number;
  /** 0..100. Reaching 100 means AGI. */
  agiProgress: number;
  /** 0..100. */
  regulation: number;
  /** 0..100. */
  backlash: number;
  ownedNodes: NodeId[];
  dataCentres: DataCentre[];
  /** Fraction (0..1) of each region's population using this lab. Missing = 0. */
  adoption: Record<RegionId, number>;
  /** Region -> tick the ban ends (-1 = permanent). */
  bans: Record<RegionId, number>;
  timedModifiers: { modifier: Modifier; untilTick: number }[];
  flags: string[];
  stats: {
    nodesBought: number;
    eventsResolved: number;
    dataCentresBuilt: number;
    peakWorldShare: number;
    cashEarned: number;
    hypeEarned: number;
    /** Moments tapped in time (boosts collected and threats contained). */
    momentsCollected: number;
    /** Moments that expired untapped. */
    momentsMissed: number;
  };
}

/** What a news item is about, so the UI can treat some specially without parsing text keys. */
export type NewsKind = 'launch' | 'entry' | 'ban' | 'elimination' | 'acquisition' | 'achievement' | 'moment' | 'headline' | 'other';

export interface NewsItem {
  tick: number;
  /** Set on every item the engine emits. 'launch' = a lab shipped a new model tier. */
  kind?: NewsKind;
  /** Launches: the node providing the new tier. */
  nodeId?: NodeId;
  /** Launches: the new effective model tier. */
  tier?: number;
  textKey: string;
  tone: NewsTone;
  /** Values for {placeholders}; region/lab values are ids the UI resolves to names. */
  params?: Record<string, string | number>;
  /** Region to flash on the map, if any. */
  regionId?: RegionId;
  labId?: LabId;
}

export interface PendingEvent {
  eventId: EventId;
  labId: LabId;
}

/** A moment on the map. */
export interface MomentState {
  /** Unique within the run. */
  uid: string;
  defId: string;
  labId: LabId;
  regionId: RegionId;
  spawnTick: number;
  /** The moment expires (and can no longer be tapped) when tick reaches this. */
  expiresTick: number;
}

export interface GameEnding {
  endingId: string;
  kind: 'win' | 'lose';
  trigger: EndingTrigger;
  tick: number;
  score: number;
  winnerLabId?: LabId;
}

export interface GameState {
  packId: string;
  seed: number;
  /** Current RNG state (deterministic: same seed + same actions = same run). */
  rng: number;
  tick: number;
  status: 'running' | 'ended';
  playerLabId: LabId;
  labs: Record<LabId, LabState>;
  /** Stable iteration order. */
  labOrder: LabId[];
  /** While set, step() does nothing until the player resolves it. */
  pendingEvent: PendingEvent | null;
  /** Result text of the last resolved choice, for the UI to show once. */
  lastEventResult: { eventId: EventId; choiceId: string; resultKey?: string; riskFired?: boolean } | null;
  nextEventTick: number;
  nextHeadlineTick: number;
  seenEvents: EventId[];
  /** Newest last. Capped by balance.newsLogSize. */
  news: NewsItem[];
  achievements: string[];
  ending: GameEnding | null;
  /** Active moments of every lab. Empty while none are up and after the run ends. */
  moments: MomentState[];
  /** Tick of the next moment spawn attempt. */
  nextMomentTick: number;
}

export interface GameSetup {
  playerName: string;
  founderId: string;
  homeRegion: RegionId;
  seed: number;
  /** Which rivals take part. Default: all in the pack. */
  rivalIds?: LabId[];
}

// ───────────────────────────── Actions ─────────────────────────────

export type Action =
  | { type: 'buyNode'; labId: LabId; nodeId: NodeId }
  | { type: 'buildDataCentre'; labId: LabId; regionId: RegionId }
  | { type: 'upgradeDataCentre'; labId: LabId; dataCentreId: string }
  /** Pay Cash to start operating in a region the lab has not reached yet. */
  | { type: 'launchInRegion'; labId: LabId; regionId: RegionId }
  | { type: 'resolveEvent'; labId: LabId; choiceId: string }
  /** Buy out a rival. Needs the "canAcquire" flag. */
  | { type: 'acquireRival'; labId: LabId; targetLabId: LabId }
  /** Tap a moment: collect a boost or contain a threat. 'unknownId' when it no longer exists. */
  | { type: 'collectMoment'; labId: LabId; uid: string };

export type ActionFailure =
  | 'gameEnded'
  | 'labInactive'
  | 'unknownId'
  | 'alreadyOwned'
  | 'missingRequirement'
  | 'notEnoughHype'
  | 'notEnoughCash'
  | 'regionBanned'
  | 'alreadyPresent'
  | 'limitReached'
  | 'noPendingEvent'
  | 'eventPending'
  | 'notAllowed';

export type ActionCheck = { ok: true } | { ok: false; reason: ActionFailure };
export type ActionResult = { ok: true; state: GameState } | { ok: false; reason: ActionFailure };

/** What the UI reads for the three top-bar meters of a lab. */
export interface Meters {
  regulation: number;
  backlash: number;
  /** AGI progress of the strongest active rival, 0..100. */
  rival: number;
}
