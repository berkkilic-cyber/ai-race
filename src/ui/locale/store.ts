import { Platform } from 'react-native';
import { create } from 'zustand';

import { readValue, writeValue } from '../tutorial/storage';
import { getCurrentLocale, isLocale, setCurrentLocale, type Locale } from './current';
import { detectDeviceLocale, urlLocale } from './detect';

/** AsyncStorage key of the player's language choice. */
export const LOCALE_KEY = 'ai-race.locale';

export interface LocaleStore {
  locale: Locale;
  /** True once the saved choice has been read (or found missing). */
  loaded: boolean;
  setLocale(locale: Locale): void;
}

/** Keeps the web document's `lang` in step, so CSS casing and screen readers follow it. */
function syncDocumentLang(locale: Locale): void {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = locale;
  } catch {
    // ignore
  }
}

function apply(locale: Locale): void {
  setCurrentLocale(locale);
  syncDocumentLang(locale);
}

const override = urlLocale();
// The locale wanted at start: the URL override, else the device language. The saved choice
// (async) replaces it once read, normally before the fonts are ready and anything is shown.
const wanted: Locale = override ?? detectDeviceLocale();
// Web pages are pre-rendered in the base locale, so on web the first render must match it
// (or React reports a hydration mismatch); the wanted locale is applied right after the first
// mount (markMounted, called by LocaleRemount). Native renders the wanted locale at once.
let mounted = Platform.OS !== 'web';
let pending: Locale | null = mounted ? null : wanted;
const initial: Locale = mounted ? wanted : getCurrentLocale();
apply(initial);

export const useLocaleStore = create<LocaleStore>()((set, get) => ({
  locale: initial,
  loaded: override !== null,
  setLocale(locale) {
    if (!isLocale(locale)) return;
    void writeValue(LOCALE_KEY, locale).catch(() => undefined);
    if (!mounted) {
      pending = locale;
      set({ loaded: true });
      return;
    }
    apply(locale);
    if (get().locale !== locale || !get().loaded) set({ locale, loaded: true });
  },
}));

/** Shows a locale: at once when mounted, else after the first mount. */
function show(locale: Locale): void {
  if (!mounted) {
    pending = locale;
    return;
  }
  apply(locale);
  useLocaleStore.setState({ locale });
}

/** Called once the first screen has mounted: applies a locale held back for hydration. */
export function markMounted(): void {
  if (mounted) return;
  mounted = true;
  const next = pending;
  pending = null;
  if (next && next !== useLocaleStore.getState().locale) show(next);
}

if (override === null) {
  void readValue(LOCALE_KEY)
    .then((saved) => {
      // A choice made while loading wins over the saved one.
      const chosenMeanwhile = useLocaleStore.getState().loaded;
      useLocaleStore.setState({ loaded: true });
      if (isLocale(saved) && !chosenMeanwhile) show(saved);
    })
    .catch(() => useLocaleStore.setState({ loaded: true }));
}

/** The active locale, re-rendering the caller when it changes. */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

export function setLocale(locale: Locale): void {
  useLocaleStore.getState().setLocale(locale);
}
