/**
 * Difficulty choice on the start flow: which level is preselected, remembering the last
 * choice, the `&difficulty=` URL param, and the end screen's difficulty line. The levels and
 * their rules live in the pack and the engine; this file only picks between them.
 */
import { getDifficulties, getDifficulty, type ContentPack, type DifficultyDef, type GameState } from '@/engine';

import { fmtNum } from '../format';
import { t } from '../i18n';
import { readValue, writeValue } from '../tutorial/storage';
import { TUTORIAL_DONE_KEY } from '../tutorial/store';

/** Storage key of the last difficulty chosen on the start screen. */
export const DIFFICULTY_KEY = 'ai-race.difficulty.v1';

/** True when `id` names one of the pack's levels. */
export function isDifficulty(pack: ContentPack, id: string | null | undefined): id is string {
  return typeof id === 'string' && getDifficulties(pack).some((d) => d.id === id);
}

/**
 * The level to preselect: the last one chosen (if it still exists); with nothing stored,
 * the easiest (first) level until the tutorial has been completed, then the pack default.
 * Undefined when the pack has no levels.
 */
export function initialDifficulty(pack: ContentPack, stored: string | null, tutorialDone: boolean): string | undefined {
  const list = getDifficulties(pack);
  if (list.length === 0) return undefined;
  if (isDifficulty(pack, stored)) return stored;
  if (!tutorialDone) return list[0].id;
  return isDifficulty(pack, pack.defaultDifficulty) ? pack.defaultDifficulty : list[0].id;
}

/** `&difficulty=` from the URL when it names a level, else undefined (the engine falls back). */
export function difficultyParam(pack: ContentPack, param: string | string[] | undefined): string | undefined {
  const value = Array.isArray(param) ? param[0] : param;
  return isDifficulty(pack, value) ? value : undefined;
}

/** Reads the stored choice and the tutorial flag and returns the level to preselect. */
export async function loadDifficultyChoice(pack: ContentPack): Promise<string | undefined> {
  const [stored, done] = await Promise.all([readValue(DIFFICULTY_KEY).catch(() => null), readValue(TUTORIAL_DONE_KEY).catch(() => null)]);
  return initialDifficulty(pack, stored, done === '1');
}

/** Remembers the level for the next start screen. */
export function saveDifficultyChoice(id: string | undefined): void {
  if (id === undefined) return;
  void writeValue(DIFFICULTY_KEY, id).catch(() => undefined);
}

/** "×1.35", "×1", "×0.75". */
export function multiplierText(m: number): string {
  return fmtNum(Math.round(m * 100) / 100, 2);
}

export interface DifficultyOption {
  id: string;
  name: string;
  desc: string;
  /** "Score ×1.35". */
  score: string;
}

/** The pack's levels as the picker shows them, easiest first. */
export function difficultyOptions(pack: ContentPack): DifficultyOption[] {
  return getDifficulties(pack).map((d: DifficultyDef) => ({
    id: d.id,
    name: t(d.nameKey),
    desc: t(d.descKey),
    score: t('ui.difficulty.multiplier', { mult: multiplierText(d.scoreMultiplier) }),
  }));
}

/** "Arms Race · score ×1.35" for the end screen; null when the pack has no levels. */
export function difficultyEndLine(state: GameState, pack: ContentPack): string | null {
  const d = getDifficulty(state, pack);
  if (!d) return null;
  return t('ui.difficulty.endLine', { difficulty: t(d.nameKey), mult: multiplierText(d.scoreMultiplier) });
}
