import { createGame, type Condition, type GameState } from '@/engine';

import { setI18nContext } from '../../i18n';
import { getPackEntry } from '../../packs';
import { conditionValues, describeCondition, explainConditions } from '../conditions';

const pack = getPackEntry().pack;

function game(): GameState {
  const state = createGame(pack, { playerName: 'Test Lab', founderId: pack.founders[0].id, homeRegion: 'usa', seed: 3 });
  const lab = { ...state.labs[state.playerLabId], hype: 12, cash: 12, regulation: 62, backlash: 10, agiProgress: 4 };
  return { ...state, tick: 99, labs: { ...state.labs, [lab.id]: lab } };
}

beforeAll(() => setI18nContext(pack, null));

/** One example of every Condition type: the Record makes the compiler insist on all of them. */
const EVERY: Record<Condition['type'], Condition> = {
  tickAtLeast: { type: 'tickAtLeast', value: 199 },
  tickAtMost: { type: 'tickAtMost', value: 499 },
  hasNode: { type: 'hasNode', nodeId: 'cap-safety-team' },
  lacksNode: { type: 'lacksNode', nodeId: 'shadow-nda' },
  nodesInTreeAtLeast: { type: 'nodesInTreeAtLeast', tree: 'shadow', value: 3 },
  meterAtLeast: { type: 'meterAtLeast', meter: 'backlash', value: 40 },
  meterAtMost: { type: 'meterAtMost', meter: 'regulation', value: 50 },
  agiAtLeast: { type: 'agiAtLeast', value: 30 },
  worldShareAtLeast: { type: 'worldShareAtLeast', value: 0.2 },
  worldShareAtMost: { type: 'worldShareAtMost', value: 0.5 },
  resourceAtLeast: { type: 'resourceAtLeast', resource: 'cash', value: 30 },
  resourceAtMost: { type: 'resourceAtMost', resource: 'hype', value: 100 },
  dataCentresAtLeast: { type: 'dataCentresAtLeast', value: 2 },
  dataCentresAtMost: { type: 'dataCentresAtMost', value: 5 },
  presentInRegion: { type: 'presentInRegion', scope: { kind: 'region', id: 'brazil' } },
  hasFlag: { type: 'hasFlag', flag: 'homeBanned' },
  lacksFlag: { type: 'lacksFlag', flag: 'podbay' },
  founderIs: { type: 'founderIs', founderId: pack.founders[1].id },
  labNameIs: { type: 'labNameIs', names: ['secret'] },
  endingIs: { type: 'endingIs', endingId: 'x' },
  bannedIn: { type: 'bannedIn', scope: { kind: 'home' } },
  statAtLeast: { type: 'statAtLeast', stat: 'nodesBought', value: 5 },
  statAtMost: { type: 'statAtMost', stat: 'momentsMissed', value: 3 },
  endingKindIs: { type: 'endingKindIs', kind: 'win' },
};

const EXPECTED: Record<Condition['type'], string> = {
  tickAtLeast: 'Only from day 200 (today is day 100)',
  tickAtMost: 'Only until day 500 (today is day 100)',
  hasNode: 'Needs the Safety Team upgrade (Capability tree)',
  lacksNode: `Only without the ${pack.strings.en['node.shadow-nda.name']} upgrade (Shadow tree)`,
  nodesInTreeAtLeast: 'Needs 3 Shadow upgrades (you have 0)',
  meterAtLeast: 'Needs Backlash at 40% or more (now 10%)',
  meterAtMost: 'Needs Regulation at 50% or less (now 62%)',
  agiAtLeast: 'Needs AGI progress of 30% (yours is 4%)',
  worldShareAtLeast: 'Needs 20% of the world using your model (you have 0%)',
  worldShareAtMost: 'Only while under 50% of the world uses your model (you have 0%)',
  resourceAtLeast: 'Needs $30M, you have $12M',
  resourceAtMost: 'Only with 100 Hype or less (you have 12 Hype)',
  dataCentresAtLeast: 'Needs 2 data centres (you have 0)',
  dataCentresAtMost: 'Only with 5 data centres or fewer (you have 0)',
  presentInRegion: `Needs users in ${pack.strings.en['region.brazil.name']}`,
  hasFlag: 'Only after your home region has banned you',
  lacksFlag: 'Only if it has not happened yet in this run',
  founderIs: `Only for the ${pack.strings.en[pack.founders[1].nameKey]} founder`,
  labNameIs: 'Only for a lab with a very particular name',
  endingIs: 'Only once the run is over',
  bannedIn: 'Only while you are banned in your home region',
  statAtLeast: 'Needs 5 upgrades bought (you have 0)',
  statAtMost: 'Only with 3 moments missed or fewer (you have 0)',
  endingKindIs: 'Only once the run is over',
};

describe('describeCondition', () => {
  const state = game();
  const values = conditionValues(state, pack, state.playerLabId);

  it.each(Object.keys(EVERY) as Condition['type'][])('%s', (type) => {
    const line = describeCondition(EVERY[type], values, pack);
    expect(line.text).toBe(EXPECTED[type]);
    expect(line.text).not.toMatch(/[{}]/);
  });

  it('describes the rival meter as the leading rival AGI', () => {
    expect(describeCondition({ type: 'meterAtLeast', meter: 'rival', value: 50 }, values, pack).text).toBe("Needs the leading rival's AGI at 50% or more (now 0%)");
  });

  it('formats Hype and Cash amounts in their own units', () => {
    expect(describeCondition({ type: 'resourceAtLeast', resource: 'hype', value: 40 }, values, pack).text).toBe('Needs 40 Hype, you have 12 Hype');
  });

  it('covers every requirement used in the pack', () => {
    for (const event of pack.events) {
      for (const choice of event.choices) {
        for (const cond of choice.requirements ?? []) expect(describeCondition(cond, values, pack).text).not.toMatch(/[{}]/);
      }
    }
  });
});

describe('explainConditions', () => {
  it('takes the verdict from the engine and only helps with unmet ones', () => {
    const state = game();
    const lines = explainConditions(state, pack, state.playerLabId, [
      { type: 'hasNode', nodeId: 'cap-safety-team' },
      { type: 'meterAtMost', meter: 'backlash', value: 50 },
      { type: 'resourceAtLeast', resource: 'cash', value: 30 },
    ]);
    expect(lines.map((l) => l.met)).toEqual([false, true, false]);
    expect(lines[0].help).toBe('Buy Safety Team in the Capability tree');
    expect(lines[1].help).toBeUndefined();
    expect(lines[2].help).toBeDefined();
  });

  it('marks an owned upgrade as met', () => {
    const state = game();
    const lab = { ...state.labs[state.playerLabId], ownedNodes: ['cap-model-1', 'cap-safety-team'] };
    const owned = { ...state, labs: { ...state.labs, [lab.id]: lab } };
    expect(explainConditions(owned, pack, lab.id, [{ type: 'hasNode', nodeId: 'cap-safety-team' }])).toEqual([{ text: 'Needs the Safety Team upgrade (Capability tree)', met: true }]);
  });

  it('is empty without conditions', () => {
    const state = game();
    expect(explainConditions(state, pack, state.playerLabId, [])).toEqual([]);
  });
});
