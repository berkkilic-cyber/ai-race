import { checkConditions, type Condition, type GameState } from '@/engine';
import { edit, editLab, newGame, PLAYER } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

function holds(state: GameState, condition: Condition, labId = PLAYER): boolean {
  return checkConditions(state, testPack, labId, [condition]);
}

const base = editLab(newGame(testPack), PLAYER, (lab) => {
  lab.ownedNodes = ['c1', 'c2', 'r1'];
  lab.regulation = 30;
  lab.backlash = 60;
  lab.agiProgress = 45;
  lab.hype = 20;
  lab.cash = 75;
  lab.adoption = { north: 0.5, west: 0.25 }; // 400M users of 2700M
  lab.dataCentres = [{ id: 'a', regionId: 'north', level: 1 }, { id: 'b', regionId: 'west', level: 1 }];
  lab.flags = ['met'];
});
const state = edit(base, (s) => {
  s.tick = 100;
  s.labs.alpha.agiProgress = 70;
});

describe('conditions', () => {
  it('an empty list always holds; every condition must hold', () => {
    expect(checkConditions(state, testPack, PLAYER, [])).toBe(true);
    expect(checkConditions(state, testPack, PLAYER, [{ type: 'tickAtLeast', value: 50 }, { type: 'tickAtLeast', value: 500 }])).toBe(false);
  });

  it.each<[Condition, boolean]>([
    [{ type: 'tickAtLeast', value: 100 }, true],
    [{ type: 'tickAtLeast', value: 101 }, false],
    [{ type: 'tickAtMost', value: 100 }, true],
    [{ type: 'tickAtMost', value: 99 }, false],
    [{ type: 'hasNode', nodeId: 'c2' }, true],
    [{ type: 'hasNode', nodeId: 'c3' }, false],
    [{ type: 'lacksNode', nodeId: 'c3' }, true],
    [{ type: 'lacksNode', nodeId: 'c1' }, false],
    [{ type: 'nodesInTreeAtLeast', tree: 'capability', value: 2 }, true],
    [{ type: 'nodesInTreeAtLeast', tree: 'reach', value: 2 }, false],
    [{ type: 'meterAtLeast', meter: 'regulation', value: 30 }, true],
    [{ type: 'meterAtLeast', meter: 'backlash', value: 61 }, false],
    [{ type: 'meterAtLeast', meter: 'rival', value: 70 }, true],
    [{ type: 'meterAtMost', meter: 'regulation', value: 29 }, false],
    [{ type: 'meterAtMost', meter: 'backlash', value: 60 }, true],
    [{ type: 'meterAtMost', meter: 'rival', value: 69 }, false],
    [{ type: 'agiAtLeast', value: 45 }, true],
    [{ type: 'agiAtLeast', value: 46 }, false],
    [{ type: 'worldShareAtLeast', value: 400 / 2700 - 1e-9 }, true],
    [{ type: 'worldShareAtLeast', value: 0.2 }, false],
    [{ type: 'worldShareAtMost', value: 0.2 }, true],
    [{ type: 'worldShareAtMost', value: 0.1 }, false],
    [{ type: 'resourceAtLeast', resource: 'hype', value: 20 }, true],
    [{ type: 'resourceAtLeast', resource: 'cash', value: 76 }, false],
    [{ type: 'resourceAtMost', resource: 'cash', value: 75 }, true],
    [{ type: 'resourceAtMost', resource: 'hype', value: 19 }, false],
    [{ type: 'dataCentresAtLeast', value: 2 }, true],
    [{ type: 'dataCentresAtLeast', value: 3 }, false],
    [{ type: 'dataCentresAtMost', value: 2 }, true],
    [{ type: 'dataCentresAtMost', value: 1 }, false],
    [{ type: 'presentInRegion', scope: { kind: 'home' } }, true],
    [{ type: 'presentInRegion', scope: { kind: 'region', id: 'west' } }, true],
    [{ type: 'presentInRegion', scope: { kind: 'region', id: 'south' } }, false],
    [{ type: 'presentInRegion', scope: { kind: 'tag', tag: 'coastal' } }, true],
    [{ type: 'presentInRegion', scope: { kind: 'tag', tag: 'strict' } }, false],
    [{ type: 'presentInRegion', scope: { kind: 'all' } }, true],
    [{ type: 'presentInRegion', scope: { kind: 'random', count: 2 } }, true],
    [{ type: 'presentInRegion', scope: { kind: 'random', count: 3 } }, false],
    [{ type: 'presentInRegion', scope: { kind: 'random', count: 1, tag: 'strict' } }, false],
    [{ type: 'presentInRegion', scope: { kind: 'top', count: 2 } }, true],
    [{ type: 'presentInRegion', scope: { kind: 'top', count: 3 } }, false],
    [{ type: 'hasFlag', flag: 'met' }, true],
    [{ type: 'hasFlag', flag: 'canAcquire' }, false],
    [{ type: 'lacksFlag', flag: 'canAcquire' }, true],
    [{ type: 'lacksFlag', flag: 'met' }, false],
    [{ type: 'founderIs', founderId: 'thinker' }, true],
    [{ type: 'founderIs', founderId: 'dealer' }, false],
    [{ type: 'labNameIs', names: ['nobody', '  TESTER '] }, true],
    [{ type: 'labNameIs', names: ['nobody'] }, false],
    [{ type: 'endingIs', endingId: 'end_agi' }, false],
  ])('%j → %s', (condition, expected) => {
    expect(holds(state, condition)).toBe(expected);
  });

  it('hasFlag also sees flags granted by owned nodes', () => {
    expect(holds(editLab(state, PLAYER, (lab) => lab.ownedNodes.push('r3')), { type: 'hasFlag', flag: 'canAcquire' })).toBe(true);
  });

  it('endingIs matches the current ending', () => {
    const ended = edit(state, (s) => {
      s.ending = { endingId: 'end_agi', kind: 'win', trigger: 'agi', tick: 100, score: 1 };
    });
    expect(holds(ended, { type: 'endingIs', endingId: 'end_agi' })).toBe(true);
  });

  it("meter 'rival' with no active rival is 0", () => {
    const alone = edit(state, (s) => {
      s.labs.alpha.active = false;
    });
    expect(holds(alone, { type: 'meterAtMost', meter: 'rival', value: 0 })).toBe(true);
  });
});
