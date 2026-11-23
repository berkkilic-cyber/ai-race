import type { AnalyticsProvider } from '../types';

/** Drops everything (the default until the app installs its providers). */
export const noopProvider: AnalyticsProvider = {
  name: 'noop',
  track: () => undefined,
  setUserProps: () => undefined,
  flush: () => undefined,
};
