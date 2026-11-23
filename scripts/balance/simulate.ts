/**
 * Plays one headless run and records what the balance report needs.
 * Runs in plain Node (bundled by esbuild, see run.mjs); imports the engine and the pack.
 */
import { aiLabPack } from '@/content';
import {
  ENGINE_NEWS_KEYS,
  getCapabilityLevel,
  getWorldShare,
  runHeadless,
  type BotPolicy,
  type ContentPack,
  type EndingTrigger,
  type GameSetup,
  type GameState,
  type NewsItem,
} from '@/engine';

export interface Job {
  policy: BotPolicy;
  founderId: string;
  homeRegion: string;
  seed: number;
  /** Default 'Bot Lab'. Coverage runs also try the pack's secret names. */
  playerName?: string;
  /** Also record coverage data (events, headlines, news param problems). */
  coverage?: boolean;
  /** Probability the bot taps a moment in time; default by policy (DEFAULT_MOMENT_SKILL). */
  momentSkill?: number;
  /** Difficulty id; default: the pack's default difficulty. */
  difficulty?: string;
  /** Run-length id; default: the pack's default run length. */
  runLength?: string;
  /** Start bonus for the player (Lab Rep perks, see --perks). */
  bonus?: GameSetup['bonus'];
}

export interface RivalRecord {
  id: string;
  entered: boolean;
  /** banned / revolt = its own meters; acquired = bought (byPlayer tells by whom). */
  eliminated: 'banned' | 'revolt' | 'acquired' | null;
  byPlayer: boolean;
  agi: number;
}

export interface RunRecord {
  job: Job;
  endingId: string | null;
  trigger: EndingTrigger | null;
  kind: 'win' | 'lose' | null;
  ticks: number;
  firstNodeTick: number | null;
  firstDataCentreTick: number | null;
  /** Tick at which the effective capability level first reached 1..5 (index 0 = level 1). */
  capabilityTicks: (number | null)[];
  nodesOwned: number;
  cashEnd: number;
  hypeEnd: number;
  worldShareEnd: number;
  peakWorldShare: number;
  agiEnd: number;
  peakRegulation: number;
  peakBacklash: number;
  /** Highest regulation / backlash any rival reached. */
  rivalPeakRegulation: number;
  rivalPeakBacklash: number;
  /** Highest AGI progress among rivals still active at the end. */
  leadRivalAgi: number;
  rivals: RivalRecord[];
  /** Ticks between consecutive player purchases (nodes, builds, upgrades, launches, acquisitions). */
  purchaseGaps: number[];
  purchases: number;
  dataCentresBuilt: number;
  achievements: string[];
  /** Hype and cash income over the run (stats.hypeEarned / cashEarned, not counting moments or their Hype-rate buffs). */
  hypeEarned: number;
  cashEarned: number;
  /** What the bot's moment taps gained (with the extra income from Hype-rate buffs they gave). */
  momentHype: number;
  momentCash: number;
  momentsCollected: number;
  momentsMissed: number;
  /** Event cards the player resolved. */
  eventsResolved: number;
  /** Event choices whose risk fired against the player. */
  risksFired: number;
  /** Nodes the player bought, in order, with the tick of purchase. */
  nodeTicks: { id: string; tick: number }[];
  /** News items without a kind (should stay empty). */
  kindlessNews: number;
  /** Model launches announced: player, rivals. */
  launches: { player: number; rivals: number };
  seenEvents: string[];
  headlines: string[];
  paramProblems: string[];
  error?: string;
}

export let PACK: ContentPack = aiLabPack;

/**
 * Balance overrides on top of the pack's own (for quick sweeps: --balance '{"key":1}'), and
 * optionally a replacement moment list (--moments file.json) to try moment changes side by side.
 */
export function setBalanceOverrides(overrides: Record<string, unknown>, moments?: ContentPack['moments'], patch?: PackPatch): void {
  PACK = { ...aiLabPack, balance: { ...aiLabPack.balance, ...overrides }, ...(moments ? { moments } : {}) };
  if (patch) PACK = applyPackPatch(PACK, patch);
}

/**
 * A what-if change to the pack for diagnosis sweeps (--patch file.json): fields replaced per
 * node or founder id (e.g. {"nodes": {"shadow-benchmarks": {"modifiers": []}}}), and difficulty
 * balance overrides merged per level id.
 */
export interface PackPatch {
  nodes?: Record<string, Partial<ContentPack['nodes'][number]>>;
  founders?: Record<string, Partial<ContentPack['founders'][number]>>;
  difficulties?: Record<string, Record<string, unknown>>;
}

export function applyPackPatch(pack: ContentPack, patch: PackPatch): ContentPack {
  return {
    ...pack,
    nodes: pack.nodes.map((n) => ({ ...n, ...(patch.nodes?.[n.id] ?? {}) })),
    founders: pack.founders.map((f) => ({ ...f, ...(patch.founders?.[f.id] ?? {}) })),
    ...(pack.difficulties
      ? { difficulties: pack.difficulties.map((d) => ({ ...d, balance: { ...d.balance, ...(patch.difficulties?.[d.id] ?? {}) } })) }
      : {}),
  };
}
const MAX_TICKS = 8000;

const headlineByKey = new Map(PACK.headlines.map((h) => [h.textKey, h.id]));
const regionIds = new Set(PACK.regions.map((r) => r.id));
const PLACEHOLDER = /\{(lab|rival|region)\}/g;

/** Every {lab}/{rival}/{region} in the item's text has a param holding a known lab or region id. */
function checkNewsParams(item: NewsItem, state: GameState, out: Set<string>): void {
  const text = PACK.strings.en[item.textKey];
  if (text === undefined) {
    out.add(`${item.textKey}: no string`);
    return;
  }
  for (const match of text.matchAll(PLACEHOLDER)) {
    const name = match[1];
    const value = item.params?.[name];
    const ok = name === 'region' ? typeof value === 'string' && regionIds.has(value) : typeof value === 'string' && value in state.labs;
    if (!ok) out.add(`${item.textKey}: {${name}} = ${JSON.stringify(value)}`);
  }
}

export function simulate(job: Job): RunRecord {
  const capabilityTicks: (number | null)[] = [null, null, null, null, null];
  let firstNodeTick: number | null = null;
  let firstDataCentreTick: number | null = null;
  let lastPurchaseTick = 0;
  let lastNodes = 0;
  let lastBuilt = 0;
  let lastLevels = 0;
  let lastCapability = 0;
  const purchaseGaps: number[] = [];
  let purchases = 0;
  const headlines = new Set<string>();
  const paramProblems = new Set<string>();
  const purchased = (tick: number): void => {
    purchases++;
    purchaseGaps.push(tick - lastPurchaseTick);
    lastPurchaseTick = tick;
  };

  let kindlessNews = 0;
  let risksFired = 0;
  let lastEvents = 0;
  const nodeTicks: { id: string; tick: number }[] = [];
  const launches = { player: 0, rivals: 0 };
  let peakRegulation = 0;
  let peakBacklash = 0;
  let rivalPeakRegulation = 0;
  let rivalPeakBacklash = 0;
  let momentHype = 0;
  let momentCash = 0;
  // Hype-rate buffs from tapped moments: the extra income they cause counts as moment Hype.
  const hypeBuffs: { until: number; value: number }[] = [];
  let buffHype = 0;
  let lastTick = 0;
  let lastHypeEarned = 0;
  const onMomentCollected = (gain: { defId: string; hype: number; cash: number }): void => {
    momentHype += gain.hype;
    momentCash += gain.cash;
    for (const effect of PACK.moments.find((m) => m.id === gain.defId)?.onCollect ?? []) {
      if (effect.type === 'timedModifier' && effect.modifier.stat === 'hypeIncome' && effect.modifier.op === 'mul' && effect.modifier.regionTag === undefined) {
        hypeBuffs.push({ until: lastTick + effect.durationTicks, value: effect.modifier.value });
      }
    }
  };
  const trackHypeBuffs = (state: GameState): void => {
    const earned = state.labs[state.playerLabId].stats.hypeEarned;
    let factor = 1;
    for (const buff of hypeBuffs) if (buff.until >= state.tick) factor *= buff.value;
    if (factor !== 1) buffHype += (earned - lastHypeEarned) * (1 - 1 / factor);
    lastHypeEarned = earned;
    lastTick = state.tick;
  };
  const onTick = (state: GameState): void => {
    trackHypeBuffs(state);
    const player = state.labs[state.playerLabId];
    const tick = state.tick;
    peakRegulation = Math.max(peakRegulation, player.regulation);
    peakBacklash = Math.max(peakBacklash, player.backlash);
    if (tick % 10 === 0) {
      for (const id of state.labOrder) {
        const lab = state.labs[id];
        if (id === player.id || !lab.active) continue;
        rivalPeakRegulation = Math.max(rivalPeakRegulation, lab.regulation);
        rivalPeakBacklash = Math.max(rivalPeakBacklash, lab.backlash);
      }
    }
    let bought = false;
    if (player.stats.eventsResolved !== lastEvents) {
      lastEvents = player.stats.eventsResolved;
      if (state.lastEventResult?.riskFired) risksFired++;
    }
    if (player.ownedNodes.length > nodeTicks.length) {
      for (const id of player.ownedNodes) if (!nodeTicks.some((n) => n.id === id)) nodeTicks.push({ id, tick });
    }
    if (player.stats.nodesBought !== lastNodes) {
      lastNodes = player.stats.nodesBought;
      firstNodeTick ??= tick;
      bought = true;
    }
    if (player.stats.dataCentresBuilt !== lastBuilt) {
      lastBuilt = player.stats.dataCentresBuilt;
      firstDataCentreTick ??= tick;
      bought = true;
    }
    let levels = 0;
    for (const dc of player.dataCentres) levels += dc.level;
    if (levels > lastLevels) bought = true;
    lastLevels = levels;
    for (let i = state.news.length - 1; i >= 0 && state.news[i].tick === tick; i--) {
      const item = state.news[i];
      if (item.labId === player.id && (item.textKey === ENGINE_NEWS_KEYS.launched || (item.textKey === ENGINE_NEWS_KEYS.acquired && item.params?.rival === player.id))) {
        bought = true;
      }
      if (job.coverage) {
        const headline = headlineByKey.get(item.textKey);
        if (headline) headlines.add(headline);
        checkNewsParams(item, state, paramProblems);
      }
    }
    for (let i = state.news.length - 1; i >= 0 && state.news[i].tick === tick; i--) {
      const item = state.news[i];
      if (item.kind === undefined) kindlessNews++;
      if (item.kind === 'launch') {
        if (item.labId === player.id) launches.player++;
        else launches.rivals++;
      }
    }
    if (bought) purchased(tick);
    if (tick % 5 === 0 || bought) {
      const capability = getCapabilityLevel(state, PACK, player.id);
      for (let level = lastCapability + 1; level <= capability && level <= 5; level++) capabilityTicks[level - 1] ??= tick;
      lastCapability = Math.max(lastCapability, capability);
    }
  };

  let state: GameState;
  try {
    state = runHeadless(
      PACK,
      {
        playerName: job.playerName ?? 'Bot Lab',
        founderId: job.founderId,
        homeRegion: job.homeRegion,
        seed: job.seed,
        ...(job.difficulty !== undefined ? { difficulty: job.difficulty } : {}),
        ...(job.runLength !== undefined ? { runLength: job.runLength } : {}),
        ...(job.bonus ? { bonus: job.bonus } : {}),
      },
      { policy: job.policy, maxTicks: MAX_TICKS, onTick, onMomentCollected, ...(job.momentSkill !== undefined ? { momentSkill: job.momentSkill } : {}) },
    );
  } catch (error) {
    return emptyRecord(job, String(error instanceof Error ? (error.stack ?? error.message) : error));
  }

  const player = state.labs[state.playerLabId];
  const rivals: RivalRecord[] = state.labOrder
    .filter((id) => id !== state.playerLabId)
    .map((id) => {
      const lab = state.labs[id];
      return {
        id,
        entered: lab.active || lab.eliminated !== undefined,
        eliminated: lab.eliminated?.reason ?? null,
        byPlayer: lab.eliminated?.byLabId === player.id,
        agi: lab.agiProgress,
      };
    });
  const active = state.labOrder.filter((id) => id !== state.playerLabId && state.labs[id].active);
  return {
    job,
    endingId: state.ending?.endingId ?? null,
    trigger: state.ending?.trigger ?? null,
    kind: state.ending?.kind ?? null,
    ticks: state.tick,
    firstNodeTick,
    firstDataCentreTick,
    capabilityTicks,
    nodesOwned: player.ownedNodes.length,
    cashEnd: player.cash,
    hypeEnd: player.hype,
    worldShareEnd: getWorldShare(state, PACK, player.id),
    peakWorldShare: player.stats.peakWorldShare,
    agiEnd: player.agiProgress,
    peakRegulation,
    peakBacklash,
    rivalPeakRegulation,
    rivalPeakBacklash,
    leadRivalAgi: active.reduce((best, id) => Math.max(best, state.labs[id].agiProgress), 0),
    rivals,
    purchaseGaps,
    purchases,
    dataCentresBuilt: player.stats.dataCentresBuilt,
    achievements: state.achievements.slice(),
    hypeEarned: player.stats.hypeEarned - buffHype,
    cashEarned: player.stats.cashEarned,
    momentHype: momentHype + buffHype,
    momentCash,
    momentsCollected: player.stats.momentsCollected,
    momentsMissed: player.stats.momentsMissed,
    eventsResolved: player.stats.eventsResolved,
    risksFired,
    nodeTicks,
    kindlessNews,
    launches,
    seenEvents: job.coverage ? state.seenEvents.slice() : [],
    headlines: [...headlines],
    paramProblems: [...paramProblems],
  };
}

function emptyRecord(job: Job, error: string): RunRecord {
  return {
    job,
    endingId: null,
    trigger: null,
    kind: null,
    ticks: 0,
    firstNodeTick: null,
    firstDataCentreTick: null,
    capabilityTicks: [null, null, null, null, null],
    nodesOwned: 0,
    cashEnd: 0,
    hypeEnd: 0,
    worldShareEnd: 0,
    peakWorldShare: 0,
    agiEnd: 0,
    peakRegulation: 0,
    peakBacklash: 0,
    rivalPeakRegulation: 0,
    rivalPeakBacklash: 0,
    leadRivalAgi: 0,
    rivals: [],
    purchaseGaps: [],
    purchases: 0,
    dataCentresBuilt: 0,
    achievements: [],
    hypeEarned: 0,
    cashEarned: 0,
    momentHype: 0,
    momentCash: 0,
    momentsCollected: 0,
    momentsMissed: 0,
    eventsResolved: 0,
    risksFired: 0,
    nodeTicks: [],
    kindlessNews: 0,
    launches: { player: 0, rivals: 0 },
    seenEvents: [],
    headlines: [],
    paramProblems: [],
    error,
  };
}
