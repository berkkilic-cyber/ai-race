import type { TrackedEvent } from '../events';
import type { AnalyticsProvider, StorageAdapter, UserProps } from '../types';

/** Storage key of the rolling event log. */
export const BUFFER_KEY = 'ai-race.analytics.log.v1';
/** Events kept in the rolling log (oldest dropped first). */
export const BUFFER_CAP = 2000;
/** A tracked event is written at most this long after it happened (writes are batched). */
export const BUFFER_FLUSH_MS = 5000;

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface BufferOptions {
  storage: StorageAdapter;
  key?: string;
  cap?: number;
  flushMs?: number;
  timers?: Timers;
}

export interface BufferProvider extends AnalyticsProvider {
  /** Newest last. */
  readonly events: readonly TrackedEvent[];
  /** Storage writes made so far (tests prove ticks make none). */
  readonly writes: number;
  /** Reads the stored log and puts it before anything tracked since start. */
  load(): Promise<void>;
  /** The log as text (the debug view's Copy log). */
  toText(): string;
}

/**
 * The local rolling log: every event is kept in memory and written to storage in batches,
 * at most once per `flushMs` and on `flush()` (the app calls it when going to the
 * background). Keeps the last `cap` events. Nothing leaves the device.
 */
export function createBufferProvider(opts: BufferOptions): BufferProvider {
  const { storage, key = BUFFER_KEY, cap = BUFFER_CAP, flushMs = BUFFER_FLUSH_MS, timers = defaultTimers } = opts;
  let events: TrackedEvent[] = [];
  let dirty = false;
  let timer: unknown = null;
  let writes = 0;

  const trim = () => {
    if (events.length > cap) events = events.slice(events.length - cap);
  };

  const write = async () => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    if (!dirty) return;
    dirty = false;
    writes++;
    try {
      await storage.setItem(key, JSON.stringify(events));
    } catch {
      dirty = true;
    }
  };

  return {
    name: 'buffer',
    get events() {
      return events;
    },
    get writes() {
      return writes;
    },
    track(event) {
      events.push(event);
      trim();
      dirty = true;
      if (timer === null) timer = timers.setTimeout(() => {
        timer = null;
        void write();
      }, flushMs);
    },
    setUserProps: (_props: UserProps) => undefined,
    flush: () => write(),
    async load() {
      let stored: TrackedEvent[] = [];
      try {
        const text = await storage.getItem(key);
        const raw = text ? (JSON.parse(text) as unknown) : null;
        if (Array.isArray(raw)) stored = raw.filter((e): e is TrackedEvent => !!e && typeof e === 'object' && typeof (e as TrackedEvent).name === 'string' && typeof (e as TrackedEvent).t === 'number');
      } catch {
        stored = [];
      }
      events = [...stored, ...events];
      trim();
    },
    toText() {
      return events.map((e) => `${new Date(e.t).toISOString()} s${e.s} ${e.name} ${JSON.stringify(e.params)}`).join('\n');
    },
  };
}
