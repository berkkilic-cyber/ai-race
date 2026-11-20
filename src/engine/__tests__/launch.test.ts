import { ENGINE_NEWS_KEYS, ENGINE_NEWS_KINDS, runHeadless, step, type GameState, type NewsItem } from '@/engine';
import { launchFlag } from '../step';
import { editLab, mustApply, newGame, PLAYER, quietPack, stepN } from '../__fixtures__/helpers';
import { momentPack, testPack, testSetup } from '../__fixtures__/testPack';

const launches = (state: GameState): NewsItem[] => state.news.filter((n) => n.kind === 'launch');

describe('model launch news', () => {
  const pack = quietPack();

  it('announces the player launch when the effective tier rises, not when a node is merely owned', () => {
    let state = mustApply(newGame(pack), pack, { type: 'buyNode', labId: PLAYER, nodeId: 'c1' });
    // c1 is owned but there is no compute: effective capability stays 0.
    state = stepN(state, pack, 5);
    expect(launches(state)).toEqual([]);
    state = mustApply(state, pack, { type: 'buildDataCentre', labId: PLAYER, regionId: 'north' });
    state = step(state, pack);
    expect(launches(state)).toEqual([
      {
        tick: state.tick,
        kind: 'launch',
        textKey: ENGINE_NEWS_KEYS.launchPlayer,
        tone: 'good',
        params: { lab: PLAYER, model: 'node.c1', tier: 1 },
        nodeId: 'c1',
        tier: 1,
        regionId: 'north',
        labId: PLAYER,
      },
    ]);
    expect(state.labs.player.flags).toContain(launchFlag(1));
  });

  it('announces once per tier even if the tier drops and comes back', () => {
    let state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.ownedNodes = ['c1'];
      lab.dataCentres = [{ id: 'dc', regionId: 'north', level: 1 }];
    });
    state = step(state, pack);
    expect(launches(state)).toHaveLength(1);
    // Data centre offline: tier back to 0, then online again.
    state = editLab(state, PLAYER, (lab) => (lab.dataCentres[0].disabledUntilTick = state.tick + 5));
    state = stepN(state, pack, 10);
    expect(launches(state)).toHaveLength(1);
  });

  it('a jump of several tiers announces only the new top tier and marks the skipped ones', () => {
    let state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.ownedNodes = ['c1', 'c2'];
      lab.dataCentres = [{ id: 'dc', regionId: 'north', level: 3 }];
    });
    state = step(state, pack);
    expect(launches(state).map((n) => [n.tier, n.nodeId, n.params?.model])).toEqual([[2, 'c2', 'node.c2']]);
    expect(state.labs.player.flags).toEqual(expect.arrayContaining([launchFlag(1), launchFlag(2)]));
  });

  it('announces when compute later catches up with an owned node', () => {
    let state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.ownedNodes = ['c1', 'c2'];
      lab.dataCentres = [{ id: 'dc', regionId: 'north', level: 1 }];
    });
    state = stepN(state, pack, 3);
    expect(launches(state).map((n) => n.tier)).toEqual([1]);
    state = editLab(state, PLAYER, (lab) => (lab.dataCentres[0].level = 3));
    state = step(state, pack);
    expect(launches(state).map((n) => n.tier)).toEqual([1, 2]);
  });

  it('announces rival launches with the rival key, bad tone and the rival home', () => {
    const rivals = { ...testPack, events: [], headlines: [] };
    let state = editLab(newGame(rivals), 'alpha', (lab) => {
      lab.ownedNodes = ['c1'];
      lab.dataCentres = [{ id: 'adc', regionId: 'east', level: 1 }];
    });
    state = step(state, rivals);
    const news = launches(state).filter((n) => n.labId === 'alpha');
    expect(news).toEqual([
      {
        tick: 1,
        kind: 'launch',
        textKey: ENGINE_NEWS_KEYS.launchRival,
        tone: 'bad',
        params: { lab: 'alpha', model: 'node.c1', tier: 1 },
        nodeId: 'c1',
        tier: 1,
        regionId: 'east',
        labId: 'alpha',
      },
    ]);
  });
});

describe('news kinds', () => {
  it('maps every engine news key to a kind', () => {
    expect(Object.keys(ENGINE_NEWS_KINDS).sort()).toEqual(Object.keys(ENGINE_NEWS_KEYS).sort());
  });

  it('every news item the engine emits carries a kind, across 200 headless runs', () => {
    const engineKind = new Map<string, string>(Object.entries(ENGINE_NEWS_KEYS).map(([name, key]) => [key, ENGINE_NEWS_KINDS[name as keyof typeof ENGINE_NEWS_KEYS]]));
    const kindless: string[] = [];
    const wrong: string[] = [];
    const seenKinds = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const seen = new Set<NewsItem>();
      runHeadless(momentPack, { ...testSetup, seed }, {
        policy: seed % 2 ? 'sensible' : 'random',
        maxTicks: 3000,
        onTick: (state) => {
          for (const item of state.news) {
            if (seen.has(item)) continue;
            seen.add(item);
            if (item.kind === undefined) kindless.push(item.textKey);
            else seenKinds.add(item.kind);
            const expected = engineKind.get(item.textKey);
            if (expected !== undefined && item.kind !== expected) wrong.push(`${item.textKey}: ${item.kind}`);
          }
        },
      });
    }
    expect(kindless).toEqual([]);
    expect(wrong).toEqual([]);
    expect([...seenKinds]).toEqual(expect.arrayContaining(['launch', 'headline', 'moment', 'entry']));
  });
});
