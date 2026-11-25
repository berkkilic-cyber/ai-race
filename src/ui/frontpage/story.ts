/**
 * What happened in a run, collected while it plays, for the front page and the share card.
 * The engine's news log is capped and its state has no history, so a small recorder watches
 * the run: the first model launch, the rival launch that beat the player hardest, rivals
 * bought, bans, the worst meter peak, a notable event choice, and who led the AGI race every
 * few days. Pure (no React, no storage): the store subscription (./recorder.ts) and the
 * headless tests feed it the same way. Work per tick is O(1) plus the news items added since
 * the last call; the race sample (O(labs)) runs every SAMPLE_EVERY ticks.
 */
import { getCapabilityLevel, getWorldShare, type ContentPack, type GameState, type NewsItem } from '@/engine';

/** Ticks between AGI-race samples. */
export const SAMPLE_EVERY = 5;
/** Story format; a stored story of another format is dropped. */
export const STORY_VERSION = 1;

export interface MeterPeak {
  value: number;
  tick: number;
}

export interface RunStory {
  v: number;
  seed: number;
  /** Tick of the last observation. */
  lastTick: number;
  /** Tick of the newest news item processed. */
  newsTick: number;
  firstLaunch?: { tick: number; model: string; tier: number };
  /** The rival launch that put a rival furthest ahead of the player's model tier. */
  rivalLaunch?: { tick: number; rival: string; model: string; tier: number; gap: number };
  /** The first rival the player bought, and how many. */
  acquisition?: { tick: number; rival: string };
  acquisitions: number;
  firstBan?: { tick: number; region: string };
  bans: number;
  peak: { regulation: MeterPeak; backlash: MeterPeak };
  /** A notable event choice: the first one whose risk fired, else the latest. */
  event?: { tick: number; eventId: string; choiceId: string; riskFired: boolean };
  /** Player events resolved so far (to notice a new choice). */
  eventsResolved: number;
  /** One sample per SAMPLE_EVERY ticks from `sampleFrom`: 1 = the player led the AGI race, 0 = a rival did. */
  lead: number[];
  sampleFrom: number;
}

export function createStory(state: GameState): RunStory {
  return {
    v: STORY_VERSION,
    seed: state.seed,
    lastTick: -1,
    newsTick: -1,
    acquisitions: 0,
    bans: 0,
    peak: { regulation: { value: 0, tick: 0 }, backlash: { value: 0, tick: 0 } },
    eventsResolved: state.labs[state.playerLabId]?.stats.eventsResolved ?? 0,
    lead: [],
    sampleFrom: state.tick,
  };
}

/** A recorder: the story plus the last news item seen (a reference, not stored). */
export interface StoryRecorder {
  story: RunStory;
  lastNews: NewsItem | null;
}

export function createRecorder(state: GameState, story?: RunStory | null): StoryRecorder {
  const usable = story && story.v === STORY_VERSION && story.seed === state.seed && story.lastTick <= state.tick ? story : null;
  return { story: usable ?? createStory(state), lastNews: null };
}

/** True when the player led the AGI race: higher AGI progress than every active rival (ties: higher world share). */
export function playerLeads(state: GameState, pack: ContentPack): boolean {
  const me = state.labs[state.playerLabId];
  let best = -1;
  let bestId: string | null = null;
  for (const id of state.labOrder) {
    const lab = state.labs[id];
    if (id === state.playerLabId || !lab.active) continue;
    if (lab.agiProgress > best) {
      best = lab.agiProgress;
      bestId = id;
    }
  }
  if (!bestId || me.agiProgress > best) return true;
  if (me.agiProgress < best) return false;
  return getWorldShare(state, pack, state.playerLabId) >= getWorldShare(state, pack, bestId);
}

function newsSince(rec: StoryRecorder, news: readonly NewsItem[]): NewsItem[] {
  if (news.length === 0) return [];
  const last = news[news.length - 1];
  if (last === rec.lastNews) return [];
  if (rec.lastNews) {
    for (let i = news.length - 1; i >= 0; i--) if (news[i] === rec.lastNews) return news.slice(i + 1);
  }
  // First call (or the cursor fell out of the capped log): everything newer than what was processed.
  return news.filter((n) => n.tick > rec.story.newsTick);
}

function onNews(story: RunStory, item: NewsItem, state: GameState, pack: ContentPack): void {
  const me = state.playerLabId;
  if (item.kind === 'launch' && item.params) {
    const model = String(item.params.model ?? '');
    const tier = Number(item.tier ?? item.params.tier ?? 0);
    if (item.labId === me) {
      if (!story.firstLaunch) story.firstLaunch = { tick: item.tick, model, tier };
    } else if (item.labId) {
      const gap = tier - getCapabilityLevel(state, pack, me);
      if (gap > 0 && (!story.rivalLaunch || gap > story.rivalLaunch.gap)) story.rivalLaunch = { tick: item.tick, rival: item.labId, model, tier, gap };
    }
  } else if (item.kind === 'acquisition' && item.params?.rival === me && typeof item.params.lab === 'string') {
    story.acquisitions++;
    if (!story.acquisition) story.acquisition = { tick: item.tick, rival: item.params.lab };
  } else if (item.kind === 'ban' && item.labId === me && item.regionId) {
    story.bans++;
    if (!story.firstBan) story.firstBan = { tick: item.tick, region: item.regionId };
  }
}

/** Feeds one observation of the run (call after every tick and action; cheap when nothing changed). */
export function observe(rec: StoryRecorder, state: GameState, pack: ContentPack): void {
  const story = rec.story;
  if (state.seed !== story.seed) return;
  const me = state.labs[state.playerLabId];
  if (!me) return;

  for (const item of newsSince(rec, state.news)) {
    onNews(story, item, state, pack);
    if (item.tick > story.newsTick) story.newsTick = item.tick;
  }
  if (state.news.length) rec.lastNews = state.news[state.news.length - 1];

  if (me.regulation > story.peak.regulation.value) story.peak.regulation = { value: me.regulation, tick: state.tick };
  if (me.backlash > story.peak.backlash.value) story.peak.backlash = { value: me.backlash, tick: state.tick };

  if (me.stats.eventsResolved !== story.eventsResolved) {
    story.eventsResolved = me.stats.eventsResolved;
    const r = state.lastEventResult;
    if (r && !(story.event?.riskFired && !r.riskFired)) story.event = { tick: state.tick, eventId: r.eventId, choiceId: r.choiceId, riskFired: !!r.riskFired };
  }

  // One AGI-race sample per SAMPLE_EVERY ticks since sampleFrom (catching up if ticks were skipped).
  const due = Math.floor((state.tick - story.sampleFrom) / SAMPLE_EVERY) + 1;
  if (due > story.lead.length) {
    const lead = playerLeads(state, pack) ? 1 : 0;
    while (story.lead.length < due) story.lead.push(lead);
  }
  story.lastTick = state.tick;
}

/** Who led the AGI race in each of `parts` equal slices of the run: 'you', 'rival' or 'none' (no samples). */
export type RaceCell = 'you' | 'rival' | 'none';

export function raceCells(story: RunStory | null | undefined, endTick: number, parts = 5): RaceCell[] {
  const cells: RaceCell[] = [];
  const end = Math.max(1, endTick + 1);
  for (let p = 0; p < parts; p++) {
    const from = Math.floor((p * end) / parts);
    const to = Math.floor(((p + 1) * end) / parts);
    let you = 0;
    let total = 0;
    if (story) {
      for (let i = 0; i < story.lead.length; i++) {
        const tick = story.sampleFrom + i * SAMPLE_EVERY;
        if (tick >= from && tick < to) {
          total++;
          you += story.lead[i];
        }
      }
    }
    cells.push(total === 0 ? 'none' : you * 2 >= total ? 'you' : 'rival');
  }
  return cells;
}

/** The race cells as stored in a daily result: Y, R or '.'. */
export function raceCode(cells: readonly RaceCell[]): string {
  return cells.map((c) => (c === 'you' ? 'Y' : c === 'rival' ? 'R' : '.')).join('');
}

export function cellsFromCode(code: string | undefined): RaceCell[] {
  return (code ?? '').split('').map((ch) => (ch === 'Y' ? 'you' : ch === 'R' ? 'rival' : 'none'));
}
