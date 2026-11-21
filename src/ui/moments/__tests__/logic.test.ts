import { createGame, type Effect } from '@/engine';

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
    // Every threat says what lands, whatever its effect kinds (meters, timed modifiers, sites ...).
    for (const def of pack.moments.filter((d) => d.kind === 'threat')) {
      const lines = effectLines(def.onExpire);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(l.good).toBe(false);
        expect(l.text).not.toMatch(/\{|\}|^(ui|term|stat|engine)\./);
      }
    }
    // A meter penalty reads as its own figure, taken from the pack.
    const meterThreat = pack.moments.find((d) => d.kind === 'threat' && (d.onExpire ?? []).some((e) => e.type === 'meter'));
    if (meterThreat) {
      const e = (meterThreat.onExpire ?? []).find((x) => x.type === 'meter') as Extract<Effect, { type: 'meter' }>;
      expect(effectLines([e])[0]).toEqual({ text: `+${Math.round(e.amount * 10) / 10} ${e.meter === 'backlash' ? 'Backlash' : 'Regulation'}`, good: false });
    }
  });

  it('describes every effect kind sensibly', () => {
    const all: Effect[] = [
      { type: 'resourcePercent', resource: 'hype', percent: -8 },
      { type: 'resource', resource: 'cash', amount: 5, scaleWithIncome: 10 },
      { type: 'timedModifier', modifier: { stat: 'agiRate', op: 'mul', value: 0.5 }, durationTicks: 10 },
      { type: 'timedModifier', modifier: { stat: 'backlashGain', op: 'mul', value: 0.5 }, durationTicks: 10 },
      { type: 'unban', scope: { kind: 'home' } },
      { type: 'ban', scope: { kind: 'home' }, durationTicks: 10 },
      { type: 'adoption', scope: { kind: 'home' }, factor: 0.5 },
      { type: 'dataCentre', action: 'disable', scope: { kind: 'home' }, durationTicks: 5 },
      { type: 'compute', amount: -2 },
      { type: 'agiProgress', amount: 1 },
    ];
    const lines = effectLines(all);
    expect(lines).toHaveLength(all.length);
    expect(lines.map((l) => l.good)).toEqual([false, true, false, true, true, false, false, false, false, true]);
    expect(lines[0].text).toBe('−8% Hype');
    for (const l of lines) expect(l.text).not.toMatch(/\{|\}|^(ui|term|stat|engine)\./);
    expect(effectLines([{ type: 'news', textKey: 'x' }, { type: 'meter', meter: 'backlash', amount: 1, target: 'leadRival' }])).toEqual([]);
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
