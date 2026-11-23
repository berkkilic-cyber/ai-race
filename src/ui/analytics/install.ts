import { Platform } from 'react-native';

import {
  combineProviders,
  createAnalyticsSession,
  createBufferProvider,
  createConsoleProvider,
  createMemoryProvider,
  setAnalyticsProvider,
  setUserProps,
  type AnalyticsProvider,
  type AnalyticsSession,
  type BufferProvider,
  type MemoryProvider,
  type StorageAdapter,
  type TrackedEvent,
} from '@/analytics';

import { buildInfo } from '../diagnostics/build';
import { useGameStore } from '../store/game';
import { readValue, writeValue } from '../tutorial/storage';
import { flushTaps, subscribeAds, subscribeErrors, subscribeGarage, subscribeMeta, subscribeRace, subscribeTutorial } from './subscriptions';

/** AsyncStorage (memory fallback) through the tutorial's tiny key-value helper. */
export const appStorage: StorageAdapter = {
  getItem: (key) => readValue(key),
  setItem: (key, value) => writeValue(key, value),
};

export interface AnalyticsRuntime {
  buffer: BufferProvider;
  memory: MemoryProvider;
  session: AnalyticsSession;
  provider: AnalyticsProvider;
  /** Flushes pending taps, the retention state and the event log (background, leaving a mode). */
  flush(): Promise<void>;
  dispose(): void;
}

let runtime: AnalyticsRuntime | null = null;

export function getAnalyticsRuntime(): AnalyticsRuntime | null {
  return runtime;
}

/** Random source for the install id: the platform's crypto when present, else Math.random. */
function random(): number {
  try {
    const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
    if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] / 0x1_0000_0000;
  } catch {
    // fall back
  }
  return Math.random();
}

function locale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'unknown';
  } catch {
    return 'unknown';
  }
}

const devBuild = typeof __DEV__ !== 'undefined' && __DEV__ && !(typeof process !== 'undefined' && process.env?.JEST_WORKER_ID);

export interface InstallOptions {
  storage?: StorageAdapter;
  /** One console line per event (default: development builds only). */
  console?: boolean;
}

/**
 * Installs the analytics layer once: the local buffer (rolling log in storage), a memory
 * copy for the debug view, the console in development, the session tracker and the store
 * subscriptions. Sends nothing over the network. Safe to call again (returns the same).
 */
export function installAnalytics(opts: InstallOptions = {}): AnalyticsRuntime {
  if (runtime) return runtime;
  const storage = opts.storage ?? appStorage;
  const buffer = createBufferProvider({ storage });
  const memory = createMemoryProvider(200);
  const providers: AnalyticsProvider[] = [buffer, memory];
  if (opts.console ?? devBuild) providers.push(createConsoleProvider());
  const provider = combineProviders(...providers);
  setAnalyticsProvider(provider);
  const info = buildInfo();
  setUserProps({ build: `${info.commit}${info.dirty ? '+' : ''}`, theme: useGameStore.getState().packId, locale: locale(), platform: Platform.OS });
  const session = createAnalyticsSession({ storage, random, tzOffset: (t) => new Date(t).getTimezoneOffset() });
  const offs = [subscribeErrors(), subscribeRace(), subscribeTutorial(), subscribeGarage(), subscribeAds(), subscribeMeta()];
  void buffer.load().then(() => session.start());
  runtime = {
    buffer,
    memory,
    session,
    provider,
    async flush() {
      flushTaps();
      await session.flush();
    },
    dispose() {
      offs.forEach((off) => off());
      session.dispose();
      runtime = null;
    },
  };
  installWebDebugHandle(runtime);
  return runtime;
}

export interface AnalyticsDebugHandle {
  /** Events tracked this page load (newest last). */
  events(): TrackedEvent[];
  /** The stored rolling log. */
  log(): TrackedEvent[];
  report(): ReturnType<AnalyticsSession['report']>;
  flush(): Promise<void>;
  writes(): number;
}

/** Web with `?debug=1` only: `window.__analytics` for the screenshot and bot scripts. */
function installWebDebugHandle(r: AnalyticsRuntime): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!/[?&]debug=1\b/.test(window.location?.search ?? '')) return;
  const handle: AnalyticsDebugHandle = {
    events: () => [...r.memory.events],
    log: () => [...r.buffer.events],
    report: () => r.session.report(),
    flush: () => r.flush(),
    writes: () => r.buffer.writes + r.session.writes(),
  };
  (window as unknown as { __analytics?: AnalyticsDebugHandle }).__analytics = handle;
}
