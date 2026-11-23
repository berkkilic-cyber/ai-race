/**
 * Selectors inside a hidden tab hold their last value (useTabSelector): the frozen tab is
 * never asked to render by a store change, and computes afresh when shown again.
 */
import { act } from 'react';
import { createRoot } from 'test-renderer';

import { useGameStore, type GameStore } from '../../store/game';
import { TabActiveContext, useTabStore } from '../tabActive';

const speedOf = (s: GameStore) => s.speed;

describe('useTabStore', () => {
  afterEach(() => act(() => useGameStore.getState().setSpeed(1)));

  it('follows the store while active and holds still while hidden', () => {
    const seen: number[] = [];
    let calls = 0;
    const select = (s: GameStore) => {
      calls++;
      return speedOf(s);
    };
    function Probe() {
      seen.push(useTabStore(select));
      return null;
    }
    const root = createRoot();
    const view = (active: boolean) => (
      <TabActiveContext value={active}>
        <Probe />
      </TabActiveContext>
    );
    act(() => root.render(view(true)));
    act(() => useGameStore.getState().setSpeed(2));
    expect(seen[seen.length - 1]).toBe(2);

    act(() => root.render(view(false)));
    const renders = seen.length;
    const before = calls;
    act(() => useGameStore.getState().setSpeed(3));
    act(() => useGameStore.getState().setSpeed(0));
    // Hidden: no new value, no render, and the selector is not run.
    expect(seen.length).toBe(renders);
    expect(seen[seen.length - 1]).toBe(2);
    expect(calls).toBe(before);

    act(() => root.render(view(true)));
    expect(seen[seen.length - 1]).toBe(0);
    act(() => root.unmount());
  });

  it('is active outside the tabs', () => {
    let last = -1;
    function Probe() {
      last = useTabStore(speedOf);
      return null;
    }
    const root = createRoot();
    act(() => root.render(<Probe />));
    act(() => useGameStore.getState().setSpeed(3));
    expect(last).toBe(3);
    act(() => root.unmount());
  });
});
