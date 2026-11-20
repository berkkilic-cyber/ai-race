import { defaultBalance, mergeBalance, step } from '@/engine';
import { newGame, quietPack, stepN, withBalance } from '../__fixtures__/helpers';

describe('balance', () => {
  it('every default is a finite, non-negative number (or list of them)', () => {
    for (const [key, value] of Object.entries(defaultBalance)) {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        expect({ key, ok: Number.isFinite(v) && v >= 0 }).toEqual({ key, ok: true });
      }
    }
  });

  it('a pack override is merged over the defaults', () => {
    const merged = mergeBalance({ firstEventTick: 5, newsLogSize: 9 });
    expect(merged).toEqual({ ...defaultBalance, firstEventTick: 5, newsLogSize: 9 });
  });

  it('the engine uses the pack overrides', () => {
    const base = quietPack();
    const fast = withBalance(quietPack({ events: [{ id: 'e', titleKey: 't', bodyKey: 'b', tone: 'neutral', weight: 1, once: false, conditions: [], choices: [{ id: 'a', labelKey: 'l', effects: [] }] }] }), { firstEventTick: 3 });
    expect(stepN(newGame(fast), fast, 3).pendingEvent).not.toBeNull();
    expect(step(newGame(base), base).pendingEvent).toBeNull();
  });
});
