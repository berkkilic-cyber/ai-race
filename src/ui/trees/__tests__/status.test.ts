import { canApply, createGame, step, type GameState } from '@/engine';

import { getPackEntry } from '../../packs';
import { createBuyableCounter, nodeStatus, treeNodes } from '../status';

const pack = getPackEntry().pack;

function newRun(): GameState {
  return createGame(pack, { playerName: 'Test', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed: 3 });
}

function bruteForce(state: GameState): number {
  return pack.nodes.filter((n) => canApply(state, pack, { type: 'buyNode', labId: state.playerLabId, nodeId: n.id }).ok).length;
}

describe('nodeStatus', () => {
  it('marks roots as buyable or expensive and the rest as locked at the start', () => {
    const state = newRun();
    for (const node of pack.nodes) {
      const status = nodeStatus(state, pack, node);
      if (node.requires.length > 0) expect(status).toBe('locked');
      else expect(['buyable', 'expensive']).toContain(status);
    }
  });

  it('marks bought nodes as owned', () => {
    let state = newRun();
    const root = pack.nodes.find((n) => n.requires.length === 0)!;
    const lab = state.labs[state.playerLabId];
    state = { ...state, labs: { ...state.labs, [lab.id]: { ...lab, ownedNodes: [root.id] } } };
    expect(nodeStatus(state, pack, root)).toBe('owned');
  });

  it('sorts tree nodes top to bottom, left to right', () => {
    const nodes = treeNodes(pack, 'reach');
    expect(nodes.length).toBeGreaterThan(0);
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1];
      const b = nodes[i];
      expect(a.row < b.row || (a.row === b.row && a.col < b.col)).toBe(true);
    }
  });
});

describe('createBuyableCounter', () => {
  it('matches canApply over every node through a run with purchases', () => {
    const count = createBuyableCounter();
    let state = newRun();
    const hype = { ...state.labs[state.playerLabId], hype: 30, cash: 500 };
    state = { ...state, labs: { ...state.labs, [hype.id]: hype } };
    for (let i = 0; i < 400 && state.status === 'running'; i++) {
      expect(count(state, pack).total).toBe(bruteForce(state));
      if (i % 25 === 0) {
        const node = pack.nodes.find((n) => canApply(state, pack, { type: 'buyNode', labId: state.playerLabId, nodeId: n.id }).ok);
        if (node) {
          const lab = state.labs[state.playerLabId];
          state = { ...state, labs: { ...state.labs, [lab.id]: { ...lab, ownedNodes: [...lab.ownedNodes, node.id] } } };
          expect(count(state, pack).total).toBe(bruteForce(state));
        }
      }
      state = step(state, pack);
      if (state.pendingEvent) {
        expect(count(state, pack).total).toBe(0);
        state = { ...state, pendingEvent: null };
      }
    }
  });

  it('splits counts by tree and returns zero without a run', () => {
    const count = createBuyableCounter();
    expect(count(null, pack).total).toBe(0);
    const state = newRun();
    const r = count(state, pack);
    expect(r.byTree.capability + r.byTree.reach + r.byTree.shadow).toBe(r.total);
  });

  it('returns the cached object while nothing relevant changes', () => {
    const count = createBuyableCounter();
    const state = newRun();
    const a = count(state, pack);
    const b = count({ ...state, tick: state.tick }, pack);
    expect(b).toBe(a);
  });
});
