import type { TrackedEvent } from './events';

/**
 * Local retention maths, pure: the install record, sessions per local calendar day, and
 * the first-run funnel. Kept as one small state (not derived from the rolling event log)
 * so it survives the log dropping old events. Every function takes the time and the
 * timezone offset as parameters, so tests are deterministic. Definitions: docs/ANALYTICS.md.
 */

export const DAY_MS = 86_400_000;
/** Back in the foreground within this long after going to the background: the same session. */
export const SESSION_RESUME_MS = 30_000;
/** Session lengths kept for the debug view. */
export const RECENT_SESSIONS = 20;

export const FUNNEL_STEPS = ['app_open', 'tutorial_start', 'tutorial_complete', 'run_start', 'run_end'] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const RETURN_DAYS = [1, 7, 30] as const;

export interface DayStats {
  /** Sessions that started on this day. */
  sessions: number;
  /** Sessions of this day that have ended, and their total length. */
  closed: number;
  seconds: number;
}

export interface OpenSession {
  n: number;
  start: number;
  /** Last time the app was seen in use (an event or going to the background). */
  lastSeen: number;
  /** When it went to the background, while it is there. */
  bgAt: number | null;
}

export interface RetentionState {
  v: 1;
  installId: string;
  installedAt: number;
  /** Local day number of the install (see `localDay`). */
  installDay: number;
  /** Sessions started since install. */
  sessions: number;
  /** By day index since install (0 = install day). */
  days: Record<number, DayStats>;
  open: OpenSession | null;
  /** First time each funnel step happened (epoch ms). */
  funnel: Partial<Record<FunnelStep, number>>;
  /** Lengths of the last few ended sessions, seconds, newest last. */
  recent: number[];
}

/**
 * Local calendar day number of a time. `offsetMin` is `Date#getTimezoneOffset()` at that
 * time (minutes to add to local time to get UTC; positive west of Greenwich).
 */
export function localDay(t: number, offsetMin: number): number {
  return Math.floor((t - offsetMin * 60_000) / DAY_MS);
}

/** "i-" and 16 hex digits from a random source in [0, 1). Not derived from the device. */
export function newInstallId(random: () => number): string {
  let out = 'i-';
  for (let i = 0; i < 16; i++) out += Math.floor(Math.max(0, Math.min(0.999999, random())) * 16).toString(16);
  return out;
}

export function createRetention(installId: string, now: number, offsetMin: number): RetentionState {
  return { v: 1, installId, installedAt: now, installDay: localDay(now, offsetMin), sessions: 0, days: {}, open: null, funnel: {}, recent: [] };
}

/** Day index of a time for this install (0 on the install day, 1 the next local day, ...). */
export function dayIndex(s: RetentionState, t: number, offsetMin: number): number {
  return localDay(t, offsetMin) - s.installDay;
}

const day = (s: RetentionState, d: number): DayStats => s.days[d] ?? { sessions: 0, closed: 0, seconds: 0 };

/** What a session change produced: the new state and the events to track, in order. */
export interface SessionStep {
  state: RetentionState;
  /** session_end (with its length and its session number) and/or session_start (with the new number). */
  ended: { n: number; seconds: number } | null;
  started: number | null;
}

/** Ends the open session (if any) at its last known moment of use. */
function closeOpen(s: RetentionState, offsetMin: number): { state: RetentionState; ended: { n: number; seconds: number } | null } {
  const o = s.open;
  if (!o) return { state: s, ended: null };
  const endAt = o.bgAt ?? o.lastSeen;
  const seconds = Math.max(0, Math.round((endAt - o.start) / 1000));
  const d = dayIndex(s, o.start, offsetMin);
  const cur = day(s, d);
  const recent = [...s.recent, seconds].slice(-RECENT_SESSIONS);
  return { state: { ...s, open: null, recent, days: { ...s.days, [d]: { ...cur, closed: cur.closed + 1, seconds: cur.seconds + seconds } } }, ended: { n: o.n, seconds } };
}

function openNew(s: RetentionState, now: number, offsetMin: number): RetentionState {
  const n = s.sessions + 1;
  const d = dayIndex(s, now, offsetMin);
  const cur = day(s, d);
  return { ...s, sessions: n, open: { n, start: now, lastSeen: now, bgAt: null }, days: { ...s.days, [d]: { ...cur, sessions: cur.sessions + 1 } } };
}

/** App launched: a session left open by a killed app is ended at its last use, then a new one starts. */
export function appStarted(s: RetentionState, now: number, offsetMin: number): SessionStep {
  const closed = closeOpen(s, offsetMin);
  const state = openNew(closed.state, now, offsetMin);
  return { state, ended: closed.ended, started: state.sessions };
}

/** App went to the background. */
export function appBackgrounded(s: RetentionState, now: number): RetentionState {
  if (!s.open || s.open.bgAt !== null) return s;
  return { ...s, open: { ...s.open, bgAt: now, lastSeen: now } };
}

/** App came back: the same session within SESSION_RESUME_MS, otherwise the old one ends and a new one starts. */
export function appForegrounded(s: RetentionState, now: number, offsetMin: number, resumeMs = SESSION_RESUME_MS): SessionStep {
  const o = s.open;
  if (o && o.bgAt === null) return { state: s, ended: null, started: null };
  if (o && o.bgAt !== null && now - o.bgAt <= resumeMs) return { state: { ...s, open: { ...o, bgAt: null, lastSeen: now } }, ended: null, started: null };
  return appStarted(s, now, offsetMin);
}

const funnelStepOf = (e: TrackedEvent): FunnelStep | null => {
  switch (e.name) {
    case 'app_open':
      return 'app_open';
    case 'tutorial_step':
      return e.params.step === 1 ? 'tutorial_start' : null;
    case 'tutorial_complete':
      return 'tutorial_complete';
    case 'run_start':
      return 'run_start';
    case 'run_end':
      return 'run_end';
    default:
      return null;
  }
};

/** Applies one tracked event: marks the session as in use and records first funnel times. Same state back when nothing changed. */
export function reduceEvent(s: RetentionState, e: TrackedEvent): RetentionState {
  let out = s;
  if (s.open && s.open.bgAt === null && e.t > s.open.lastSeen) out = { ...out, open: { ...s.open, lastSeen: e.t } };
  const step = funnelStepOf(e);
  if (step && out.funnel[step] === undefined) out = { ...out, funnel: { ...out.funnel, [step]: e.t } };
  return out;
}

export interface FunnelRow {
  step: FunnelStep;
  /** Epoch ms of the first time, or null if not reached yet. */
  at: number | null;
  /** Seconds after install. */
  sinceInstall: number | null;
}

export interface RetentionReport {
  installId: string;
  installedAt: number;
  /** Day index of `now` (D0 = install day). */
  dayIndex: number;
  sessions: number;
  sessionsToday: number;
  /** Days since install with at least one session. */
  activeDays: number;
  /** Sessions per active day. */
  sessionsPerDay: number;
  /** Mean length of ended sessions, seconds (0 when none ended). */
  avgSessionSeconds: number;
  /** Seconds of the open session so far (0 if none). */
  currentSessionSeconds: number;
  recent: number[];
  /** Day n return: true / false once day n has passed or arrived, null while it is still ahead. */
  returned: Record<(typeof RETURN_DAYS)[number], boolean | null>;
  funnel: FunnelRow[];
}

export function retentionReport(s: RetentionState, now: number, offsetMin: number): RetentionReport {
  const today = dayIndex(s, now, offsetMin);
  const entries = Object.entries(s.days).map(([k, v]) => [Number(k), v] as const);
  const activeDays = entries.filter(([, v]) => v.sessions > 0).length;
  const closed = entries.reduce((a, [, v]) => a + v.closed, 0);
  const seconds = entries.reduce((a, [, v]) => a + v.seconds, 0);
  const returned = {} as RetentionReport['returned'];
  for (const n of RETURN_DAYS) returned[n] = today < n ? (day(s, n).sessions > 0 ? true : null) : day(s, n).sessions > 0;
  const o = s.open;
  return {
    installId: s.installId,
    installedAt: s.installedAt,
    dayIndex: today,
    sessions: s.sessions,
    sessionsToday: day(s, today).sessions,
    activeDays,
    sessionsPerDay: activeDays ? Math.round((s.sessions / activeDays) * 100) / 100 : 0,
    avgSessionSeconds: closed ? Math.round(seconds / closed) : 0,
    currentSessionSeconds: o ? Math.max(0, Math.round(((o.bgAt ?? now) - o.start) / 1000)) : 0,
    recent: s.recent,
    returned,
    funnel: FUNNEL_STEPS.map((step) => {
      const at = s.funnel[step] ?? null;
      return { step, at, sinceInstall: at === null ? null : Math.max(0, Math.round((at - s.installedAt) / 1000)) };
    }),
  };
}

/** Parses a stored state; null when it is missing or not ours. */
export function parseRetention(text: string | null): RetentionState | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Partial<RetentionState>;
    if (raw?.v !== 1 || typeof raw.installId !== 'string' || typeof raw.installedAt !== 'number' || typeof raw.installDay !== 'number') return null;
    return {
      v: 1,
      installId: raw.installId,
      installedAt: raw.installedAt,
      installDay: raw.installDay,
      sessions: typeof raw.sessions === 'number' ? raw.sessions : 0,
      days: raw.days && typeof raw.days === 'object' ? raw.days : {},
      open: raw.open && typeof raw.open.start === 'number' ? { n: raw.open.n ?? 0, start: raw.open.start, lastSeen: raw.open.lastSeen ?? raw.open.start, bgAt: raw.open.bgAt ?? null } : null,
      funnel: raw.funnel && typeof raw.funnel === 'object' ? raw.funnel : {},
      recent: Array.isArray(raw.recent) ? raw.recent.filter((n) => typeof n === 'number') : [],
    };
  } catch {
    return null;
  }
}
