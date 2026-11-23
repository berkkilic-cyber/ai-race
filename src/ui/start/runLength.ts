/**
 * Run-length choice on the start flow (Sprint / Full run): which one is preselected,
 * remembering the last choice, the `&runLength=` URL param, and the end screen's line. The
 * presets and their rules live in the pack and the engine; this file only picks between them.
 */
import { getDifficulty, getRunLength, getRunLengths, getScoreMultiplier, type ContentPack, type GameState } from '@/engine';

import { hasString, t } from '../i18n';
import { hasCompletedRun } from '../store/runSave';
import { readValue, writeValue } from '../tutorial/storage';
import { multiplierText } from './difficulty';

/** Storage key of the last run length chosen on the start screen. */
export const RUN_LENGTH_KEY = 'ai-race.runLength.v1';

/** True when `id` names one of the pack's run lengths. */
export function isRunLength(pack: ContentPack, id: string | null | undefined): id is string {
  return typeof id === 'string' && getRunLengths(pack).some((r) => r.id === id);
}

/**
 * The run length to preselect: the last one chosen (if it still exists); with nothing stored,
 * the shortest (first) until the player has finished a run, then the pack default.
 * Undefined when the pack has none.
 */
export function initialRunLength(pack: ContentPack, stored: string | null, completedRun: boolean): string | undefined {
  const list = getRunLengths(pack);
  if (list.length === 0) return undefined;
  if (isRunLength(pack, stored)) return stored;
  if (!completedRun) return list[0].id;
  return isRunLength(pack, pack.defaultRunLength) ? pack.defaultRunLength : list[0].id;
}

/** `&runLength=` from the URL when it names a preset, else undefined (the engine falls back). */
export function runLengthParam(pack: ContentPack, param: string | string[] | undefined): string | undefined {
  const value = Array.isArray(param) ? param[0] : param;
  return isRunLength(pack, value) ? value : undefined;
}

/** Reads the stored choice and whether a run was ever finished, and returns the preset to preselect. */
export async function loadRunLengthChoice(pack: ContentPack): Promise<string | undefined> {
  const [stored, completed] = await Promise.all([readValue(RUN_LENGTH_KEY).catch(() => null), hasCompletedRun().catch(() => false)]);
  return initialRunLength(pack, stored, completed);
}

/** Remembers the run length for the next start screen. */
export function saveRunLengthChoice(id: string | undefined): void {
  if (id === undefined) return;
  void writeValue(RUN_LENGTH_KEY, id).catch(() => undefined);
}

export interface RunLengthOption {
  id: string;
  name: string;
  desc: string;
  /** "8–10 min" (the pack's `runLength.<id>.minutes`), empty when the pack has none. */
  minutes: string;
  /** "Score ×0.6". */
  score: string;
}

/** The pack's run lengths as the picker shows them, shortest first. */
export function runLengthOptions(pack: ContentPack): RunLengthOption[] {
  return getRunLengths(pack).map((r) => {
    const minutesKey = `runLength.${r.id}.minutes`;
    return {
      id: r.id,
      name: t(r.nameKey),
      desc: t(r.descKey),
      minutes: hasString(minutesKey) ? t(minutesKey) : '',
      score: t('ui.sprint.length.score', { mult: multiplierText(r.scoreMultiplier) }),
    };
  });
}

/** Short name of the run's length ("Sprint"), or null when the pack has none. */
export function runLengthName(state: GameState, pack: ContentPack): string | null {
  const r = getRunLength(state, pack);
  return r ? t(r.nameKey) : null;
}

/**
 * "Frontier · Sprint · score ×0.6" for the end screen (the combined multiplier); null when the
 * pack has no run lengths (the difficulty line is shown alone then).
 */
export function runEndLine(state: GameState, pack: ContentPack): string | null {
  const r = getRunLength(state, pack);
  const d = getDifficulty(state, pack);
  if (!r || !d) return null;
  return t('ui.sprint.end.levelLine', { difficulty: t(d.nameKey), length: t(r.nameKey), mult: multiplierText(getScoreMultiplier(state, pack)) });
}
