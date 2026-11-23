import type { AnalyticsProvider } from '../types';

/** Sends every call to each provider; one that throws does not stop the others. */
export function combineProviders(...providers: AnalyticsProvider[]): AnalyticsProvider {
  const each = (fn: (p: AnalyticsProvider) => unknown) => {
    let failed: unknown = null;
    for (const p of providers) {
      try {
        const out = fn(p);
        if (out && typeof (out as Promise<unknown>).then === 'function') (out as Promise<unknown>).then(undefined, () => undefined);
      } catch (e) {
        failed = e;
      }
    }
    if (failed) throw failed;
  };
  return {
    name: providers.map((p) => p.name).join('+') || 'none',
    track: (e) => each((p) => p.track(e)),
    setUserProps: (props) => each((p) => p.setUserProps(props)),
    flush: () => each((p) => p.flush()),
  };
}
