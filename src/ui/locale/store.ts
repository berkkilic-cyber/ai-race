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
// Synchronous start: the URL override, else the device language. The saved choice (async)
// replaces it once read, normally before the fonts are ready and anything is shown.
const initial: Locale = override ?? detectDeviceLocale();
apply(initial);

export const useLocaleStore = create<LocaleStore>()((set, get) => ({
  locale: initial,
  loaded: override !== null,
  setLocale(locale) {
    if (!isLocale(locale)) return;
    apply(locale);
    if (get().locale !== locale || !get().loaded) set({ locale, loaded: true });
    void writeValue(LOCALE_KEY, locale).catch(() => undefined);
  },
}));

if (override === null) {
  void readValue(LOCALE_KEY)
    .then((saved) => {
      // A choice made while loading wins over the saved one.
      if (isLocale(saved) && !useLocaleStore.getState().loaded && saved !== getCurrentLocale()) {
        apply(saved);
        useLocaleStore.setState({ locale: saved, loaded: true });
      } else {
        useLocaleStore.setState({ loaded: true });
      }
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
