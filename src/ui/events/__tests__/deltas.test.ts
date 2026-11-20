import { createGame, step, type GameState } from '@/engine';

import { getPackEntry } from '../../packs';
import { diffSnapshots, formatDelta, snapshotPlayer, type PlayerSnapshot } from '../deltas';

const { pack } = getPackEntry();

const BASE: PlayerSnapshot = {
  hype: 10,
  cash: 100,
  regulation: 20,
  backlash: 30,
  agi: 5,
  compute: 10,
  dataCentres: 3,
  offline: 0,
  banned: 0,
  worldShare: 0.02,
};

describe('diffSnapshots', () => {
  it('lists nothing when nothing changed', () => {
    expect(diffSnapshots(BASE, { ...BASE })).toEqual([]);
  });

  it('ignores noise below the thresholds', () => {
    expect(diffSnapshots(BASE, { ...BASE, hype: 10.01, cash: 100.02, worldShare: 0.0201 })).toEqual([]);
  });

  it('lists every change in a fixed order with good or bad from the player point of view', () => {
    const after: PlayerSnapshot = {
      hype: 30,
      cash: 60,
      regulation: 17,
      backlash: 35,
      agi: 7,
      compute: 8,
      dataCentres: 2,
      offline: 1,
      banned: 2,
      worldShare: 0.025,
    };
    const deltas = diffSnapshots(BASE, after);
    expect(deltas.map((d) => [d.id, d.good])).toEqual([
      ['hype', true],
      ['cash', false],
      ['regulation', true],
      ['backlash', false],
      ['agi', true],
      ['compute', false],
      ['dataCentresLost', false],
      ['offline', false],
      ['banned', false],
      ['worldShare', true],
    ]);
    const byId = Object.fromEntries(deltas.map((d) => [d.id, d.delta]));
    expect(byId.hype).toBe(20);
    expect(byId.cash).toBe(-40);
    expect(byId.dataCentresLost).toBe(1);
    expect(byId.banned).toBe(2);
    expect(byId.worldShare).toBeCloseTo(0.005);
  });

  it('does not report new data centres as lost', () => {
    expect(diffSnapshots(BASE, { ...BASE, dataCentres: 4 })).toEqual([]);
  });

  it('reports sites coming back online and bans lifted as good', () => {
    const deltas = diffSnapshots({ ...BASE, offline: 2, banned: 1 }, BASE);
    expect(deltas).toEqual([
      { id: 'offline', delta: -2, good: true },
      { id: 'banned', delta: -1, good: true },
    ]);
  });
});

describe('formatDelta', () => {
  it('formats each kind', () => {
    expect(formatDelta({ id: 'hype', delta: 20, good: true }, 'pts')).toBe('+20');
    expect(formatDelta({ id: 'cash', delta: -40, good: false }, 'pts')).toBe('−$40M');
    expect(formatDelta({ id: 'cash', delta: 1500, good: true }, 'pts')).toBe('+$1.5B');
    expect(formatDelta({ id: 'regulation', delta: -3, good: true }, 'pts')).toBe('−3');
    expect(formatDelta({ id: 'agi', delta: 1.25, good: true }, 'pts')).toBe('+1.3');
    expect(formatDelta({ id: 'compute', delta: -2, good: false }, 'pts')).toBe('−2');
    expect(formatDelta({ id: 'dataCentresLost', delta: 1, good: false }, 'pts')).toBe('1');
    expect(formatDelta({ id: 'offline', delta: 2, good: false }, 'pts')).toBe('+2');
    expect(formatDelta({ id: 'banned', delta: -1, good: true }, 'pts')).toBe('−1');
    expect(formatDelta({ id: 'worldShare', delta: 0.004, good: true }, 'pts')).toBe('+0.4 pts');
  });
});

describe('snapshotPlayer', () => {
  function run(): GameState {
    let s = createGame(pack, { playerName: 'Snap Lab', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed: 3 });
    for (let i = 0; i < 50; i++) s = step(s, pack);
    return s;
  }

  it('reads the player numbers through the selectors', () => {
    const s = run();
    const lab = s.labs[s.playerLabId];
    const snap = snapshotPlayer(s, pack);
    expect(snap.hype).toBe(lab.hype);
    expect(snap.cash).toBe(lab.cash);
    expect(snap.regulation).toBe(lab.regulation);
    expect(snap.dataCentres).toBe(lab.dataCentres.length);
    expect(snap.banned).toBe(0);
    expect(snap.worldShare).toBeGreaterThan(0);
  });

  it('counts active bans and offline sites, and diffs a real state change', () => {
    const s = run();
    const lab = s.labs[s.playerLabId];
    const region = Object.keys(lab.adoption)[0];
    const changed: GameState = {
      ...s,
      labs: {
        ...s.labs,
        [s.playerLabId]: {
          ...lab,
          cash: lab.cash - 25,
          bans: { ...lab.bans, [region]: s.tick + 100, expired: s.tick - 1 },
          dataCentres: lab.dataCentres.map((dc) => ({ ...dc, disabledUntilTick: s.tick + 10 })),
        },
      },
    };
    const after = snapshotPlayer(changed, pack);
    expect(after.banned).toBe(1);
    expect(after.offline).toBe(lab.dataCentres.length);
    const ids = diffSnapshots(snapshotPlayer(s, pack), after).map((d) => d.id);
    expect(ids).toContain('cash');
    expect(ids).toContain('banned');
  });
});
