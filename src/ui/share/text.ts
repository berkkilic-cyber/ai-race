/**
 * The share text: a few short lines built to paste anywhere (a tweet, a WhatsApp message, a
 * Discord post), in the spirit of Wordle's grid. No emoji: one line of small squares shows
 * who led the AGI race in each fifth of the run (filled = you, hollow = a rival). Nothing
 * about the day's events, so it spoils nothing for players who have not played yet.
 *
 *   AI Race Daily #25
 *   Reached AGI first · day 212
 *   AGI race ■■□■■
 *   Score 4,210 · Streak 3
 *   https://ai-race.example/play
 *
 * Pure apart from `t` and the number format (both follow the current locale).
 */
import type { GameState } from '@/engine';

import { fmtInt } from '../format';
import { t } from '../i18n';
import { raceCells, type RaceCell, type RunStory } from '../frontpage/story';
import { SHARE_LINK } from './link';

export const RACE_SYMBOL: Record<RaceCell, string> = { you: '■', rival: '□', none: '·' };

export interface ShareInput {
  /** Set for the scored daily: its number and the streak after it. */
  daily?: { number: number; streak: number };
  /** The ending's trigger (share.ending.<trigger> in the pack). */
  trigger: string;
  /** Days survived. */
  days: number;
  race: readonly RaceCell[];
  score: number;
  link?: string;
}

/** The share input for a finished run. */
export function shareInputOf(state: GameState, story: RunStory | null, daily?: { number: number; streak: number }): ShareInput | null {
  const e = state.ending;
  if (!e) return null;
  return {
    ...(daily ? { daily } : {}),
    trigger: e.trigger,
    days: e.tick + 1,
    race: raceCells(story, e.tick),
    score: Math.round(e.score),
  };
}

export function raceLine(race: readonly RaceCell[]): string {
  return race.map((c) => RACE_SYMBOL[c]).join('');
}

/** The text to share, lines joined with "\n". */
export function buildShareText(input: ShareInput): string {
  const title = t('pack.title');
  const lines = [
    input.daily ? t('ui.share.text.titleDaily', { title, number: input.daily.number }) : title,
    t('ui.share.text.ending', { ending: t(`share.ending.${input.trigger}`), days: fmtInt(input.days) }),
    t('ui.share.text.race', { race: raceLine(input.race) }),
    input.daily ? t('ui.share.text.scoreDaily', { score: fmtInt(input.score), streak: fmtInt(input.daily.streak) }) : t('ui.share.text.score', { score: fmtInt(input.score) }),
    input.link ?? SHARE_LINK,
  ];
  return lines.join('\n');
}
