import { checkAll } from './conditions';
import type { EngineContext } from './context';
import { worldShareOf } from './derived';
import { ENGINE_NEWS_KEYS, pushNews } from './news';
import type { EndingDef, EndingTrigger, GameState, LabState } from './types';
import { max, round } from './natives';

interface EndingCheck {
  trigger: EndingTrigger;
  winnerLabId?: string;
}

const WINNING_TRIGGERS: readonly EndingTrigger[] = ['agi', 'dependence', 'monopoly'];

function rivalsOf(state: GameState): LabState[] {
  return state.labOrder.filter((id) => id !== state.playerLabId).map((id) => state.labs[id]);
}

/** Which ending, if any, the current state triggers. Order follows the simulation rules. */
export function detectEnding(state: GameState, context: EngineContext): EndingCheck | null {
  const player = state.labs[state.playerLabId];
  if (player.eliminated?.reason === 'banned') return { trigger: 'banned' };
  if (player.eliminated?.reason === 'revolt') return { trigger: 'revolt' };
  const rivals = rivalsOf(state);
  const agiRival = rivals.find((rival) => rival.active && rival.agiProgress >= 100);
  if (agiRival) return { trigger: 'rivalAgi', winnerLabId: agiRival.id };
  if (player.agiProgress >= 100) return { trigger: 'agi', winnerLabId: player.id };
  // A rival that has not entered yet is neither active nor eliminated.
  if (rivals.length > 0 && rivals.every((rival) => rival.eliminated !== undefined)) return { trigger: 'monopoly', winnerLabId: player.id };
  if (worldShareOf(player, context) >= context.balance.dependenceShare) return { trigger: 'dependence', winnerLabId: player.id };
  return null;
}

/** First variant of the trigger whose conditions hold; an unconditioned one is the fallback. */
export function selectEnding(state: GameState, context: EngineContext, trigger: EndingTrigger): EndingDef | undefined {
  const player = state.labs[state.playerLabId];
  const candidates = context.pack.endings.filter((ending) => ending.trigger === trigger);
  const conditional = candidates.find((ending) => ending.conditions && ending.conditions.length > 0 && checkAll(state, context, player, ending.conditions));
  return conditional ?? candidates.find((ending) => !ending.conditions || ending.conditions.length === 0) ?? candidates[0];
}

export function computeScore(state: GameState, context: EngineContext, kind: 'win' | 'lose'): number {
  const player = state.labs[state.playerLabId];
  const b = context.balance;
  const peakShare = max(player.stats.peakWorldShare, worldShareOf(player, context));
  let score = peakShare * 100 * b.scorePerSharePoint + player.agiProgress * b.scorePerAgi + player.stats.nodesBought * b.scorePerNode;
  if (kind === 'win') score += b.scoreWin + max(0, b.scoreTargetTicks - state.tick) * b.scorePerTickSaved;
  return round(score * max(0, context.difficulty?.scoreMultiplier ?? 1));
}

/** Tests not-yet-earned achievements with the given checkAt for the player. */
export function checkAchievements(state: GameState, context: EngineContext, checkAt: 'tick' | 'end'): void {
  const player = state.labs[state.playerLabId];
  for (const achievement of context.pack.achievements) {
    if (achievement.checkAt !== checkAt || state.achievements.includes(achievement.id)) continue;
    if (!checkAll(state, context, player, achievement.conditions)) continue;
    state.achievements.push(achievement.id);
    pushNews(state, context, { textKey: ENGINE_NEWS_KEYS.achievement, kind: 'achievement', tone: 'good', params: { achievement: achievement.id }, labId: player.id });
  }
}

/** Ends the run if an ending is triggered. */
export function checkEnding(state: GameState, context: EngineContext): void {
  const found = detectEnding(state, context);
  if (!found) return;
  const def = selectEnding(state, context, found.trigger);
  const kind = def?.kind ?? (WINNING_TRIGGERS.includes(found.trigger) ? 'win' : 'lose');
  const ending = { endingId: def?.id ?? found.trigger, kind, trigger: found.trigger, tick: state.tick, score: 0 };
  state.ending = found.winnerLabId === undefined ? ending : { ...ending, winnerLabId: found.winnerLabId };
  state.ending.score = computeScore(state, context, kind);
  state.status = 'ended';
  state.pendingEvent = null;
  state.moments = [];
  checkAchievements(state, context, 'end');
}
