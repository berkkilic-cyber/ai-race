import type { AchievementDef } from '@/engine';

import { sortAchievements } from '../sort';
import { currentToast, dismissToast, EMPTY_QUEUE, enqueueToasts, newAchievementIds } from '../queue';

describe('newAchievementIds', () => {
  it('returns ids that were added, in order', () => {
    expect(newAchievementIds(['a'], ['a', 'b', 'c'])).toEqual(['b', 'c']);
    expect(newAchievementIds([], ['x'])).toEqual(['x']);
  });

  it('returns nothing for the same or an unchanged list', () => {
    const list = ['a', 'b'];
    expect(newAchievementIds(list, list)).toEqual([]);
    expect(newAchievementIds(list, list.slice())).toEqual([]);
  });
});

describe('toast queue', () => {
  it('shows toasts one at a time, oldest first', () => {
    let q = enqueueToasts(EMPTY_QUEUE, ['a', 'b']);
    q = enqueueToasts(q, ['c']);
    const first = currentToast(q, false);
    expect(first?.achievementId).toBe('a');
    q = dismissToast(q, first?.key ?? -1);
    expect(currentToast(q, false)?.achievementId).toBe('b');
    q = dismissToast(q, currentToast(q, false)?.key ?? -1);
    expect(currentToast(q, false)?.achievementId).toBe('c');
    q = dismissToast(q, currentToast(q, false)?.key ?? -1);
    expect(currentToast(q, false)).toBeNull();
  });

  it('shows nothing while blocked, and keeps the queue', () => {
    const q = enqueueToasts(EMPTY_QUEUE, ['a']);
    expect(currentToast(q, true)).toBeNull();
    expect(currentToast(q, false)?.achievementId).toBe('a');
  });

  it('skips ids already queued and gives each toast a unique key', () => {
    let q = enqueueToasts(EMPTY_QUEUE, ['a', 'a', 'b']);
    expect(q.toasts.map((t) => t.achievementId)).toEqual(['a', 'b']);
    expect(enqueueToasts(q, ['b'])).toBe(q);
    q = dismissToast(q, q.toasts[0].key);
    q = enqueueToasts(q, ['a']);
    const keys = q.toasts.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain(1);
  });

  it('ignores a dismiss for a key that is not queued', () => {
    const q = enqueueToasts(EMPTY_QUEUE, ['a']);
    expect(dismissToast(q, 999)).toBe(q);
  });
});

describe('sortAchievements', () => {
  const def = (id: string, secret = false): AchievementDef => ({ id, nameKey: id, descKey: id, secret, checkAt: 'tick', conditions: [] });
  it('lists earned (in order earned), then visible locked, then secret locked as hidden', () => {
    const defs = [def('a'), def('s1', true), def('b'), def('s2', true), def('c')];
    expect(sortAchievements(defs, ['c', 's2']).map((r) => `${r.def.id}:${r.state}`)).toEqual(['c:earned', 's2:earned', 'a:locked', 'b:locked', 's1:hidden']);
  });
});
