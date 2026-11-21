import { getReachableRegions, step, type ContentPack, type GameState, type NodeDef, type RegionDef } from '@/engine';
import { applyEffect } from '../effects';
import { getContext } from '../context';
import { deepFreeze, edit, editLab, newGame, PLAYER, quietPack, stepN, withBalance } from '../__fixtures__/helpers';

function region(id: string, neighbors: string[], extra: Partial<RegionDef> = {}): RegionDef {
  return { id, nameKey: `region.${id}`, countries: [], population: 100, wealth: 0.5, openness: 1, strictness: 0.2, powerCost: 0.5, neighbors, tags: [], ...extra };
}

/** a - b - c - d in a line; b speaks another language; x sits across an ocean from a. */
const regions: RegionDef[] = [
  region('a', ['b', 'x'], { linkBarriers: { x: ['ocean'] } }),
  region('b', ['a', 'c'], { barriers: ['lang'] }),
  region('c', ['b', 'd']),
  region('d', ['c']),
  region('x', ['a'], { linkBarriers: { a: ['ocean'] } }),
];

const node = (id: string, channels: string[], col: number): NodeDef => ({
  id, tree: 'reach', nameKey: `node.${id}`, descKey: `node.${id}.desc`, cost: 1, requires: [], row: 1, col, modifiers: [], channels,
});

function channelPack(balance: ContentPack['balance'] = {}): ContentPack {
  const base = quietPack();
  return withBalance(
    {
      ...base,
      regions,
      nodes: [...base.nodes.filter((n) => n.tree !== 'reach'), node('n-lang', ['lang'], 1), node('n-ocean', ['ocean'], 2), node('n-viral', ['viral'], 3)],
      barriers: [
        { id: 'ocean', nameKey: 'barrier.ocean' },
        { id: 'lang', nameKey: 'barrier.lang' },
      ],
      channels: [
        { id: 'ocean', nameKey: 'channel.ocean', kind: 'clear', entryTextKey: 'channel.ocean.entry' },
        { id: 'lang', nameKey: 'channel.lang', kind: 'clear' },
        { id: 'viral', nameKey: 'channel.viral', kind: 'jump' },
        { id: 'open', nameKey: 'channel.open', kind: 'open' },
      ],
    },
    // Seeding always succeeds unless a barrier stops it; nothing else moves.
    { seedChance: 1, seedThreshold: 0, barrierSeedFactor: 0, viralSeedFactor: 1, openSeedFactor: 1, baseSpread: 0, regulationPerGrowth: 0, regulationPerShare: 0, ...balance },
  );
}

const start = (pack: ContentPack, nodes: string[] = [], flags: string[] = []): GameState =>
  editLab(newGame(pack, { homeRegion: 'a' }), PLAYER, (lab) => {
    lab.ownedNodes.push(...nodes);
    lab.flags.push(...flags);
  });

const present = (state: GameState, id: string) => (state.labs[PLAYER].adoption[id] ?? 0) > 0;
const entries = (state: GameState) => state.news.filter((n) => n.kind === 'entry');

describe('barriers', () => {
  it('a region barrier stops seeding without the matching channel', () => {
    const pack = channelPack();
    const s = stepN(start(pack), pack, 5);
    expect(present(s, 'b')).toBe(false);
    expect(present(s, 'x')).toBe(false);
  });

  it('multiplies the seed chance by barrierSeedFactor per uncleared barrier', () => {
    const pack = channelPack({ barrierSeedFactor: 1 });
    const s = stepN(start(pack), pack, 1);
    expect(present(s, 'b')).toBe(true);
    expect(present(s, 'x')).toBe(true);
    // Nothing was cleared by a channel, so no entry news.
    expect(entries(s)).toEqual([]);
  });
});

describe('channels', () => {
  it("a 'clear' channel lifts a region barrier and announces the entry once", () => {
    const pack = channelPack();
    let s = stepN(start(pack, ['n-lang']), pack, 1);
    expect(present(s, 'b')).toBe(true);
    expect(present(s, 'x')).toBe(false);
    expect(entries(s)).toHaveLength(1);
    expect(entries(s)[0]).toMatchObject({
      kind: 'entry',
      textKey: 'engine.news.entry.channel',
      tone: 'good',
      regionId: 'b',
      labId: PLAYER,
      params: { lab: PLAYER, region: 'b', from: 'a', channel: 'lang' },
    });
    // Lose the region and reseed it: no second item.
    s = edit(s, (st) => delete st.labs[PLAYER].adoption.b);
    s = stepN(s, pack, 2);
    expect(present(s, 'b')).toBe(true);
    expect(entries(s).filter((n) => n.regionId === 'b')).toHaveLength(1);
  });

  it('an ocean channel lets seeding cross a sea link, with its own entry text', () => {
    const pack = channelPack();
    const s = stepN(start(pack, ['n-ocean']), pack, 1);
    expect(present(s, 'x')).toBe(true);
    expect(entries(s).find((n) => n.regionId === 'x')).toMatchObject({ textKey: 'channel.ocean.entry', params: { channel: 'ocean', from: 'a' } });
  });

  it("a 'jump' channel seeds two links away, skipping the blocked neighbour", () => {
    const pack = channelPack();
    const s = stepN(start(pack, ['n-viral']), pack, 1);
    expect(present(s, 'b')).toBe(false);
    expect(present(s, 'c')).toBe(true);
    expect(entries(s).find((n) => n.regionId === 'c')).toMatchObject({ params: { channel: 'viral', from: 'a', via: 'b' } });
    // Without the channel c stays out of reach.
    expect(present(stepN(start(pack), pack, 3), 'c')).toBe(false);
  });

  it("an 'open' channel raises the holder's seeding and every rival's spread", () => {
    const pack = channelPack({ barrierSeedFactor: 0.5, openSeedFactor: 2 });
    for (let seed = 1; seed <= 10; seed++) {
      const s = step(editLab(newGame(pack, { homeRegion: 'a', seed }), PLAYER, (lab) => lab.flags.push('channel:open')), pack);
      expect(present(s, 'b')).toBe(true);
    }
    const misses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((seed) => !present(step(newGame(pack, { homeRegion: 'a', seed }), pack), 'b'));
    expect(misses.length).toBeGreaterThan(0);

    const rivalPack: ContentPack = withBalance(
      { ...channelPack({ baseSpread: 0.01, seedChance: 0 }), rivals: [{ id: 'r', nameKey: 'rival.r', color: '#123456', homeRegion: 'd', personality: { capability: 1, reach: 1, shadow: 1, expansion: 0 }, entryTick: 0 }] },
      { aiDecisionInterval: 100000 },
    );
    const rivalAfter = (flags: string[]) => stepN(start(rivalPack, [], flags), rivalPack, 30).labs.r.adoption.d;
    expect(rivalAfter(['channel:open'])).toBeGreaterThan(rivalAfter([]));
  });

  it('a timed channel flag grants the channel and expires', () => {
    const pack = channelPack();
    const context = getContext(pack);
    const s = edit(start(pack), (st) => applyEffect(st, context, st.labs[PLAYER], { type: 'setFlag', flag: 'channel:lang', durationTicks: 3 }));
    expect(s.labs[PLAYER].flagTimers).toEqual({ 'channel:lang': 3 });
    const one = step(s, pack);
    expect(present(one, 'b')).toBe(true);
    const later = stepN(one, pack, 3);
    expect(later.labs[PLAYER].flags).not.toContain('channel:lang');
    expect(later.labs[PLAYER].flagTimers).toBeUndefined();
  });

  it('a timed flag never shortens a permanent one', () => {
    const pack = channelPack();
    const context = getContext(pack);
    const s = edit(start(pack, [], ['channel:lang']), (st) => applyEffect(st, context, st.labs[PLAYER], { type: 'setFlag', flag: 'channel:lang', durationTicks: 3 }));
    expect(stepN(s, pack, 5).labs[PLAYER].flags).toContain('channel:lang');
  });

  it('is deterministic and never mutates its input', () => {
    const pack = channelPack({ barrierSeedFactor: 0.3, seedChance: 0.4, baseSpread: 0.01 });
    const s = deepFreeze(start(pack, ['n-viral', 'n-ocean']));
    expect(stepN(s, pack, 40)).toEqual(stepN(s, pack, 40));
  });
});

describe('getReachableRegions', () => {
  it('names the blocking barrier and the nodes that clear it', () => {
    const pack = channelPack();
    const rows = Object.fromEntries(getReachableRegions(start(pack), pack, PLAYER).map((r) => [r.regionId, r]));
    expect(rows.a).toMatchObject({ present: true, reachable: false });
    expect(rows.b).toMatchObject({ reachable: false, from: 'a', blockedBy: ['lang'], unlockedBy: { lang: ['n-lang'] } });
    expect(rows.x).toMatchObject({ reachable: false, blockedBy: ['ocean'], unlockedBy: { ocean: ['n-ocean'] } });
    expect(rows.c).toEqual({ regionId: 'c', present: false, reachable: false, banned: false });
  });

  it('marks regions reachable through channels, including jumps', () => {
    const pack = channelPack();
    const rows = Object.fromEntries(getReachableRegions(start(pack, ['n-lang', 'n-viral']), pack, PLAYER).map((r) => [r.regionId, r]));
    expect(rows.b).toMatchObject({ reachable: true, from: 'a', channel: 'lang' });
    expect(rows.b.blockedBy).toBeUndefined();
    expect(rows.c).toMatchObject({ reachable: true, from: 'a', via: 'b', channel: 'viral' });
  });

  it('a banned region is never reachable', () => {
    const pack = channelPack({ barrierSeedFactor: 1 });
    const s = editLab(start(pack), PLAYER, (lab) => (lab.bans.b = -1));
    expect(getReachableRegions(s, pack, PLAYER).find((r) => r.regionId === 'b')).toMatchObject({ reachable: false, banned: true });
  });
});
