import { defaultBalance, ENGINE_NEWS_KEYS, step, type ContentPack, type GameState } from '@/engine';
import { edit, editLab, newGame, PLAYER, quietPack, stepN } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

const pack: ContentPack = { ...quietPack({ rivals: testPack.rivals, achievements: testPack.achievements }), endings: testPack.endings };

function endAfterOneTick(state: GameState, p: ContentPack = pack): GameState {
  const next = step(state, p);
  expect(next.status).toBe('ended');
  return next;
}

describe('endings', () => {
  it('player regulation 100 → banned (lose)', () => {
    const state = endAfterOneTick(editLab(newGame(pack), PLAYER, (l) => (l.regulation = 100)));
    expect(state.ending).toMatchObject({ endingId: 'end_banned', kind: 'lose', trigger: 'banned', tick: 1 });
    expect(state.ending?.winnerLabId).toBeUndefined();
  });

  it('player backlash 100 → revolt (lose)', () => {
    const state = endAfterOneTick(editLab(newGame(pack), PLAYER, (l) => (l.backlash = 100)));
    expect(state.ending).toMatchObject({ endingId: 'end_revolt', trigger: 'revolt' });
  });

  it('a rival reaching AGI first → rivalAgi, with that rival as winner', () => {
    const state = endAfterOneTick(editLab(newGame(pack), 'alpha', (l) => (l.agiProgress = 100)));
    expect(state.ending).toMatchObject({ endingId: 'end_rival_agi', kind: 'lose', trigger: 'rivalAgi', winnerLabId: 'alpha' });
  });

  it('rivalAgi is checked before the player reaching AGI', () => {
    let state = editLab(newGame(pack), 'alpha', (l) => (l.agiProgress = 100));
    state = editLab(state, PLAYER, (l) => (l.agiProgress = 100));
    expect(endAfterOneTick(state).ending?.trigger).toBe('rivalAgi');
  });

  it('player AGI → agi; the conditional variant is chosen when its conditions hold', () => {
    const early = endAfterOneTick(editLab(newGame(pack), PLAYER, (l) => (l.agiProgress = 100)));
    expect(early.ending).toMatchObject({ endingId: 'end_agi_fast', kind: 'win', trigger: 'agi', winnerLabId: PLAYER });
    const late = endAfterOneTick(edit(editLab(newGame(pack), PLAYER, (l) => (l.agiProgress = 100)), (s) => (s.tick = 3000)));
    expect(late.ending?.endingId).toBe('end_agi');
  });

  it('every rival eliminated or acquired (after all have entered) → monopoly', () => {
    let state = edit(newGame(pack), (s) => {
      s.labs.alpha.active = false;
      s.labs.alpha.eliminated = { reason: 'acquired', tick: 0, byLabId: PLAYER };
    });
    state = step(state, pack);
    expect(state.status).toBe('running'); // beta has not entered yet
    state = edit(state, (s) => {
      s.labs.beta.eliminated = { reason: 'revolt', tick: 1 };
    });
    expect(endAfterOneTick(state).ending).toMatchObject({ endingId: 'end_monopoly', trigger: 'monopoly', kind: 'win' });
  });

  it('no monopoly in a run without rivals', () => {
    const solo = { ...pack, rivals: [] };
    expect(stepN(newGame(solo), solo, 5).status).toBe('running');
  });

  it('player world share ≥ dependenceShare → dependence', () => {
    const state = endAfterOneTick(editLab(newGame(pack), PLAYER, (l) => (l.adoption = { north: 1, west: 1, east: 1 })));
    expect(state.ending).toMatchObject({ endingId: 'end_dependence', trigger: 'dependence' });
  });

  it('an ended run clears the pending event and stops stepping', () => {
    const state = endAfterOneTick(edit(editLab(newGame(pack), PLAYER, (l) => (l.regulation = 100)), (s) => (s.nextEventTick = 1)));
    expect(state.pendingEvent).toBeNull();
    expect(step(state, pack)).toBe(state);
  });

  it('falls back to the trigger as id when the pack has no matching ending', () => {
    const bare = { ...pack, endings: [] };
    const state = endAfterOneTick(editLab(newGame(bare), PLAYER, (l) => (l.backlash = 100)), bare);
    expect(state.ending).toMatchObject({ endingId: 'revolt', kind: 'lose' });
  });

  it('score rewards wins, share, AGI, nodes and speed', () => {
    const b = defaultBalance;
    const lose = endAfterOneTick(editLab(newGame(pack), PLAYER, (l) => ((l.backlash = 100), (l.adoption = {}), (l.stats.nodesBought = 1))));
    expect(lose.ending?.score).toBe(Math.round(b.scorePerNode));
    const win = endAfterOneTick(editLab(newGame(pack), PLAYER, (l) => ((l.agiProgress = 100), (l.adoption = {}))));
    expect(win.ending?.score).toBe(Math.round(b.scoreWin + 100 * b.scorePerAgi + (b.scoreTargetTicks - 1) * b.scorePerTickSaved));
  });
});

describe('achievements', () => {
  it("'tick' achievements are earned as soon as their conditions hold, once, with news", () => {
    let state = step(editLab(newGame(pack), PLAYER, (l) => (l.dataCentres = [{ id: 'a', regionId: 'north', level: 1 }])), pack);
    expect(state.achievements).toEqual(['ach_first_site']);
    expect(state.news.filter((n) => n.textKey === ENGINE_NEWS_KEYS.achievement)).toHaveLength(1);
    state = step(state, pack);
    expect(state.achievements).toEqual(['ach_first_site']);
  });

  it("'end' achievements are tested only when the run ends", () => {
    const running = step(editLab(newGame(pack), PLAYER, (l) => (l.agiProgress = 99.9999)), { ...pack, endings: [] });
    expect(running.achievements).not.toContain('ach_any_win_agi');
    const ended = endAfterOneTick(editLab(newGame(pack), PLAYER, (l) => (l.agiProgress = 100)));
    expect(ended.achievements).toContain('ach_any_win_agi');
  });

  it("'end' achievements can test the ending with endingIs", () => {
    const withEndingAch = { ...pack, achievements: [{ id: 'banned_ach', nameKey: 'n', descKey: 'd', secret: true, checkAt: 'end' as const, conditions: [{ type: 'endingIs' as const, endingId: 'end_banned' }] }] };
    const state = endAfterOneTick(editLab(newGame(withEndingAch), PLAYER, (l) => (l.regulation = 100)), withEndingAch);
    expect(state.achievements).toEqual(['banned_ach']);
  });
});
