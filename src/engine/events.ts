import { checkAll } from './conditions';
import type { EngineContext } from './context';
import { otherActiveLabs } from './derived';
import { applyEffects } from './effects';
import { pushNews } from './news';
import { randomInt, weightedPick } from './rng';
import type { EventChoiceDef, EventDef, GameState, HeadlineDef, LabState } from './types';
import { max } from './natives';

/** A choice the lab can take right now (requirements met and cost affordable). */
export function isChoiceAvailable(state: GameState, context: EngineContext, lab: LabState, choice: EventChoiceDef): boolean {
  return lab.hype >= (choice.cost?.hype ?? 0) && lab.cash >= (choice.cost?.cash ?? 0) && checkAll(state, context, lab, choice.requirements);
}

/**
 * Events that may be drawn now. An event with no available choice is skipped:
 * nothing can change while a card is pending, so it could never be resolved.
 */
export function eligibleEvents(state: GameState, context: EngineContext, lab: LabState): EventDef[] {
  return context.pack.events.filter(
    (event) =>
      !(event.once && state.seenEvents.includes(event.id)) &&
      checkAll(state, context, lab, event.conditions) &&
      event.choices.some((choice) => isChoiceAvailable(state, context, lab, choice)),
  );
}

/** Draws an event card for the player when one is due. */
export function maybeDrawEvent(state: GameState, context: EngineContext): void {
  if (state.pendingEvent || state.tick < state.nextEventTick) return;
  const player = state.labs[state.playerLabId];
  if (!player?.active) return;
  const event = weightedPick(state, eligibleEvents(state, context, player), (e) => e.weight);
  if (!event) {
    state.nextEventTick = state.tick + max(1, context.balance.eventRetryTicks);
    return;
  }
  state.pendingEvent = { eventId: event.id, labId: player.id };
  if (!state.seenEvents.includes(event.id)) state.seenEvents.push(event.id);
}

export function scheduleNextEvent(state: GameState, context: EngineContext): void {
  state.nextEventTick = state.tick + randomInt(state, context.balance.eventIntervalMin, context.balance.eventIntervalMax);
}

export function scheduleNextHeadline(state: GameState, context: EngineContext): void {
  state.nextHeadlineTick = state.tick + max(1, randomInt(state, context.balance.headlineIntervalMin, context.balance.headlineIntervalMax));
}

interface HeadlineCandidate {
  headline: HeadlineDef;
  /** The lab the headline is about and whose effects it carries. */
  subject: LabState;
}

function headlineCandidates(state: GameState, context: EngineContext, player: LabState): HeadlineCandidate[] {
  const rivals = otherActiveLabs(state, player.id);
  // The rival a 'rival' headline would be about is chosen first, so its conditions can be checked against it.
  const rival = rivals.length > 0 ? rivals[randomInt(state, 0, rivals.length - 1)] : undefined;
  const candidates: HeadlineCandidate[] = [];
  for (const headline of context.pack.headlines) {
    const subject = headline.about === 'rival' ? rival : player;
    if (subject && checkAll(state, context, subject, headline.conditions)) candidates.push({ headline, subject });
  }
  return candidates;
}

/** Adds one eligible headline to the news when one is due. */
export function maybeAddHeadline(state: GameState, context: EngineContext): void {
  if (state.tick < state.nextHeadlineTick) return;
  scheduleNextHeadline(state, context);
  const player = state.labs[state.playerLabId];
  if (!player) return;
  const picked = weightedPick(state, headlineCandidates(state, context, player), (c) => c.headline.weight);
  if (!picked) return;
  const { headline, subject } = picked;
  pushNews(state, context, { textKey: headline.textKey, tone: headline.tone, params: { lab: subject.id }, labId: subject.id });
  applyEffects(state, context, subject, headline.effects);
}
