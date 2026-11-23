import { Platform } from 'react-native';

/**
 * Crash visibility. Every line starts with a fixed tag so it can be found in the Expo
 * terminal: `[AI-RACE ERROR]` for errors, `[AI-RACE]` for lifecycle lines.
 */
export const ERROR_TAG = '[AI-RACE ERROR]';
export const LIFECYCLE_TAG = '[AI-RACE]';

const underJest = typeof process !== 'undefined' && !!process.env?.JEST_WORKER_ID;

/** Lifecycle lines are on in development builds only (and kept out of test output). */
export const DEBUG_LIFECYCLE = typeof __DEV__ !== 'undefined' && __DEV__ && !underJest;

type Fields = Record<string, string | number | boolean | null | undefined>;

function describe(fields?: Fields): string {
  if (!fields) return '';
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? ` ${parts.join(' ')}` : '';
}

/**
 * One line at a key moment of a run (run started, event shown, node bought ...), so the
 * last line before a shutdown shows what the app was doing. No-op unless DEBUG_LIFECYCLE.
 */
export function logLifecycle(what: string, fields?: Fields): void {
  if (!DEBUG_LIFECYCLE) return;
  console.log(`${LIFECYCLE_TAG} ${what}${describe(fields)}`);
}

/** Message of anything thrown. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return typeof error === 'string' ? error : JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const errorListeners = new Set<(source: string, message: string) => void>();

/** Called for every logged error with where it came from and its message (analytics). Returns an unsubscribe. */
export function onLoggedError(listener: (source: string, message: string) => void): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

/** Logs an error with the tag, where it came from, and its stack when there is one. */
export function logError(source: string, error: unknown, extra?: string): void {
  const stack = error instanceof Error && error.stack ? `\n${error.stack}` : '';
  console.error(`${ERROR_TAG} ${source}: ${errorMessage(error)}${extra ? `\n${extra}` : ''}${stack}`);
  for (const l of errorListeners) {
    try {
      l(source, errorMessage(error));
    } catch {
      // a listener never turns one error into two
    }
  }
}

interface ErrorUtilsLike {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
}

interface HermesLike {
  enablePromiseRejectionTracker?: (options: { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void; onHandled: (id: number) => void }) => void;
}

let installed = false;

/**
 * Installs global handlers once: uncaught JS errors (chained to React Native's own
 * handler so the red screen still appears in development) and unhandled promise
 * rejections (Hermes tracker on native, `unhandledrejection` on web).
 */
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike; HermesInternal?: HermesLike };

  const errorUtils = g.ErrorUtils;
  if (errorUtils && typeof errorUtils.setGlobalHandler === 'function') {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      logError(isFatal ? 'fatal uncaught error' : 'uncaught error', error);
      previous?.(error, isFatal);
    });
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => logError('unhandled promise rejection', e.reason));
      window.addEventListener('error', (e: ErrorEvent) => logError('uncaught error', e.error ?? e.message));
    }
    return;
  }

  const tracker = g.HermesInternal?.enablePromiseRejectionTracker;
  if (typeof tracker === 'function') {
    try {
      tracker({ allRejections: true, onUnhandled: (id, error) => logError(`unhandled promise rejection #${id}`, error), onHandled: () => undefined });
    } catch (error) {
      logError('installing the rejection tracker', error);
    }
  }
}
