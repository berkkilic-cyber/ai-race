import type { EngineContext } from './context';
import { pacedTicks } from './balance';
import { getContext, resolveDifficulty, resolveRunLength } from './context';
import { founderStart } from './derived';
import { scheduleNextHeadline } from './events';
import { max, round } from './natives';
import { seedToRng } from './rng';
import type { ContentPack, GameSetup, GameState, LabState, Modifier, RivalDef, StartBonus } from './types';

/** Lab id of the human player. */
export const PLAYER_LAB_ID = 'player';
/**
 * `untilTick` of a start-bonus modifier (GameSetup.bonus): it never runs out. LabState has no
 * list of permanent extra modifiers, so they ride in `timedModifiers` with this end tick; a
 * finite number (unlike Infinity) survives the JSON run save.
 */
export const PERMANENT_UNTIL_TICK = Number.MAX_SAFE_INTEGER;

/** Map colour of the player's lab; the contract gives the player no colour of its own, so the UI may override it. */
export const DEFAULT_PLAYER_COLOR = '#ffffff';

function emptyStats(): LabState['stats'] {
  return { nodesBought: 0, eventsResolved: 0, dataCentresBuilt: 0, peakWorldShare: 0, cashEarned: 0, hypeEarned: 0, momentsCollected: 0, momentsMissed: 0 };
}

function baseLab(id: string, homeRegion: string): Omit<LabState, 'name' | 'color' | 'controller' | 'hype' | 'cash' | 'active'> {
  return {
    id,
    homeRegion,
    computeBonus: 0,
    agiProgress: 0,
    regulation: 0,
    backlash: 0,
    ownedNodes: [],
    dataCentres: [],
    adoption: {},
    bans: {},
    timedModifiers: [],
    flags: [],
    stats: emptyStats(),
  };
}

function createPlayer(context: EngineContext, setup: GameSetup): LabState {
  const founder = context.founders.get(setup.founderId);
  if (!founder) throw new Error(`Unknown founder: ${setup.founderId}`);
  if (!context.regions.has(setup.homeRegion)) throw new Error(`Unknown region: ${setup.homeRegion}`);
  return {
    ...baseLab(PLAYER_LAB_ID, setup.homeRegion),
    name: setup.playerName,
    color: DEFAULT_PLAYER_COLOR,
    controller: 'human',
    founderId: founder.id,
    ...withStartBonus(founderStart(founder, context.balance), setup.bonus),
    active: true,
    adoption: { [setup.homeRegion]: context.balance.startAdoption },
    timedModifiers: bonusModifiers(setup.bonus),
  };
}

const finiteOr0 = (v: number | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * The founder's start (already × the difficulty's start factors) plus the bonus's flat
 * amounts. The bonus is added after the factors on purpose: it is earned outside the run and
 * shown to the player as a fixed amount ("+15 Cash"), so it must mean the same on every level.
 * Never below zero; non-finite amounts count as 0.
 */
function withStartBonus(start: { hype: number; cash: number }, bonus: StartBonus | undefined): { hype: number; cash: number } {
  if (!bonus) return start;
  const hype = finiteOr0(bonus.startHype);
  const cash = finiteOr0(bonus.startCash);
  return { hype: hype === 0 ? start.hype : max(0, start.hype + hype), cash: cash === 0 ? start.cash : max(0, start.cash + cash) };
}

/** The bonus's modifiers as permanent entries after the founder's (non-finite values are dropped). */
function bonusModifiers(bonus: StartBonus | undefined): LabState['timedModifiers'] {
  const list: Modifier[] = bonus?.modifiers ?? [];
  return list.filter((m) => Number.isFinite(m.value)).map((m) => ({ modifier: { ...m }, untilTick: PERMANENT_UNTIL_TICK }));
}

/**
 * A rival lab. Rivals with entryTick 0 start active at home; later ones start inactive
 * and empty and enter during step(). Its name is its nameKey, for the UI to translate.
 */
function createRival(context: EngineContext, rival: RivalDef): LabState {
  const entersNow = rivalEntryTick(context, rival) <= 0;
  return {
    ...baseLab(rival.id, rival.homeRegion),
    name: rival.nameKey,
    color: rival.color,
    controller: 'ai',
    personality: { ...rival.personality, expansion: max(0, rival.personality.expansion * context.balance.aiExpansionFactor) },
    hype: context.balance.rivalStartHype,
    cash: context.balance.rivalStartCash,
    active: entersNow,
    adoption: entersNow ? { [rival.homeRegion]: context.balance.startAdoption } : {},
  };
}

/** The tick a rival enters in this run: its entryTick × rivalEntryTickFactor, rounded, then ÷ pace. */
export function rivalEntryTick(context: EngineContext, rival: RivalDef): number {
  if (rival.entryTick <= 0) return rival.entryTick;
  const scaled = max(0, round(rival.entryTick * context.balance.rivalEntryTickFactor));
  return scaled <= 0 ? scaled : pacedTicks(context.pace, scaled);
}

function selectedRivals(context: EngineContext, setup: GameSetup): RivalDef[] {
  if (!setup.rivalIds) return context.pack.rivals.slice();
  return setup.rivalIds.map((id) => {
    const rival = context.rivals.get(id);
    if (!rival) throw new Error(`Unknown rival: ${id}`);
    return rival;
  });
}

export function createGame(pack: ContentPack, setup: GameSetup): GameState {
  const difficulty = resolveDifficulty(pack, setup.difficulty);
  const runLength = resolveRunLength(pack, setup.runLength);
  const context = getContext(pack, difficulty?.id, runLength?.id);
  const player = createPlayer(context, setup);
  const rivals = selectedRivals(context, setup).map((rival) => createRival(context, rival));
  const labs: Record<string, LabState> = { [player.id]: player };
  for (const rival of rivals) labs[rival.id] = rival;
  const state: GameState = {
    packId: pack.id,
    seed: setup.seed,
    rng: seedToRng(setup.seed),
    tick: 0,
    status: 'running',
    playerLabId: player.id,
    labs,
    labOrder: [player.id, ...rivals.map((rival) => rival.id)],
    pendingEvent: null,
    lastEventResult: null,
    nextEventTick: context.balance.firstEventTick,
    nextHeadlineTick: 0,
    seenEvents: [],
    news: [],
    achievements: [],
    ending: null,
    moments: [],
    nextMomentTick: context.balance.momentFirstTick,
  };
  if (difficulty) state.difficulty = difficulty.id;
  if (runLength) state.runLength = runLength.id;
  scheduleNextHeadline(state, context);
  return state;
}
