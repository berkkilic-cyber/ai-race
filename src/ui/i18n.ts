import type { ActionFailure, ContentPack, LabId, LabState, RegionId } from '@/engine';

import { DEFAULT_PACK_ID, getPackEntry } from './packs';
import uiStrings from './strings/en.json';
import { colors } from './theme';

export type Params = Record<string, string | number>;

const LOCALE = 'en';
const UI: Record<string, string> = uiStrings;

/** Params whose values are lab ids, resolved to lab names. */
const LAB_PARAMS = new Set(['lab', 'rival']);
/** Params whose values are region ids, resolved to region names. */
const REGION_PARAMS = new Set(['region']);
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
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function lookup(key: string): string | undefined {
  return context.pack.strings[LOCALE]?.[key] ?? UI[key];
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

export function regionName(id: RegionId): string {
  const region = context.pack.regions.find((r) => r.id === id);
  return region ? t(region.nameKey) : id;
}

/** Map colour of a lab: the player uses the theme accent, rivals their own colour. */
export function labColor(lab: Pick<LabState, 'color' | 'controller'>): string {
  return lab.controller === 'human' ? colors.player : lab.color;
}

/** Lab flags without engine internals. */
export function visibleFlags(lab: Pick<LabState, 'flags'>): string[] {
  return lab.flags.filter((f) => !f.startsWith(INTERNAL_FLAG));
}

/** Human text for why an action is unavailable. */
export function failureText(reason: ActionFailure): string {
  return t(`ui.failure.${reason}`, { hype: t('term.hype'), cash: t('term.cash') });
}
