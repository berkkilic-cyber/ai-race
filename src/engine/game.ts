import type { EngineContext } from './context';
import { getContext } from './context';
import { scheduleNextHeadline } from './events';
import { seedToRng } from './rng';
import type { ContentPack, GameSetup, GameState, LabState, RivalDef } from './types';

/** Lab id of the human player. */
export const PLAYER_LAB_ID = 'player';
/** Map colour of the player's lab; the contract gives the player no colour of its own, so the UI may override it. */
export const DEFAULT_PLAYER_COLOR = '#ffffff';

function emptyStats(): LabState['stats'] {
  return { nodesBought: 0, eventsResolved: 0, dataCentresBuilt: 0, peakWorldShare: 0, cashEarned: 0, hypeEarned: 0 };
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
    hype: founder.startHype,
    cash: founder.startCash,
    active: true,
    adoption: { [setup.homeRegion]: context.balance.startAdoption },
  };
}

/**
 * A rival lab. Rivals with entryTick 0 start active at home; later ones start inactive
 * and empty and enter during step(). Its name is its nameKey, for the UI to translate.
 */
function createRival(context: EngineContext, rival: RivalDef): LabState {
  const entersNow = rival.entryTick <= 0;
  return {
    ...baseLab(rival.id, rival.homeRegion),
    name: rival.nameKey,
    color: rival.color,
    controller: 'ai',
    personality: { ...rival.personality },
    hype: context.balance.rivalStartHype,
    cash: context.balance.rivalStartCash,
    active: entersNow,
    adoption: entersNow ? { [rival.homeRegion]: context.balance.startAdoption } : {},
  };
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
  const context = getContext(pack);
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
  };
  scheduleNextHeadline(state, context);
  return state;
}
