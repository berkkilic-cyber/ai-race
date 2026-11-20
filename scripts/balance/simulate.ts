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
  seenEvents: string[];
  headlines: string[];
  paramProblems: string[];
  error?: string;
}

export let PACK: ContentPack = aiLabPack;

/** Balance overrides on top of the pack's own (for quick sweeps: --balance '{"key":1}'). */
export function setBalanceOverrides(overrides: Record<string, unknown>): void {
  PACK = { ...aiLabPack, balance: { ...aiLabPack.balance, ...overrides } };
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

  let peakRegulation = 0;
  let peakBacklash = 0;
  let rivalPeakRegulation = 0;
  let rivalPeakBacklash = 0;
  const onTick = (state: GameState): void => {
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
      { playerName: job.playerName ?? 'Bot Lab', founderId: job.founderId, homeRegion: job.homeRegion, seed: job.seed },
      { policy: job.policy, maxTicks: MAX_TICKS, onTick },
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
    seenEvents: [],
    headlines: [],
    paramProblems: [],
    error,
  };
}
