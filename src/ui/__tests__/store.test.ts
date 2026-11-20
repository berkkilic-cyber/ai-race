import { canApply, step, type GameState } from '@/engine';

import { useGameStore } from '../store/game';

const SETUP = { playerName: 'Test Lab', founderId: 'researcher', homeRegion: 'canada', seed: 42 };

function state(): GameState {
  const s = useGameStore.getState().state;
  if (!s) throw new Error('no run');
  return s;
}

/** Steps a run until an event is pending (engine-driven, no UI). */
function untilPendingEvent(s: GameState): GameState {
  const { pack } = useGameStore.getState();
  let next = s;
  for (let i = 0; i < 5000 && !next.pendingEvent && next.status === 'running'; i++) next = step(next, pack);
  if (!next.pendingEvent) throw new Error('no event drawn');
  return next;
}

beforeEach(() => {
  useGameStore.getState().reset();
});

describe('game store', () => {
  it('starts with no run', () => {
    expect(useGameStore.getState().state).toBeNull();
  });

  it('newGame creates a run at tick 0 and 1x speed', () => {
    useGameStore.getState().setSpeed(0);
    useGameStore.getState().newGame(SETUP);
    const s = state();
    expect(s.tick).toBe(0);
    expect(s.status).toBe('running');
    expect(s.labs[s.playerLabId].name).toBe('Test Lab');
    expect(s.labs[s.playerLabId].homeRegion).toBe('canada');
    expect(useGameStore.getState().speed).toBe(1);
    expect(useGameStore.getState().eventResult).toBeNull();
  });

  it('newGame without a seed picks one', () => {
    const { seed: _seed, ...rest } = SETUP;
    useGameStore.getState().newGame(rest);
    expect(Number.isInteger(state().seed)).toBe(true);
  });

  it('tick advances one day and keeps the old state untouched', () => {
    useGameStore.getState().newGame(SETUP);
    const before = state();
    useGameStore.getState().tick();
    expect(state().tick).toBe(1);
    expect(before.tick).toBe(0);
  });

  it('tick without a run does nothing', () => {
    useGameStore.getState().tick();
    expect(useGameStore.getState().state).toBeNull();
  });

  it('dispatch applies an affordable action', () => {
    useGameStore.getState().newGame(SETUP);
    const s = state();
    const { pack } = useGameStore.getState();
    const node = pack.nodes.find((n) => canApply(s, pack, { type: 'buyNode', labId: s.playerLabId, nodeId: n.id }).ok);
    expect(node).toBeDefined();
    const result = useGameStore.getState().dispatch({ type: 'buyNode', labId: s.playerLabId, nodeId: node!.id });
    expect(result).toEqual({ ok: true });
    expect(state().labs[s.playerLabId].ownedNodes).toContain(node!.id);
  });

  it('dispatch returns the failure reason and leaves the state unchanged', () => {
    useGameStore.getState().newGame(SETUP);
    const before = state();
    const { pack } = useGameStore.getState();
    const locked = pack.nodes.find((n) => n.requires.length > 0)!;
    const result = useGameStore.getState().dispatch({ type: 'buyNode', labId: before.playerLabId, nodeId: locked.id });
    expect(result).toEqual({ ok: false, reason: 'missingRequirement' });
    expect(state()).toBe(before);
  });

  it('dispatch without a run fails', () => {
    expect(useGameStore.getState().dispatch({ type: 'buyNode', labId: 'player', nodeId: 'x' }).ok).toBe(false);
  });

  it('setSpeed stores the speed', () => {
    useGameStore.getState().setSpeed(3);
    expect(useGameStore.getState().speed).toBe(3);
    useGameStore.getState().setSpeed(0);
    expect(useGameStore.getState().speed).toBe(0);
  });

  it('does not advance while an event is pending, and resolving shows the result once', () => {
    useGameStore.getState().newGame(SETUP);
    const pending = untilPendingEvent(state());
    useGameStore.setState({ state: pending });
    useGameStore.getState().tick();
    expect(state()).toBe(pending);

    const { pack } = useGameStore.getState();
    const event = pack.events.find((e) => e.id === pending.pendingEvent!.eventId)!;
    const choice = event.choices.find((c) => canApply(pending, pack, { type: 'resolveEvent', labId: pending.playerLabId, choiceId: c.id }).ok)!;
    expect(useGameStore.getState().dispatch({ type: 'resolveEvent', labId: pending.playerLabId, choiceId: choice.id })).toEqual({ ok: true });
    expect(state().pendingEvent).toBeNull();
    const result = useGameStore.getState().eventResult;
    if (choice.resultKey || choice.risk) expect(result?.eventId).toBe(event.id);
    useGameStore.getState().dismissEventResult();
    expect(useGameStore.getState().eventResult).toBeNull();

    useGameStore.getState().tick();
    expect(state().tick).toBe(pending.tick + 1);
  });

  it('other actions are refused while an event is pending', () => {
    useGameStore.getState().newGame(SETUP);
    const pending = untilPendingEvent(state());
    useGameStore.setState({ state: pending });
    const r = useGameStore.getState().dispatch({ type: 'launchInRegion', labId: pending.playerLabId, regionId: 'usa' });
    expect(r).toEqual({ ok: false, reason: 'eventPending' });
  });

  it('reset drops the run', () => {
    useGameStore.getState().newGame(SETUP);
    useGameStore.getState().reset();
    expect(useGameStore.getState().state).toBeNull();
  });
});
