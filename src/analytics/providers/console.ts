import type { TrackedEvent } from '../events';
import type { AnalyticsProvider, UserProps } from '../types';

export const ANALYTICS_TAG = '[AI-RACE ANALYTICS]';

/** Development only: one console line per event. The app installs it only in __DEV__ builds. */
export function createConsoleProvider(log: (line: string) => void = (line) => console.log(line)): AnalyticsProvider {
  return {
    name: 'console',
    track(event: TrackedEvent) {
      const params = Object.entries(event.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      log(`${ANALYTICS_TAG} ${event.name}${params ? ` ${params}` : ''}`);
    },
    setUserProps(props: UserProps) {
      log(`${ANALYTICS_TAG} user ${JSON.stringify(props)}`);
    },
    flush: () => undefined,
  };
}
