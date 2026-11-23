import type { TrackedEvent } from './events';

/** Non-personal facts about the build and device, attached to the user by providers that support it. */
export interface UserProps {
  /** Build commit from the build stamp ("a112c70" or "a112c70+"). */
  build?: string;
  /** Content pack (theme) id. */
  theme?: string;
  /** BCP 47 locale, e.g. "en-GB". */
  locale?: string;
  /** "ios" | "android" | "web". */
  platform?: string;
  /** Random id made on first launch (never a device identifier). */
  installId?: string;
}

/**
 * Where events go. The built-in providers keep them on the device; a vendor adapter
 * (docs/ANALYTICS.md) implements the same three methods. Calls may throw: the core wraps
 * every call, so a broken provider can never reach the game.
 */
export interface AnalyticsProvider {
  readonly name: string;
  track(event: TrackedEvent): void;
  setUserProps(props: UserProps): void;
  /** Persist or send what is buffered. Called on background and on a timer, never per tick. */
  flush(): void | Promise<void>;
}

/** A tiny async key-value store (AsyncStorage in the app, a map in tests). */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Epoch milliseconds. Injected everywhere so tests are deterministic. */
export type Clock = () => number;
