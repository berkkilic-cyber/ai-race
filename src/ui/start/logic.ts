import type { ContentPack, FounderDef, Modifier, RegionDef, Stat } from '@/engine';

import { fmtCash, fmtCompact, fmtNum, pctText } from '../format';
import { t } from '../i18n';

/** Longest lab name the start screen accepts (after trimming). */
export const MAX_LAB_NAME = 24;

export type NameProblem = 'empty' | 'tooLong';
export type NameCheck = { ok: true; name: string } | { ok: false; problem: NameProblem };

/** Trims the name, collapses inner whitespace and checks it is present and short enough. */
export function validateLabName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return { ok: false, problem: 'empty' };
  if (name.length > MAX_LAB_NAME) return { ok: false, problem: 'tooLong' };
  return { ok: true, name };
}

export interface StartChoices {
  name: string;
  founderId: string | null;
  homeRegion: string | null;
}

/** What still blocks "Found the lab", as a caption; null when everything is set. */
export function missingText(choices: StartChoices): string | null {
  const check = validateLabName(choices.name);
  if (!check.ok) return check.problem === 'empty' ? t('ui.start.missing.name') : t('ui.start.missing.nameTooLong', { max: MAX_LAB_NAME });
  if (!choices.founderId) return t('ui.start.missing.founder');
  if (!choices.homeRegion) return t('ui.start.missing.region');
  return null;
}

/** A random name from the list, never the one already in the field (when there is a choice). */
export function randomLabName(names: readonly string[], current: string, random: () => number = Math.random): string {
  if (names.length === 0) return current;
  const pool = names.length > 1 ? names.filter((n) => n !== current.trim()) : names;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

/** Default home for autostart: the first region no rival starts in. */
export function defaultHomeRegion(pack: ContentPack): string {
  return (pack.regions.find((r) => !pack.rivals.some((rv) => rv.homeRegion === r.id)) ?? pack.regions[0]).id;
}

// ───────────── Region read ─────────────

type Level = 'high' | 'mid' | 'low';

function level(v: number, low: number, high: number): Level {
  if (v >= high) return 'high';
  if (v <= low) return 'low';
  return 'mid';
}

export interface RegionReadParts {
  /** Suffix of `ui.start.read.lead.*`. */
  lead: string;
  /** Suffix of `ui.start.read.tail.*`, or null when nothing stands out. */
  tail: 'strict' | 'lax' | 'cheapPower' | 'pricyPower' | null;
  joiner: 'and' | 'but' | 'only';
}

/**
 * Classifies a region's numbers for a one-line read: wealth and openness lead,
 * then the most notable of strictness (preferred) or power cost. "but" joins a
 * tail that pulls the other way from the lead.
 */
export function regionReadParts(region: Pick<RegionDef, 'wealth' | 'openness' | 'strictness' | 'powerCost'>): RegionReadParts {
  const wealth = level(region.wealth, 0.4, 0.7);
  const openness = level(region.openness, 0.45, 0.65);
  const strict = level(region.strictness, 0.3, 0.6);
  const power = level(region.powerCost, 0.3, 0.65);
  const w = wealth === 'high' ? 'rich' : wealth === 'low' ? 'poor' : 'mid';
  const o = openness === 'high' ? 'open' : openness === 'low' ? 'wary' : 'mid';
  const leadTone = (wealth === 'high' ? 1 : wealth === 'low' ? -1 : 0) + (openness === 'high' ? 1 : openness === 'low' ? -1 : 0);

  let tail: RegionReadParts['tail'] = null;
  if (strict === 'high') tail = 'strict';
  else if (strict === 'low') tail = 'lax';
  else if (power === 'low') tail = 'cheapPower';
  else if (power === 'high') tail = 'pricyPower';

  let joiner: RegionReadParts['joiner'] = 'only';
  if (tail) {
    const tailGood = tail === 'lax' || tail === 'cheapPower';
    joiner = (leadTone > 0 && !tailGood) || (leadTone < 0 && tailGood) || (leadTone === 0 && !tailGood) ? 'but' : 'and';
  }
  return { lead: `${w}-${o}`, tail, joiner };
}

/** "Rich and open, but regulators are strict." */
export function regionRead(region: Pick<RegionDef, 'wealth' | 'openness' | 'strictness' | 'powerCost'>): string {
  const parts = regionReadParts(region);
  const lead = t(`ui.start.read.lead.${parts.lead}`);
  if (!parts.tail) return t('ui.start.read.only', { lead });
  return t(`ui.start.read.${parts.joiner}`, { lead, tail: t(`ui.start.read.tail.${parts.tail}`) });
}

// ───────────── Founder perks ─────────────

export interface PerkLine {
  text: string;
  /** Whether the line helps the player (all founder perks should). */
  tone: 'good' | 'bad' | 'neutral';
}

/** Stats where a smaller number is better for the lab. */
const LOWER_IS_BETTER: ReadonlySet<Stat> = new Set<Stat>([
  'regulationGain',
  'backlashGain',
  'riskChance',
  'dataCentreCost',
  'dataCentreUpkeep',
  'launchCost',
  'nodeCost',
  'acquireCost',
  'banDuration',
]);

function signed(n: number, suffix = ''): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${suffix === '%' ? pctText(Math.abs(rounded)) : `${fmtNum(Math.abs(rounded))}${suffix}`}`;
}

/** "+20% AGI progress", "−25% Regulation build-up", "+5 compute". */
export function modifierLine(mod: Modifier): PerkLine {
  const stat = t(`ui.start.stat.${mod.stat}`);
  const delta = mod.op === 'mul' ? mod.value - 1 : mod.value;
  const amount = mod.op === 'mul' ? signed(delta * 100, '%') : signed(delta);
  let text = t(mod.op === 'mul' ? 'ui.start.perk.mul' : 'ui.start.perk.add', { amount, stat });
  if (mod.regionTag) text = t('ui.start.perk.inTag', { text, tag: mod.regionTag });
  const better = LOWER_IS_BETTER.has(mod.stat) ? delta < 0 : delta > 0;
  return { text, tone: delta === 0 ? 'neutral' : better ? 'good' : 'bad' };
}

/**
 * Starting Hype, starting Cash, then one line per modifier. `start` is what the founder
 * really starts with at the chosen difficulty (getFounderStart); default: the founder's own.
 */
export function founderPerkLines(founder: FounderDef, start: { hype: number; cash: number } = { hype: founder.startHype, cash: founder.startCash }): PerkLine[] {
  return [
    { text: t('ui.start.perk.startHype', { amount: fmtCompact(start.hype), hype: t('term.hype') }), tone: 'neutral' },
    { text: t('ui.start.perk.startCash', { amount: fmtCash(start.cash), cash: t('term.cash') }), tone: 'neutral' },
    ...founder.modifiers.map(modifierLine),
  ];
}

/** Regions sorted by display name, filtered by a case- and accent-insensitive query. */
export function searchRegions(regions: readonly RegionDef[], query: string): RegionDef[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = fold(query.trim());
  return regions
    .map((r) => ({ r, name: t(r.nameKey) }))
    .filter(({ name }) => !q || fold(name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ r }) => r);
}
