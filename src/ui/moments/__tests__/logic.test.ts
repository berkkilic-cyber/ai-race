import { createGame } from '@/engine';

import { setI18nContext } from '../../i18n';
import { getPackEntry } from '../../packs';
import { assignSlots, bubbleOffset, collectLines, deltaLines, effectLines, lifetimeAt, snapshot, type Snapshot } from '../logic';

const { pack } = getPackEntry();
setI18nContext(pack, null);

const base: Snapshot = { hype: 10, cash: 100, compute: 5, users: 1, regulation: 20, backlash: 30, agi: 4 };

describe('bubble slots', () => {
  it('gives each moment of a region its own slot and keeps existing slots', () => {
    const a = assignSlots([{ uid: 'a', regionId: 'r1' }, { uid: 'b', regionId: 'r1' }, { uid: 'c', regionId: 'r2' }], new Map());
    expect([a.get('a'), a.get('b'), a.get('c')]).toEqual([0, 1, 0]);
    // 'a' leaves: 'b' keeps slot 1, a newcomer takes the free slot 0.
    const b = assignSlots([{ uid: 'b', regionId: 'r1' }, { uid: 'd', regionId: 'r1' }], a);
    expect([b.get('b'), b.get('d')]).toEqual([1, 0]);
  });

  it('floats the first bubble straight above the marker and others beside it', () => {
    expect(bubbleOffset(0)[0]).toBe(0);
    expect(bubbleOffset(0)[1]).toBeLessThan(0);
    expect(bubbleOffset(1)[0]).toBeLessThan(0);
    expect(bubbleOffset(2)[0]).toBeGreaterThan(0);
  });
});

describe('what a moment changed', () => {
  it('lists measured gains and losses with the right tone', () => {
    const lines = deltaLines(base, { ...base, cash: 113, hype: 22, backlash: 29 });
    expect(lines.map((l) => l.text)).toEqual(['+$13M', '+12 Hype', '−1 Backlash']);
    expect(lines.every((l) => l.good)).toBe(true);
    expect(deltaLines(base, { ...base, regulation: 21 })[0]).toEqual({ text: '+1 Regulation', good: false });
  });

  it('ignores changes too small to show', () => {
    expect(deltaLines(base, { ...base, cash: 100.01, hype: 10.01 })).toEqual([]);
  });

  it('describes an expiring threat from its own effects in the pack', () => {
    for (const def of pack.moments.filter((d) => d.kind === 'threat')) {
      expect(effectLines(def.onExpire).length).toBeGreaterThan(0);
    }
    expect(effectLines([{ type: 'meter', meter: 'backlash', amount: 0.9 }])).toEqual([{ text: '+0.9 Backlash', good: false }]);
    expect(effectLines([{ type: 'resourcePercent', resource: 'hype', percent: -8 }])).toEqual([{ text: '−8% Hype', good: false }]);
  });

  it('shows a contained threat as the penalty avoided when nothing was measured', () => {
    const threat = pack.moments.find((d) => d.kind === 'threat' && d.onCollect.length === 0)!;
    const out = collectLines(threat, base, base);
    expect(out.avoided).toBe(true);
    expect(out.lines.length).toBeGreaterThan(0);
    const boost = pack.moments.find((d) => d.kind === 'boost')!;
    expect(collectLines(boost, base, { ...base, cash: 120 })).toEqual({ lines: [{ text: '+$20M', good: true }], avoided: false });
  });

  it('snapshots the player from a real state', () => {
    const state = createGame(pack, { playerName: 'T', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed: 1 });
    const s = snapshot(state, pack);
    expect(s.cash).toBe(state.labs[state.playerLabId].cash);
    expect(Number.isFinite(s.compute)).toBe(true);
  });

  it('measures lifetime between ticks', () => {
    expect(lifetimeAt({ spawnTick: 10, expiresTick: 20 }, 15)).toBe(0.5);
    expect(lifetimeAt({ spawnTick: 10, expiresTick: 20 }, 25)).toBe(1);
    expect(lifetimeAt({ spawnTick: 10, expiresTick: 10 }, 10)).toBe(1);
  });
});
