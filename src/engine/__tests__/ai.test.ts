import { chooseAiActions, chooseEventChoice, DEFAULT_PERSONALITY, type Action, type EventDef } from '@/engine';
import { deepFreeze, edit, editLab, newGame, PLAYER, quietPack } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

const pack = quietPack({ rivals: testPack.rivals });

describe('AI controller', () => {
  it('is a pure read: the same state gives the same actions and is not mutated', () => {
    const state = deepFreeze(editLab(newGame(pack), 'alpha', (l) => ((l.hype = 100), (l.cash = 500))));
    expect(chooseAiActions(state, pack, 'alpha')).toEqual(chooseAiActions(state, pack, 'alpha'));
  });

  it('builds compute first when it has none', () => {
    const state = editLab(newGame(pack), 'alpha', (l) => (l.cash = 500));
    const actions = chooseAiActions(state, pack, 'alpha');
    expect(actions.some((a) => a.type === 'buildDataCentre' && a.regionId === 'east')).toBe(true);
  });

  it('personality weights which tree it buys from', () => {
    const buys = (personality: typeof DEFAULT_PERSONALITY) => {
      const state = editLab(newGame(pack), 'alpha', (l) => {
        l.hype = 13;
        l.cash = 0;
        l.personality = personality;
      });
      return chooseAiActions(state, pack, 'alpha').find((a): a is Extract<Action, { type: 'buyNode' }> => a.type === 'buyNode')?.nodeId;
    };
    expect(buys({ capability: 0.01, reach: 0.01, shadow: 5, expansion: 0 })).toBe('s1');
    expect(buys({ capability: 0.01, reach: 5, shadow: 0.01, expansion: 0 })).toBe('r1');
    expect(buys({ capability: 5, reach: 0.01, shadow: 0.01, expansion: 0 })).toBe('c1');
  });

  it('never spends beyond its means within one decision', () => {
    const state = editLab(newGame(pack), 'alpha', (l) => ((l.hype = 9), (l.cash = 60)));
    const actions = chooseAiActions(state, pack, 'alpha');
    expect(actions.filter((a) => a.type === 'buyNode')).toHaveLength(1);
  });

  it('acquires a rival when it can afford one', () => {
    const state = editLab(newGame(pack), PLAYER, (l) => ((l.ownedNodes = ['r1', 'r2', 'r3']), (l.cash = 1e6)));
    expect(chooseAiActions(state, pack, PLAYER)).toContainEqual({ type: 'acquireRival', labId: PLAYER, targetLabId: 'alpha' });
  });

  it('returns nothing for inactive labs or ended runs', () => {
    expect(chooseAiActions(newGame(pack), pack, 'beta')).toEqual([]);
    expect(chooseAiActions(edit(newGame(pack), (s) => (s.status = 'ended')), pack, 'alpha')).toEqual([]);
  });
});

describe('event choices for bots', () => {
  const card: EventDef = {
    id: 'card', titleKey: 't', bodyKey: 'b', tone: 'neutral', weight: 1, once: false, conditions: [],
    choices: [
      { id: 'bad', labelKey: 'a', effects: [{ type: 'meter', meter: 'backlash', amount: 15 }] },
      { id: 'good', labelKey: 'b', effects: [{ type: 'resource', resource: 'hype', amount: 10 }] },
      { id: 'great', labelKey: 'c', cost: { cash: 1e9 }, effects: [{ type: 'agiProgress', amount: 50 }] },
    ],
  };
  const cardPack = quietPack({ events: [card] });
  const pending = edit(newGame(cardPack), (s) => (s.pendingEvent = { eventId: 'card', labId: PLAYER }));

  it('sensible picks the affordable choice with the best heuristic value', () => {
    expect(chooseEventChoice(pending, cardPack, PLAYER, 'sensible')).toBe('good');
    expect(chooseAiActions(pending, cardPack, PLAYER)).toEqual([{ type: 'resolveEvent', labId: PLAYER, choiceId: 'good' }]);
  });

  it('idle picks the first available choice; random picks an available one', () => {
    expect(chooseEventChoice(pending, cardPack, PLAYER, 'idle')).toBe('bad');
    expect(['bad', 'good']).toContain(chooseEventChoice(pending, cardPack, PLAYER, 'random'));
  });

  it('values every effect type and target without crashing', () => {
    for (const event of testPack.events) {
      const state = edit(newGame(testPack), (s) => (s.pendingEvent = { eventId: event.id, labId: PLAYER }));
      for (const policy of ['sensible', 'random', 'idle'] as const) {
        expect(event.choices.map((c) => c.id)).toContain(chooseEventChoice(state, testPack, PLAYER, policy));
      }
    }
  });

  it('returns undefined when there is no pending card', () => {
    expect(chooseEventChoice(newGame(cardPack), cardPack, PLAYER)).toBeUndefined();
  });
});
