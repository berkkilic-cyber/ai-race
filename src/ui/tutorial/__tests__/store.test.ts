import type { Observation } from '../machine';
import { readValue, setStorageBackend, writeValue, type KeyValueBackend } from '../storage';
import { resetTutorialStore, TUTORIAL_DONE_KEY, useTutorialStore } from '../store';

const OBS: Observation = {
  running: true,
  seed: 1,
  eventPending: false,
  eventShowing: false,
  route: 'map',
  rootVisible: false,
  rootSheetOpen: false,
  rootOwned: false,
  canBuyRoot: true,
  dataCentres: 0,
  canBuildHome: true,
  homeSheetOpen: false,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeBackend(): KeyValueBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

beforeEach(() => {
  setStorageBackend(null);
  resetTutorialStore();
});

describe('tutorial storage', () => {
  it('keeps values in memory without a native module', async () => {
    await writeValue('k', 'v');
    expect(await readValue('k')).toBe('v');
    await writeValue('k', null);
    expect(await readValue('k')).toBeNull();
  });

  it('falls back to memory when the backend fails', async () => {
    setStorageBackend({
      getItem: () => Promise.reject(new Error('boom')),
      setItem: () => Promise.reject(new Error('boom')),
      removeItem: () => Promise.reject(new Error('boom')),
    });
    await expect(writeValue('k', '1')).resolves.toBeUndefined();
    expect(await readValue('k')).toBe('1');
  });
});

describe('tutorial store persistence', () => {
  it('runs on the first run and remembers it is done after skipping', async () => {
    const backend = fakeBackend();
    setStorageBackend(backend);
    await useTutorialStore.getState().load();
    expect(useTutorialStore.getState().tutorial.status).toBe('pending');
    useTutorialStore.getState().observe(OBS);
    expect(useTutorialStore.getState().tutorial.status).toBe('active');
    useTutorialStore.getState().skip();
    await flush();
    expect(backend.data.get(TUTORIAL_DONE_KEY)).toBe('1');

    // Next launch: done, does not start.
    resetTutorialStore();
    await useTutorialStore.getState().load();
    useTutorialStore.getState().observe(OBS);
    expect(useTutorialStore.getState().tutorial.status).toBe('done');
  });

  it('replay from the start screen clears the flag and runs at the next run', async () => {
    const backend = fakeBackend();
    backend.data.set(TUTORIAL_DONE_KEY, '1');
    setStorageBackend(backend);
    await useTutorialStore.getState().load();
    useTutorialStore.getState().replayNextRun();
    await flush();
    expect(backend.data.has(TUTORIAL_DONE_KEY)).toBe(false);
    useTutorialStore.getState().observe(OBS);
    expect(useTutorialStore.getState().tutorial.status).toBe('active');
  });

  it('replay from the shell starts at step 1 now', async () => {
    await useTutorialStore.getState().load();
    useTutorialStore.getState().skip();
    useTutorialStore.getState().replayNow(1);
    expect(useTutorialStore.getState().tutorial).toMatchObject({ status: 'active', step: 0 });
  });
});
