import { setStorageBackend } from '../../tutorial/storage';
import { resetTutorialStore, useTutorialStore } from '../../tutorial/store';
import { useGameStore } from '../../store/game';
import { closeRunMenu, openRunMenu, useRunMenuStore } from '../RunMenu';

const SETUP = { playerName: 'Menu Lab', founderId: 'researcher', homeRegion: 'canada', seed: 3 };

beforeEach(() => {
  setStorageBackend(null);
  resetTutorialStore();
  useGameStore.getState().reset();
  useRunMenuStore.setState({ open: false, prevSpeed: 1, confirm: null });
});

describe('run menu pause', () => {
  it('opening pauses; Resume gives the previous speed back', () => {
    useGameStore.getState().newGame(SETUP);
    useGameStore.getState().setSpeed(3);
    openRunMenu();
    expect(useRunMenuStore.getState().open).toBe(true);
    expect(useGameStore.getState().speed).toBe(0);
    closeRunMenu();
    expect(useGameStore.getState().speed).toBe(3);
  });

  it('Resume plays at 1x when the run was paused before, unless a tutorial caption holds the pause', () => {
    useGameStore.getState().newGame(SETUP);
    useGameStore.getState().setSpeed(0);
    openRunMenu();
    closeRunMenu();
    expect(useGameStore.getState().speed).toBe(1);
    useGameStore.getState().setSpeed(0);
    useTutorialStore.setState({ showing: true });
    openRunMenu();
    closeRunMenu();
    expect(useGameStore.getState().speed).toBe(0);
  });

  it('does nothing without a run in progress', () => {
    openRunMenu();
    expect(useRunMenuStore.getState().open).toBe(false);
  });
});
