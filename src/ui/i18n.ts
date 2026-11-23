import type { ActionFailure, ContentPack, LabId, LabState, RegionId } from '@/engine';

import { DEFAULT_PACK_ID, getPackEntry } from './packs';
import uiStrings from './strings/en.json';
import difficultyStrings from './strings/difficulty.en.json';
import eventsStrings from './strings/events.en.json';
import momentsStrings from './strings/moments.en.json';
import raceStrings from './strings/race.en.json';
import startStrings from './strings/start.en.json';
import treesStrings from './strings/trees.en.json';
import tutorialStrings from './strings/tutorial.en.json';
import garageStrings from './strings/garage.en.json';
import feelStrings from './strings/feel.en.json';
import analyticsStrings from './strings/analytics.en.json';
import { readableOn } from './color';
import { colors, isDark, shape } from './theme';
import { lowerFirst, upperFirst } from './locale/casing';
import { BASE_LOCALE, getCurrentLocale, type Locale } from './locale/current';
// Turkish: the same one-file-per-feature pattern (see UI_TR below).
import uiStringsTr from './strings/tr.json';
import difficultyStringsTr from './strings/difficulty.tr.json';
import eventsStringsTr from './strings/events.tr.json';
import momentsStringsTr from './strings/moments.tr.json';
import raceStringsTr from './strings/race.tr.json';
import startStringsTr from './strings/start.tr.json';
import treesStringsTr from './strings/trees.tr.json';
import tutorialStringsTr from './strings/tutorial.tr.json';
import garageStringsTr from './strings/garage.tr.json';
import feelStringsTr from './strings/feel.tr.json';
import analyticsStringsTr from './strings/analytics.tr.json';
import localeStrings from './strings/locale.en.json';
import localeStringsTr from './strings/locale.tr.json';

export type Params = Record<string, string | number>;

const LOCALE = 'en';
/** Shared captions plus one file per feature, so feature tasks never edit the same file. */
const UI: Record<string, string> = { ...uiStrings, ...treesStrings, ...eventsStrings, ...startStrings, ...tutorialStrings, ...momentsStrings, ...raceStrings, ...garageStrings, ...difficultyStrings, ...feelStrings, ...analyticsStrings };

/**
 * Strings per locale. A new feature file is ONE import and ONE spread per language: the
 * English file (`<feature>.en.json`) in the UI line above, its Turkish file
 * (`<feature>.tr.json`) in UI_TR once translated. A key missing in Turkish falls back to
 * English (`npm run i18n:check` lists them).
 */
const UI_TR: Record<string, string> = { ...uiStringsTr, ...treesStringsTr, ...eventsStringsTr, ...startStringsTr, ...tutorialStringsTr, ...momentsStringsTr, ...raceStringsTr, ...garageStringsTr, ...difficultyStringsTr, ...localeStringsTr, ...feelStringsTr, ...analyticsStringsTr };
const UI_EXTRA: Record<string, string> = { ...localeStrings };
const UI_BY_LOCALE: Record<Locale, Record<string, string>> = { en: { ...UI, ...UI_EXTRA }, tr: UI_TR };

/** Params whose values are lab ids, resolved to lab names. */
const LAB_PARAMS = new Set(['lab', 'rival']);
/** Params whose values are region ids, resolved to region names. */
const REGION_PARAMS = new Set(['region', 'from', 'via']);
/** Params whose values are achievement ids, resolved to achievement names. */
const ACHIEVEMENT_PARAMS = new Set(['achievement']);
/** Engine-internal lab flags start with this; the UI ignores them. */
const INTERNAL_FLAG = '$';

interface I18nContext {
  pack: ContentPack;
  labs: Record<LabId, LabState> | null;
}

const context: I18nContext = { pack: getPackEntry(DEFAULT_PACK_ID).pack, labs: null };
const warned = new Set<string>();

/**
 * Points `t` at a pack and the current labs (for resolving lab ids in params).
 * The game store calls this; tests may call it directly.
 */
export function setI18nContext(pack: ContentPack, labs: Record<LabId, LabState> | null): void {
  context.pack = pack;
  context.labs = labs;
}

export function getI18nPack(): ContentPack {
  return context.pack;
}

/** "ui.region.buildDataCentre" -> "Build data centre". */
export function humanizeKey(key: string): string {
  const parts = key.split('.');
  let last = parts[parts.length - 1] ?? key;
  if ((last === 'name' || last === 'title' || last === 'label') && parts.length > 1) last = parts[parts.length - 2];
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return upperFirst(words, BASE_LOCALE);
}

const warnedFallback = new Set<string>();

function baseLookup(key: string): string | undefined {
  return context.pack.strings[LOCALE]?.[key] ?? UI_BY_LOCALE[BASE_LOCALE][key];
}

/** Active locale first (pack, then UI strings), then the base locale (English). */
function lookup(key: string): string | undefined {
  const locale = getCurrentLocale();
  if (locale === LOCALE) return baseLookup(key);
  const own = context.pack.strings[locale]?.[key] ?? UI_BY_LOCALE[locale]?.[key];
  if (own !== undefined) return own;
  const base = baseLookup(key);
  if (base !== undefined && !warnedFallback.has(key)) {
    warnedFallback.add(key);
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[i18n] no ${locale} text for ${key}, using ${LOCALE}`);
  }
  return base;
}

/** UI strings of a locale (without pack strings), for checks and tests. */
export function uiStringsFor(locale: Locale): Readonly<Record<string, string>> {
  return UI_BY_LOCALE[locale];
}

/** True when the key exists in the pack or the UI strings. */
export function hasString(key: string): boolean {
  return lookup(key) !== undefined;
}

function warnMissing(key: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[i18n] missing string: ${key}`);
}

function resolveParam(name: string, value: string | number): string {
  if (typeof value === 'number') return String(value);
  if (LAB_PARAMS.has(name)) return labNameById(value);
  if (REGION_PARAMS.has(name)) return regionName(value);
  if (ACHIEVEMENT_PARAMS.has(name)) {
    const achievement = context.pack.achievements.find((a) => a.id === value);
    return achievement ? t(achievement.nameKey) : value;
  }
  // Launch news carries the model's name as a string key; channel entries carry a channel id.
  if (name === 'model') return hasString(value) ? t(value) : value;
  if (name === 'channel') return hasString(`channel.${value}.name`) ? t(`channel.${value}.name`) : value;
  return value;
}

/**
 * Translates a key: pack strings first, then src/ui/strings/en.json. Missing
 * keys fall back to a readable version of the key (and warn once in dev).
 * Params named lab/rival hold lab ids, region holds a region id, achievement an achievement id.
 */
export function t(key: string, params?: Params): string {
  let text = lookup(key);
  if (text === undefined) {
    warnMissing(key);
    text = humanizeKey(key);
  }
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : resolveParam(name, value);
  });
}

/** Display name of a lab: rivals store a string key in `name`, the player a typed name. */
export function labName(lab: Pick<LabState, 'name' | 'controller'>): string {
  if (lab.controller === 'ai' && hasString(lab.name)) return t(lab.name);
  return lab.name;
}

function labNameById(id: string): string {
  const lab = context.labs?.[id];
  if (lab) return labName(lab);
  const rival = context.pack.rivals.find((r) => r.id === id);
  return rival ? t(rival.nameKey) : id;
}

/**
 * A barrier's name for use mid-sentence ("Blocked by the ocean."): the pack's
 * `barrier.<id>.inline` when it has one, else the name with its first letter lowered.
 */
export function barrierInline(id: string): string {
  const def = context.pack.barriers?.find((b) => b.id === id);
  const nameKey = def?.nameKey ?? `barrier.${id.replace(/:/g, '-')}.name`;
  const inlineKey = nameKey.replace(/\.name$/, '.inline');
  if (inlineKey !== nameKey && hasString(inlineKey)) return t(inlineKey);
  if (!hasString(nameKey)) return id;
  const name = t(nameKey);
  return lowerFirst(name);
}

export function regionName(id: RegionId): string {
  const region = context.pack.regions.find((r) => r.id === id);
  return region ? t(region.nameKey) : id;
}

/** Map colour of a lab: the player uses the theme accent, rivals their own colour. */
export function labColor(lab: Pick<LabState, 'color' | 'controller'>): string {
  return lab.controller === 'human' ? colors.player : lab.color;
}

/** Contrast a lab colour must reach on the theme's backgrounds: graphics (dots, swatches) or text. */
export const LAB_CONTRAST = { graphic: 3, text: 4.5 } as const;

const readableCache = new Map<string, string>();

/**
 * labColor, adjusted so it reads on this theme (color.ts readableOn): rivals move away
 * from the player's hue and, on themes that ask for it, lift to light tints; colours too
 * light for a light ground are darkened towards ink (too dark for a dark one: lightened
 * towards white). The pack keeps its colours; only the UI adjusts them.
 */
export function readableLabColor(lab: Pick<LabState, 'color' | 'controller'>, use: keyof typeof LAB_CONTRAST = 'graphic'): string {
  const base = labColor(lab);
  const key = `${base}|${use}`;
  let out = readableCache.get(key);
  if (out === undefined) {
    const toward = isDark ? colors.newsPaper : colors.text;
    out = readableOn(base, colors, LAB_CONTRAST[use], toward, { rival: lab.controller !== 'human', minHue: shape.rivalHue, lift: shape.rivalLift, alarmHue: shape.rivalAlarmHue, sat: shape.rivalSat });
    readableCache.set(key, out);
  }
  return out;
}

/** Entries in the readable-colour cache (one per lab colour and use); for leak tests. */
export function readableColorCacheSize(): number {
  return readableCache.size;
}

/** Lab flags without engine internals. */
export function visibleFlags(lab: Pick<LabState, 'flags'>): string[] {
  return lab.flags.filter((f) => !f.startsWith(INTERNAL_FLAG));
}

/** Human text for why an action is unavailable. */
export function failureText(reason: ActionFailure): string {
  return t(`ui.failure.${reason}`, { hype: t('term.hype'), cash: t('term.cash') });
}
