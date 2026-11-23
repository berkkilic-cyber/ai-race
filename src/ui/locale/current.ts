/**
 * The active UI locale, as plain module state with no imports, so i18n, the casing helper
 * and the locale store can all read it without import cycles. The locale store
 * (./store.ts) is the only writer in the app; tests may call setCurrentLocale directly.
 */

/** Supported locales, the base (fallback) locale first. */
export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
export const BASE_LOCALE: Locale = 'en';

let current: Locale = BASE_LOCALE;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function getCurrentLocale(): Locale {
  return current;
}

export function setCurrentLocale(locale: Locale): void {
  current = locale;
}
