import { analyticsNow, countAnalyticsError, flushAnalytics, onTracked, setAnalyticsSession, setUserProps, track } from './core';
import type { TrackedEvent } from './events';
import {
  appBackgrounded,
  appForegrounded,
  appStarted,
  createRetention,
  newInstallId,
  parseRetention,
  reduceEvent,
  retentionReport,
  SESSION_RESUME_MS,
  type RetentionReport,
  type RetentionState,
  type SessionStep,
} from './retention';
import type { StorageAdapter } from './types';
import { BUFFER_FLUSH_MS, type Timers } from './providers/buffer';

export const RETENTION_KEY = 'ai-race.analytics.retention.v1';

export interface SessionOptions {
  storage: StorageAdapter;
  /** Random source in [0, 1) for the install id. */
  random?: () => number;
  /** Timezone offset in minutes at a time (Date#getTimezoneOffset). Default 0 (UTC). */
  tzOffset?: (t: number) => number;
  resumeMs?: number;
  flushMs?: number;
  timers?: Timers;
}

export interface AnalyticsSession {
  /** Loads (or creates) the install record, ends a session a killed app left open, tracks app_open and session_start. */
  start(): Promise<void>;
  background(): void;
  foreground(): void;
  /** Writes the retention state if it changed and flushes the provider. */
  flush(): Promise<void>;
  state(): RetentionState | null;
  report(): RetentionReport | null;
  /** Retention state writes so far (tests). */
  writes(): number;
  /** Stops listening (tests). */
  dispose(): void;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * Sessions and retention for this install, on top of `track`. Uses the analytics clock;
 * writes are batched like the event buffer (at most once per `flushMs`, and on flush).
 */
export function createAnalyticsSession(opts: SessionOptions): AnalyticsSession {
  const { storage, random = Math.random, tzOffset = () => 0, resumeMs = SESSION_RESUME_MS, flushMs = BUFFER_FLUSH_MS, timers = defaultTimers } = opts;
  let s: RetentionState | null = null;
  let early: TrackedEvent[] = [];
  let dirty = false;
  let timer: unknown = null;
  let writes = 0;
  let starting: Promise<void> | null = null;

  const save = async () => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
    if (!dirty || !s) return;
    dirty = false;
    writes++;
    try {
      await storage.setItem(RETENTION_KEY, JSON.stringify(s));
    } catch {
      dirty = true;
      countAnalyticsError();
    }
  };

  const set = (next: RetentionState) => {
    if (next === s) return;
    s = next;
    dirty = true;
    if (timer === null) timer = timers.setTimeout(() => {
      timer = null;
      void save();
    }, flushMs);
  };

  const unlisten = onTracked((e) => {
    if (!s) early.push(e);
    else set(reduceEvent(s, e));
  });

  const apply = (step: SessionStep) => {
    set(step.state);
    if (step.ended) {
      // Stamped with the session it closes.
      setAnalyticsSession(step.ended.n);
      track({ name: 'session_end', params: { seconds: step.ended.seconds } });
    }
    if (step.started !== null) {
      setAnalyticsSession(step.started);
      track({ name: 'session_start' });
    }
  };

  const flush = async () => {
    await save();
    flushAnalytics();
  };

  return {
    start() {
      if (starting) return starting;
      starting = (async () => {
        let text: string | null = null;
        try {
          text = await storage.getItem(RETENTION_KEY);
        } catch {
          countAnalyticsError();
        }
        const now = analyticsNow();
        const loaded = parseRetention(text) ?? createRetention(newInstallId(random), now, tzOffset(now));
        setUserProps({ installId: loaded.installId });
        // Close a session a killed app left open before anything from this launch can touch it.
        const step = appStarted(loaded, now, tzOffset(now));
        let state: RetentionState = step.state;
        for (const e of early) state = reduceEvent(state, e);
        early = [];
        set(state);
        track({ name: 'app_open' });
        apply({ ...step, state: s ?? state });
        await save();
      })();
      return starting;
    },
    background() {
      if (!s) return;
      set(appBackgrounded(s, analyticsNow()));
      void flush();
    },
    foreground() {
      if (!s) return;
      const now = analyticsNow();
      apply(appForegrounded(s, now, tzOffset(now), resumeMs));
    },
    flush,
    state: () => s,
    report() {
      if (!s) return null;
      const now = analyticsNow();
      return retentionReport(s, now, tzOffset(now));
    },
    writes: () => writes,
    dispose() {
      unlisten();
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
    },
  };
}
