import { BUFFER_KEY, createBufferProvider, type StorageAdapter, type Timers, type TrackedEvent } from '..';

function memStorage() {
  const map = new Map<string, string>();
  const writes: string[] = [];
  const storage: StorageAdapter = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => {
      writes.push(k);
      map.set(k, v);
    },
  };
  return { map, writes, storage };
}

function fakeTimers() {
  const pending: { fn: () => void; ms: number }[] = [];
  const timers: Timers = {
    setTimeout: (fn, ms) => {
      const h = { fn, ms };
      pending.push(h);
      return h;
    },
    clearTimeout: (h) => {
      const i = pending.indexOf(h as (typeof pending)[number]);
      if (i >= 0) pending.splice(i, 1);
    },
  };
  return { pending, timers, runAll: () => pending.splice(0).forEach((p) => p.fn()) };
}

const ev = (i: number): TrackedEvent => ({ name: 'node_buy', params: { nodeId: `n${i}`, kind: 'k' }, t: i, s: 1 });
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('buffer provider', () => {
  it('batches writes: many events, one timer, one write', async () => {
    const { storage, writes } = memStorage();
    const t = fakeTimers();
    const b = createBufferProvider({ storage, timers: t.timers });
    for (let i = 0; i < 50; i++) b.track(ev(i));
    expect(t.pending).toHaveLength(1);
    expect(writes).toHaveLength(0);
    t.runAll();
    await settle();
    expect(writes).toEqual([BUFFER_KEY]);
    expect(b.writes).toBe(1);
  });

  it('flush writes at once and only when something changed', async () => {
    const { storage, writes } = memStorage();
    const t = fakeTimers();
    const b = createBufferProvider({ storage, timers: t.timers });
    await b.flush();
    expect(writes).toHaveLength(0);
    b.track(ev(1));
    await b.flush();
    await b.flush();
    expect(writes).toHaveLength(1);
    expect(t.pending).toHaveLength(0);
  });

  it('keeps a rolling log of at most cap events, oldest dropped', async () => {
    const { storage, map } = memStorage();
    const b = createBufferProvider({ storage, cap: 2000, timers: fakeTimers().timers });
    for (let i = 0; i < 2500; i++) b.track(ev(i));
    expect(b.events).toHaveLength(2000);
    expect(b.events[0].t).toBe(500);
    await b.flush();
    expect(JSON.parse(map.get(BUFFER_KEY)!)).toHaveLength(2000);
  });

  it('load puts the stored log before new events and survives junk', async () => {
    const { storage, map } = memStorage();
    map.set(BUFFER_KEY, JSON.stringify([ev(1), { junk: true }, ev(2)]));
    const b = createBufferProvider({ storage, timers: fakeTimers().timers });
    b.track(ev(3));
    await b.load();
    expect(b.events.map((e) => e.t)).toEqual([1, 2, 3]);
    map.set(BUFFER_KEY, '{not json');
    const c = createBufferProvider({ storage, timers: fakeTimers().timers });
    await c.load();
    expect(c.events).toEqual([]);
    expect(b.toText().split('\n')).toHaveLength(3);
  });

  it('a failing storage keeps the events dirty and never throws', async () => {
    const storage: StorageAdapter = { getItem: async () => null, setItem: async () => Promise.reject(new Error('full')) };
    const b = createBufferProvider({ storage, timers: fakeTimers().timers });
    b.track(ev(1));
    await expect(b.flush()).resolves.toBeUndefined();
    expect(b.events).toHaveLength(1);
  });
});
