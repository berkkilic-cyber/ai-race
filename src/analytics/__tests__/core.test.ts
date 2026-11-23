import {
  analyticsErrors,
  combineProviders,
  createConsoleProvider,
  createMemoryProvider,
  EVENT_NAMES,
  MAX_PARAM_LENGTH,
  onTracked,
  resetAnalytics,
  setAnalyticsClock,
  setAnalyticsProvider,
  setAnalyticsSession,
  setUserProps,
  track,
  type AnalyticsProvider,
} from '..';

beforeEach(() => resetAnalytics());

describe('track', () => {
  it('stamps events with the clock and the session and passes them to the provider', () => {
    const mem = createMemoryProvider();
    setAnalyticsProvider(mem);
    setAnalyticsClock(() => 1234);
    setAnalyticsSession(3);
    track({ name: 'node_buy', params: { nodeId: 'n1', kind: 'capability' } });
    track({ name: 'app_open' });
    expect(mem.events).toEqual([
      { name: 'node_buy', params: { nodeId: 'n1', kind: 'capability' }, t: 1234, s: 3 },
      { name: 'app_open', params: {}, t: 1234, s: 3 },
    ]);
  });

  it('drops undefined params, cuts long strings and replaces non-finite numbers', () => {
    const mem = createMemoryProvider();
    setAnalyticsProvider(mem);
    track({ name: 'run_start', params: { founder: 'f', difficulty: 'd', homeRegion: 'r', runLength: undefined } });
    track({ name: 'error', params: { where: 'x', message: 'y'.repeat(500) } });
    track({ name: 'session_end', params: { seconds: Number.NaN } });
    expect(Object.keys(mem.events[0].params)).toEqual(['founder', 'difficulty', 'homeRegion']);
    expect((mem.events[1].params.message as string).length).toBe(MAX_PARAM_LENGTH);
    expect(mem.events[2].params.seconds).toBe(0);
  });

  it('never throws when a provider, a listener or the clock throws, and counts the errors', () => {
    const bad: AnalyticsProvider = {
      name: 'bad',
      track: () => {
        throw new Error('boom');
      },
      setUserProps: () => {
        throw new Error('boom');
      },
      flush: () => Promise.reject(new Error('async boom')),
    };
    setAnalyticsProvider(bad);
    onTracked(() => {
      throw new Error('listener');
    });
    setAnalyticsClock(() => {
      throw new Error('clock');
    });
    expect(() => track({ name: 'app_open' })).not.toThrow();
    expect(() => setUserProps({ theme: 'x' })).not.toThrow();
    expect(analyticsErrors()).toBeGreaterThanOrEqual(4);
  });

  it('combined providers all receive events even when one throws', () => {
    const a = createMemoryProvider();
    const b = createMemoryProvider();
    const broken: AnalyticsProvider = { name: 'x', track: () => { throw new Error('x'); }, setUserProps: () => undefined, flush: () => undefined };
    setAnalyticsProvider(combineProviders(a, broken, b));
    track({ name: 'garage_open' });
    expect(a.events).toHaveLength(1);
    expect(b.events).toHaveLength(1);
    expect(analyticsErrors()).toBe(1);
  });

  it('merges user props and hands them to the provider', () => {
    const mem = createMemoryProvider();
    setAnalyticsProvider(mem);
    setUserProps({ build: 'abc', platform: 'web' });
    setUserProps({ locale: 'en-GB' });
    expect(mem.userProps).toEqual({ build: 'abc', platform: 'web', locale: 'en-GB' });
  });

  it('the console provider writes one tagged line per event', () => {
    const lines: string[] = [];
    const c = createConsoleProvider((l) => lines.push(l));
    c.track({ name: 'tutorial_step', params: { step: 1, id: 'home' }, t: 0, s: 1 });
    expect(lines).toEqual(['[AI-RACE ANALYTICS] tutorial_step step=1 id=home']);
  });

  it('lists every event name once', () => {
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
  });
});

describe('purity', () => {
  it('src/analytics imports no React, React Native, Expo or UI code', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('node:path') as typeof import('node:path');
    const root = path.join(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== '__tests__') walk(full);
        } else if (/\.tsx?$/.test(e.name)) {
          const src = fs.readFileSync(full, 'utf8');
          for (const m of src.matchAll(/from\s+'([^']+)'/g)) if (!m[1].startsWith('.')) offenders.push(`${e.name}: ${m[1]}`);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
