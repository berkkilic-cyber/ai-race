import type { TextStyle } from 'react-native';

import { getCurrentLocale, type Locale } from './current';

/**
 * Locale-aware casing: the one place the UI changes the case of visible text.
 *
 * Turkish has a dotted and a dotless i: i <-> İ and ı <-> I. `String.toUpperCase` maps
 * i -> I, and iOS applies `textTransform: 'uppercase'` with a non-localised mapping too
 * (Android uses the device locale, not the app's), so text in Turkish must be cased here,
 * in JS, before it reaches a Text. The mapping is done by hand rather than with
 * `toLocaleUpperCase('tr')` so it is the same on every JS engine.
 */

export function upper(text: string, locale: Locale = getCurrentLocale()): string {
  if (locale === 'tr') return text.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
  return text.toUpperCase();
}

export function lower(text: string, locale: Locale = getCurrentLocale()): string {
  if (locale === 'tr') return text.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
  return text.toLowerCase();
}

/** First letter upper-cased ("ileri" -> "İleri" in Turkish). */
export function upperFirst(text: string, locale: Locale = getCurrentLocale()): string {
  return text ? upper(text.charAt(0), locale) + text.slice(1) : text;
}

/** First letter lower-cased, for a name used mid-sentence. */
export function lowerFirst(text: string, locale: Locale = getCurrentLocale()): string {
  return text ? lower(text.charAt(0), locale) + text.slice(1) : text;
}

type Transform = TextStyle['textTransform'];

/** Applies a style's textTransform to the text in JS, with the locale's rules. */
export function applyTransform(text: string, transform: Transform, locale: Locale = getCurrentLocale()): string {
  switch (transform) {
    case 'uppercase':
      return upper(text, locale);
    case 'lowercase':
      return lower(text, locale);
    case 'capitalize':
      return text.replace(/(^|\s)(\S)/g, (_m, space: string, ch: string) => space + upper(ch, locale));
    default:
      return text;
  }
}

/**
 * Text for a style that sets textTransform: cased here so Turkish i/İ is right on every
 * platform. Keep the style's textTransform (casing twice is harmless): `{cased(styles.x, label)}`.
 * Rendered text normally needs nothing: the locale Text (./Text.tsx) does this for every Text
 * under a case-changing style. Use `cased` for strings that leave a Text (labels passed on).
 */
export function cased(style: TextStyle | undefined | null | false, text: string): string {
  return style ? applyTransform(text, style.textTransform) : text;
}
