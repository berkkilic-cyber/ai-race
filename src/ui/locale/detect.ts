import { NativeModules, Platform } from 'react-native';

import { BASE_LOCALE, isLocale, type Locale } from './current';

/** "tr-TR", "tr_TR", "tr" -> "tr"; anything unsupported -> null. */
export function localeFromTag(tag: unknown): Locale | null {
  if (typeof tag !== 'string' || !tag) return null;
  const lang = tag.toLowerCase().split(/[-_@.]/)[0];
  return isLocale(lang) ? lang : null;
}

/** Device language tags, best first, from what JS and React Native already expose. */
function deviceTags(): unknown[] {
  const tags: unknown[] = [];
  try {
    if (typeof navigator !== 'undefined' && navigator) {
      const nav = navigator as { languages?: readonly string[]; language?: string };
      if (Array.isArray(nav.languages)) tags.push(...nav.languages);
      tags.push(nav.language);
    }
  } catch {
    // ignore
  }
  try {
    const settings = NativeModules?.SettingsManager?.settings as { AppleLocale?: string; AppleLanguages?: string[] } | undefined;
    if (settings) tags.push(settings.AppleLanguages?.[0], settings.AppleLocale);
    tags.push(NativeModules?.I18nManager?.localeIdentifier);
  } catch {
    // ignore
  }
  try {
    tags.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    // ignore
  }
  return tags;
}

/**
 * First-launch locale: Turkish when the device language is Turkish, otherwise the base
 * locale. Never throws. Only the first supported tag counts, so a device set to English
 * with a Turkish region format stays English.
 */
export function detectDeviceLocale(tags: unknown[] = deviceTags()): Locale {
  try {
    for (const tag of tags) {
      if (typeof tag !== 'string' || !tag) continue;
      return localeFromTag(tag) ?? BASE_LOCALE;
    }
  } catch {
    // fall through
  }
  return BASE_LOCALE;
}

/** Web only: `?lang=tr` / `?lang=en` overrides the saved choice (for tests and screenshots). */
export function urlLocale(): Locale | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window === 'undefined' || typeof window.location?.search !== 'string') return null;
    const m = /[?&]lang=([A-Za-z-]+)/.exec(window.location.search);
    return m ? localeFromTag(m[1]) : null;
  } catch {
    return null;
  }
}
