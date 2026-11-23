import type { TrackedEvent } from '../events';
import type { AnalyticsProvider, UserProps } from '../types';

export interface MemoryProvider extends AnalyticsProvider {
  readonly events: readonly TrackedEvent[];
  readonly userProps: UserProps;
  flushes: number;
  clear(): void;
}

/** Keeps the last `cap` events in memory (tests, the debug view). */
export function createMemoryProvider(cap = 500): MemoryProvider {
  const events: TrackedEvent[] = [];
  let props: UserProps = {};
  const p: MemoryProvider = {
    name: 'memory',
    events,
    get userProps() {
      return props;
    },
    flushes: 0,
    track(event) {
      events.push(event);
      if (events.length > cap) events.splice(0, events.length - cap);
    },
    setUserProps(next) {
      props = next;
    },
    flush() {
      p.flushes++;
    },
    clear() {
      events.length = 0;
    },
  };
  return p;
}
