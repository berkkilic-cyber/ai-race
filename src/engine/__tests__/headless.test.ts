import { runHeadless, summarizeRun, type BotPolicy, type EndingTrigger } from '@/engine';
import { testPack, testSetup } from '../__fixtures__/testPack';

const POLICIES: BotPolicy[] = ['sensible', 'random', 'idle', 'capability', 'reach', 'shadow'];

describe('runHeadless', () => {
  it.each(POLICIES)('terminates for policy %s across 20 seeds', (policy) => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = runHeadless(testPack, { ...testSetup, seed }, { policy, maxTicks: 6000 });
      expect(state.pendingEvent).toBeNull();
      expect(state.status === 'ended' || state.tick === 6000).toBe(true);
    }
  });

  it('onTick sees every tick once, after it is stepped', () => {
    const seen: number[] = [];
    const state = runHeadless(testPack, testSetup, { policy: 'idle', maxTicks: 30, onTick: (s) => seen.push(s.tick) });
    expect(seen).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(state.tick).toBe(30);
  });

  it('a tree-focused policy buys from its own tree first', () => {
    for (const tree of ['capability', 'reach', 'shadow'] as const) {
      const state = runHeadless(testPack, testSetup, { policy: tree, maxTicks: 300 });
      const first = testPack.nodes.find((n) => n.id === state.labs.player.ownedNodes[0]);
      expect({ tree, first: first?.tree }).toEqual({ tree, first: tree });
    }
  });

  it('stops at maxTicks without an ending', () => {
    const state = runHeadless(testPack, testSetup, { policy: 'idle', maxTicks: 50 });
    expect(state.tick).toBe(50);
    expect(state.status).toBe('running');
    expect(summarizeRun(state, testPack)).toMatchObject({ endingId: null, trigger: null, kind: null, ticks: 50, score: 0 });
  });

  it('summarizeRun reports ending, trigger, ticks, score, share, AGI progress and meters', () => {
    const state = runHeadless(testPack, testSetup, { policy: 'sensible', maxTicks: 6000 });
    const summary = summarizeRun(state, testPack);
    expect(summary.endingId).toBe(state.ending?.endingId);
    expect(summary.trigger).toBe(state.ending?.trigger);
    expect(summary.ticks).toBe(state.tick);
    expect(summary.score).toBe(state.ending?.score);
    expect(summary.agiProgress).toBe(state.labs.player.agiProgress);
    expect(summary.meters).toEqual({ regulation: state.labs.player.regulation, backlash: state.labs.player.backlash });
    expect(summary.worldShare).toBeGreaterThanOrEqual(0);
    expect(summary.worldShare).toBeLessThanOrEqual(1);
  });
});

describe('headless performance and pacing', () => {
  const RUNS = 200;
  const summaries: ReturnType<typeof summarizeRun>[] = [];
  let elapsedMs = 0;

  beforeAll(() => {
    const start = performance.now();
    for (let seed = 1; seed <= RUNS; seed++) {
      const founderId = seed % 2 === 0 ? 'dealer' : 'thinker';
      const state = runHeadless(testPack, { ...testSetup, seed, founderId }, { policy: 'sensible', maxTicks: 4000 });
      summaries.push(summarizeRun(state, testPack));
    }
    elapsedMs = performance.now() - start;
  });

  it(`${RUNS} sensible runs of the fixture pack finish well under 12 s`, () => {
    expect(summaries).toHaveLength(RUNS);
    expect(elapsedMs).toBeLessThan(12_000);
  });

  it('sensible runs end by a mix of endings between 1,500 and 4,500 ticks', () => {
    const triggers = new Set<EndingTrigger | null>(summaries.map((s) => s.trigger));
    expect(triggers.has(null)).toBe(false);
    expect(triggers.size).toBeGreaterThanOrEqual(3);
    const ticks = summaries.map((s) => s.ticks).sort((a, b) => a - b);
    const median = ticks[Math.floor(ticks.length / 2)];
    expect(median).toBeGreaterThanOrEqual(1500);
    expect(median).toBeLessThanOrEqual(4500);
  });
});
