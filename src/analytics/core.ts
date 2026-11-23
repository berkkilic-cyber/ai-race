import { cleanParams, type AnalyticsEvent, type TrackedEvent } from './events';
import type { AnalyticsProvider, Clock, UserProps } from './types';
import { noopProvider } from './providers/noop';

/**
 * The analytics front door: `track(event)` stamps the event with the clock and the current
 * session number and hands it to the provider. Nothing here can throw into the game: every
 * provider call is wrapped, errors are swallowed and counted (`analyticsErrors()`).
 */

let provider: AnalyticsProvider = noopProvider;
let clock: Clock = () => Date.now();
let session = 0;
let errors = 0;
let tracked = 0;
let userProps: UserProps = {};
const listeners = new Set<(event: TrackedEvent) => void>();

function guard(fn: () => unknown): void {
  try {
    const out = fn();
    if (out && typeof (out as Promise<unknown>).then === 'function') (out as Promise<unknown>).then(undefined, () => void errors++);
  } catch {
    errors++;
  }
}

export function setAnalyticsProvider(next: AnalyticsProvider): void {
  provider = next;
  guard(() => provider.setUserProps(userProps));
}

export function getAnalyticsProvider(): AnalyticsProvider {
  return provider;
}

export function setAnalyticsClock(next: Clock): void {
  clock = next;
}

export function analyticsNow(): number {
  try {
    return clock();
  } catch {
    errors++;
    return Date.now();
  }
}

/** Session number stamped on later events (the session tracker sets it). */
export function setAnalyticsSession(n: number): void {
  session = n;
}

export function analyticsSession(): number {
  return session;
}

/** Records one event. Never throws. Returns the stamped event (null if it could not be built). */
export function track(event: AnalyticsEvent): TrackedEvent | null {
  let stamped: TrackedEvent;
  try {
    stamped = { name: event.name, params: cleanParams('params' in event ? event.params : undefined), t: analyticsNow(), s: session };
  } catch {
    errors++;
    return null;
  }
  tracked++;
  guard(() => provider.track(stamped));
  for (const l of listeners) guard(() => l(stamped));
  return stamped;
}

/** Merges user properties and passes the whole set to the provider. */
export function setUserProps(props: UserProps): void {
  userProps = { ...userProps, ...props };
  guard(() => provider.setUserProps(userProps));
}

export function getUserProps(): UserProps {
  return userProps;
}

export function flushAnalytics(): void {
  guard(() => provider.flush());
}

/** Called after every tracked event (the retention reducer, the debug view). */
export function onTracked(listener: (event: TrackedEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Provider or listener calls that threw since start (or the last reset). */
export function analyticsErrors(): number {
  return errors;
}

export function analyticsTrackedCount(): number {
  return tracked;
}

/** Counts an error caught elsewhere in the analytics layer. */
export function countAnalyticsError(): void {
  errors++;
}

/** Tests: back to the defaults. */
export function resetAnalytics(): void {
  provider = noopProvider;
  clock = () => Date.now();
  session = 0;
  errors = 0;
  tracked = 0;
  userProps = {};
  listeners.clear();
}
