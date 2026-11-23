import { createGame, getFounderStart, getIncome, getModifierTotal, PERMANENT_UNTIL_TICK, runHeadless, step, type ContentPack, type DifficultyDef, type GameSetup } from '@/engine';
import { clone, PLAYER, stepN } from '../__fixtures__/helpers';
import { testPack, testSetup } from '../__fixtures__/testPack';

const poor: DifficultyDef = { id: 'poor', nameKey: 'd.poor', descKey: 'd.poor.desc', scoreMultiplier: 1, balance: { playerStartHypeFactor: 0.5, playerStartCashFactor: 0.5 } };
const pack: ContentPack = { ...testPack, difficulties: [poor], defaultDifficulty: 'poor' };

function game(setup: Partial<GameSetup> = {}, p: ContentPack = testPack) {
  return createGame(p, { ...testSetup, ...setup });
}

describe('GameSetup.bonus: start bonuses earned outside the run', () => {
  it('absent, empty or zero bonus gives a bit-identical game', () => {
    const plain = game();
    for (const bonus of [{}, { modifiers: [] }, { startHype: 0, startCash: 0, modifiers: [] }]) {
      expect(JSON.stringify(game({ bonus }))).toBe(JSON.stringify(plain));
      expect(JSON.stringify(stepN(game({ bonus }), testPack, 200))).toBe(JSON.stringify(stepN(plain, testPack, 200)));
    }
  });

  it('adds start Hype and Cash to the human lab only', () => {
    const plain = game();
    const bonus = game({ bonus: { startHype: 5, startCash: 30 } });
    expect(bonus.labs[PLAYER].hype).toBe(plain.labs[PLAYER].hype + 5);
    expect(bonus.labs[PLAYER].cash).toBe(plain.labs[PLAYER].cash + 30);
    for (const id of plain.labOrder.filter((id) => id !== PLAYER)) {
      expect(bonus.labs[id].hype).toBe(plain.labs[id].hype);
      expect(bonus.labs[id].cash).toBe(plain.labs[id].cash);
      expect(bonus.labs[id].timedModifiers).toEqual([]);
    }
  });

  it('adds the flat amounts after the difficulty start factors', () => {
    const start = getFounderStart(pack, testSetup.founderId, 'poor');
    const state = game({ bonus: { startHype: 4, startCash: 10 } }, pack);
    expect(state.labs[PLAYER].hype).toBe(start.hype + 4);
    expect(state.labs[PLAYER].cash).toBe(start.cash + 10);
  });

  it('never starts below zero and ignores non-finite amounts', () => {
    const plain = game();
    const state = game({ bonus: { startHype: -1e9, startCash: Number.NaN, modifiers: [{ stat: 'cashIncome', op: 'add', value: Number.POSITIVE_INFINITY }] } });
    expect(state.labs[PLAYER].hype).toBe(0);
    expect(state.labs[PLAYER].cash).toBe(plain.labs[PLAYER].cash);
    expect(state.labs[PLAYER].timedModifiers).toEqual([]);
  });

  it('appends the modifiers as permanent ones that act with the founder perk', () => {
    const plain = game();
    const state = game({ bonus: { modifiers: [{ stat: 'hypeIncome', op: 'add', value: 0.1 }] } });
    expect(state.labs[PLAYER].timedModifiers).toEqual([{ modifier: { stat: 'hypeIncome', op: 'add', value: 0.1 }, untilTick: PERMANENT_UNTIL_TICK }]);
    expect(getModifierTotal(state, testPack, PLAYER, 'hypeIncome')).toBeCloseTo(getModifierTotal(plain, testPack, PLAYER, 'hypeIncome') * 1.1, 10);
    // The founder's own perk still counts (thinker: agiRate +0.1).
    expect(getModifierTotal(state, testPack, PLAYER, 'agiRate')).toBeCloseTo(getModifierTotal(plain, testPack, PLAYER, 'agiRate'), 10);
    expect(getIncome(state, testPack, PLAYER).hype).toBeGreaterThan(getIncome(plain, testPack, PLAYER).hype);
    // Still there late in the run.
    const later = stepN(state, testPack, 500);
    expect(later.labs[PLAYER].timedModifiers.some((t) => t.untilTick === PERMANENT_UNTIL_TICK)).toBe(true);
  });

  it('does not share the modifier objects with the setup', () => {
    const modifiers = [{ stat: 'cashIncome' as const, op: 'add' as const, value: 0.05 }];
    const state = game({ bonus: { modifiers } });
    modifiers[0].value = 9;
    expect(state.labs[PLAYER].timedModifiers[0].modifier.value).toBe(0.05);
  });

  it('survives a JSON save and resume: the resumed run plays exactly the same ticks', () => {
    const start = game({ bonus: { startHype: 3, startCash: 20, modifiers: [{ stat: 'cashIncome', op: 'add', value: 0.05 }] } });
    const mid = stepN(start, testPack, 150);
    const resumed = clone(mid);
    expect(resumed).toEqual(mid);
    expect(JSON.stringify(stepN(resumed, testPack, 300))).toBe(JSON.stringify(stepN(mid, testPack, 300)));
  });

  it('is deterministic: the same seed and bonus give the same run', () => {
    const setup: GameSetup = { ...testSetup, seed: 42, bonus: { startHype: 3, startCash: 20, modifiers: [{ stat: 'hypeIncome', op: 'add', value: 0.05 }] } };
    const a = runHeadless(testPack, setup, { policy: 'sensible', maxTicks: 1500 });
    const b = runHeadless(testPack, clone(setup), { policy: 'sensible', maxTicks: 1500 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a bonus changes the run (more cash after the same ticks)', () => {
    const plain = step(game(), testPack);
    const bonus = step(game({ bonus: { startCash: 50 } }), testPack);
    expect(bonus.labs[PLAYER].cash).toBeGreaterThan(plain.labs[PLAYER].cash);
  });
});
