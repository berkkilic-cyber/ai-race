/**
 * Analytics: typed events, pluggable providers and local retention maths. Pure TypeScript:
 * no React, no React Native, no imports from src/ui. Nothing is sent over the network; a
 * vendor adapter plugs in later through `AnalyticsProvider` (docs/ANALYTICS.md).
 */
export {
  analyticsErrors,
  analyticsNow,
  analyticsSession,
  analyticsTrackedCount,
  countAnalyticsError,
  flushAnalytics,
  getAnalyticsProvider,
  getUserProps,
  onTracked,
  resetAnalytics,
  setAnalyticsClock,
  setAnalyticsProvider,
  setAnalyticsSession,
  setUserProps,
  track,
} from './core';
export { cleanParams, EVENT_NAMES, MAX_PARAM_LENGTH, type AnalyticsEvent, type EventName, type EventParams, type GameMode, type ParamValue, type QuitHow, type TrackedEvent } from './events';
export { BUFFER_CAP, BUFFER_FLUSH_MS, BUFFER_KEY, createBufferProvider, type BufferOptions, type BufferProvider, type Timers } from './providers/buffer';
export { ANALYTICS_TAG, createConsoleProvider } from './providers/console';
export { createMemoryProvider, type MemoryProvider } from './providers/memory';
export { combineProviders } from './providers/multi';
export { noopProvider } from './providers/noop';
export {
  appBackgrounded,
  appForegrounded,
  appStarted,
  createRetention,
  DAY_MS,
  dayIndex,
  FUNNEL_STEPS,
  localDay,
  newInstallId,
  parseRetention,
  reduceEvent,
  RETURN_DAYS,
  retentionReport,
  SESSION_RESUME_MS,
  type FunnelRow,
  type FunnelStep,
  type RetentionReport,
  type RetentionState,
} from './retention';
export { createAnalyticsSession, RETENTION_KEY, type AnalyticsSession, type SessionOptions } from './session';
export type { AnalyticsProvider, Clock, StorageAdapter, UserProps } from './types';
