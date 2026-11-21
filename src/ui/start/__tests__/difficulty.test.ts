import { createGame, type ContentPack } from '@/engine';

import { getPackEntry } from '../../packs';
import { setStorageBackend, writeValue } from '../../tutorial/storage';
import { TUTORIAL_DONE_KEY } from '../../tutorial/store';
import { playAgainSetup } from '../../end/logic';
import {
  DIFFICULTY_KEY,
  difficultyEndLine,
  difficultyOptions,
  difficultyParam,
  initialDifficulty,
  isDifficulty,
  loadDifficultyChoice,
  multiplierText,
  saveDifficultyChoice,
} from '../difficulty';

const { pack } = getPackEntry();
const ids = pack.difficulties!.map((d) => d.id);
const SETUP = { playerName: 'Moon Lab', founderId: 'hustler', homeRegion: 'canada', seed: 42 };

describe('difficulty selection', () => {
  it('the pack has four levels, easiest first, with a default among them', () => {
    expect(ids).toHaveLength(4);
    expect(isDifficulty(pack, pack.defaultDifficulty)).toBe(true);
    expect(isDifficulty(pack, 'nope')).toBe(false);
    expect(isDifficulty(pack, null)).toBe(false);
  });

  it('preselects the stored choice, else the easiest before the tutorial, else the default', () => {
    expect(initialDifficulty(pack, ids[2], false)).toBe(ids[2]);
    expect(initialDifficulty(pack, ids[2], true)).toBe(ids[2]);
    expect(initialDifficulty(pack, null, false)).toBe(ids[0]);
    expect(initialDifficulty(pack, null, true)).toBe(pack.defaultDifficulty);
    expect(initialDifficulty(pack, 'removed-level', true)).toBe(pack.defaultDifficulty);
    const none: ContentPack = { ...pack, difficulties: undefined, defaultDifficulty: undefined };
    expect(initialDifficulty(none, ids[2], true)).toBeUndefined();
  });

  it('reads the URL param only when it names a level', () => {
    expect(difficultyParam(pack, ids[3])).toBe(ids[3]);
    expect(difficultyParam(pack, [ids[1], ids[2]])).toBe(ids[1]);
    expect(difficultyParam(pack, 'impossible')).toBeUndefined();
    expect(difficultyParam(pack, undefined)).toBeUndefined();
  });

  it('remembers the last choice through the storage helper', async () => {
    setStorageBackend(null);
    expect(await loadDifficultyChoice(pack)).toBe(ids[0]);
    await writeValue(TUTORIAL_DONE_KEY, '1');
    expect(await loadDifficultyChoice(pack)).toBe(pack.defaultDifficulty);
    saveDifficultyChoice(ids[3]);
    await Promise.resolve();
    expect(await loadDifficultyChoice(pack)).toBe(ids[3]);
    await writeValue(DIFFICULTY_KEY, 'gone');
    expect(await loadDifficultyChoice(pack)).toBe(pack.defaultDifficulty);
  });

  it('lists name, description and score multiplier for each level', () => {
    const options = difficultyOptions(pack);
    expect(options.map((o) => o.id)).toEqual(ids);
    for (const o of options) {
      expect(o.name).not.toMatch(/difficulty\./);
      expect(o.desc.length).toBeGreaterThan(10);
      expect(o.score).toMatch(/×/);
    }
    expect(multiplierText(1.35)).toBe('1.35');
    expect(multiplierText(1)).toBe('1');
  });

  it('play again keeps the difficulty; the end line names it', () => {
    const state = createGame(pack, { ...SETUP, difficulty: ids[2] });
    expect(playAgainSetup(state, () => 0.5).difficulty).toBe(ids[2]);
    expect(difficultyEndLine(state, pack)).toMatch(/×/);
    const none: ContentPack = { ...pack, difficulties: undefined, defaultDifficulty: undefined };
    expect(difficultyEndLine(createGame(none, SETUP), none)).toBeNull();
  });
});
