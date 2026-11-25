/**
 * Daily challenge and front page content: the contract between a theme pack and the UI's
 * daily challenge (src/ui/daily), share card (src/ui/share) and front page (src/ui/frontpage).
 * It lives outside `ContentPack` (src/engine/types.ts is shared and frozen), like the map
 * geometry and the lab names: the engine never reads it. Every twist is built only from what
 * `GameSetup` already offers (a start bonus for the player's lab and the rival list).
 *
 * Text lives in the pack's `strings` under fixed key families (see docs/DAILY.md):
 *   pack.title                               the game's name in share text and the paper's footer
 *   daily.twist.<id>.name / .desc            the twist, one short line each
 *   share.ending.<trigger>                   the ending as a short phrase for the share text
 *   front.paper.<n>                          newspaper names (the masthead)
 *   front.motto / front.price                masthead small print
 *   front.headline.<trigger>.<n>             one huge headline per ending family
 *   front.sub.<trigger>.<n>                  its subheadline
 *   front.story.<type>.<n>.head / .body      side stories drawn from the run
 *   front.weather.title, front.weather.<meter>.<low|mid|high>   the "weather" box
 *   front.caption.<n>                        the caption under the map "photo"
 *   front.markets.title                      the box of final world shares
 * `<n>` counts from 1 with no gaps; `validateDaily` requires at least MIN_VARIANTS of each.
 */
import { z } from 'zod';

import type { ContentPack, StartBonus } from '@/engine/types';

import { ALLOWED_PLACEHOLDERS, DAILY_PLACEHOLDERS, modifierSchema, TRIGGERS } from './validate';

/** One twist of the day. Only GameSetup levers: a start bonus for the player and the rival list. */
export interface DailyTwistDef {
  id: string;
  /** Short name, may use {rival} (the day's rival when `rivals` is set). */
  nameKey: string;
  /** One line for the start screen card, may use {rival}. */
  descKey: string;
  /** Applied to the player's lab only (GameSetup.bonus). */
  bonus?: StartBonus;
  /** Only this many rivals take part, picked from the date (GameSetup.rivalIds). */
  rivals?: number;
}

export interface DailyContent {
  /** UTC date (YYYY-MM-DD) of daily number 1. */
  epoch: string;
  /** Run length id of every daily (falls back to the pack default when unknown). */
  runLength: string;
  /** Difficulty id; absent = the pack default. */
  difficulty?: string;
  /** Home regions a daily may start in (fair starts); absent = every region no rival calls home. */
  homeRegions?: string[];
  twists: DailyTwistDef[];
}

/** Side-story types on the front page, in the order they are preferred. */
export const STORY_TYPES = ['acquisition', 'rivalLaunch', 'crisisRegulation', 'crisisBacklash', 'launch', 'event', 'ban', 'home'] as const;
export type StoryType = (typeof STORY_TYPES)[number];

/** Meters in the weather box and their three levels. */
export const WEATHER_METERS = ['regulation', 'backlash', 'rival'] as const;
export const WEATHER_LEVELS = ['low', 'mid', 'high'] as const;

/** At least this many variants per headline, subheadline, story type and newspaper name. */
export const MIN_VARIANTS = 3;

/** Placeholders each family may use (front-page templates are checked against these). */
export const FAMILY_PLACEHOLDERS: Record<string, readonly string[]> = {
  headline: ['lab', 'rival', 'region', 'amount', 'pct'],
  sub: ['lab', 'rival', 'region', 'amount', 'pct'],
  'story.launch': ['lab', 'model', 'tier', 'amount'],
  'story.rivalLaunch': ['lab', 'rival', 'model', 'tier', 'amount'],
  'story.acquisition': ['lab', 'rival', 'amount'],
  'story.crisisRegulation': ['lab', 'pct', 'amount'],
  'story.crisisBacklash': ['lab', 'pct', 'amount'],
  'story.event': ['lab', 'event', 'choice', 'amount'],
  'story.ban': ['lab', 'region', 'amount'],
  'story.home': ['lab', 'region'],
  weather: ['pct'],
  caption: ['lab', 'amount'],
  twist: ['rival'],
};

/** Length limits (characters, after nothing is substituted) so the page fits a phone screenshot. */
export const FRONT_LIMITS = { paper: 28, headline: 72, sub: 130, head: 34, body: 150, twistName: 34, twistDesc: 70, shareEnding: 32, caption: 80 } as const;

const twistSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  nameKey: z.string().min(1),
  descKey: z.string().min(1),
  bonus: z
    .strictObject({
      startHype: z.number().finite().optional(),
      startCash: z.number().finite().optional(),
      modifiers: z.array(modifierSchema).optional(),
    })
    .optional(),
  rivals: z.number().int().min(1).optional(),
});

export const dailySchema = z.strictObject({
  epoch: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  runLength: z.string().min(1),
  difficulty: z.string().min(1).optional(),
  homeRegions: z.array(z.string().min(1)).min(1).optional(),
  twists: z.array(twistSchema).min(1),
});

/** How many numbered variants `<prefix>.1`, `<prefix>.2` ... (with `suffix`) the table has, counting until the first gap. */
export function variantCount(table: Readonly<Record<string, string>>, prefix: string, suffix = ''): number {
  let n = 0;
  while (`${prefix}.${n + 1}${suffix}` in table) n++;
  return n;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]);
}

/**
 * Problems with a pack's daily content and its text; empty when valid. Checks the shape, the
 * references (regions, rivals, run length, difficulty), every key family in every locale (the
 * first locale is the base and must be complete), placeholders per family, lengths, and in
 * Turkish that no case suffix is glued to a placeholder ("{region}'da").
 */
export function validateDaily(content: unknown, pack: ContentPack): string[] {
  const problems: string[] = [];
  const err = (m: string) => problems.push(m);
  const parsed = dailySchema.safeParse(content);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) err(`daily.${issue.path.join('.')}: ${issue.message}`);
    return problems;
  }
  const daily = parsed.data;
  if (Number.isNaN(Date.parse(`${daily.epoch}T00:00:00Z`))) err(`daily.epoch: not a date: ${daily.epoch}`);
  if (pack.runLengths?.length && !pack.runLengths.some((r) => r.id === daily.runLength)) err(`daily.runLength: unknown run length "${daily.runLength}"`);
  if (daily.difficulty && !pack.difficulties?.some((d) => d.id === daily.difficulty)) err(`daily.difficulty: unknown difficulty "${daily.difficulty}"`);
  for (const r of daily.homeRegions ?? []) if (!pack.regions.some((x) => x.id === r)) err(`daily.homeRegions: unknown region "${r}"`);
  const ids = new Set<string>();
  for (const tw of daily.twists) {
    if (ids.has(tw.id)) err(`daily.twists: duplicate id "${tw.id}"`);
    ids.add(tw.id);
    if (tw.rivals !== undefined && tw.rivals > pack.rivals.length) err(`daily.twists.${tw.id}: rivals ${tw.rivals} > ${pack.rivals.length} in the pack`);
  }

  const [baseLocale, base] = Object.entries(pack.strings)[0] ?? ['', {}];
  const keys: { key: string; family: string; max?: number }[] = [{ key: 'pack.title', family: 'none' }, { key: 'front.motto', family: 'none' }, { key: 'front.price', family: 'none' }, { key: 'front.weather.title', family: 'none' }, { key: 'front.markets.title', family: 'none' }];
  for (const tw of daily.twists) {
    keys.push({ key: tw.nameKey, family: 'twist', max: FRONT_LIMITS.twistName }, { key: tw.descKey, family: 'twist', max: FRONT_LIMITS.twistDesc });
  }
  const counted = (prefix: string, family: string, max: number, suffixes: string[] = ['']) => {
    const n = Math.min(...suffixes.map((s) => variantCount(base, prefix, s)));
    if (n < MIN_VARIANTS) err(`strings.${baseLocale}: ${prefix}.<n>${suffixes.join('/')} has ${n} variants (min ${MIN_VARIANTS})`);
    for (let i = 1; i <= n; i++) {
      for (const s of suffixes) keys.push({ key: `${prefix}.${i}${s}`, family, max: s === '.head' ? FRONT_LIMITS.head : s === '.body' ? FRONT_LIMITS.body : max });
    }
  };
  counted('front.paper', 'none', FRONT_LIMITS.paper);
  counted('front.caption', 'caption', FRONT_LIMITS.caption);
  for (const trigger of TRIGGERS) {
    keys.push({ key: `share.ending.${trigger}`, family: 'none', max: FRONT_LIMITS.shareEnding });
    counted(`front.headline.${trigger}`, 'headline', FRONT_LIMITS.headline);
    counted(`front.sub.${trigger}`, 'sub', FRONT_LIMITS.sub);
  }
  for (const type of STORY_TYPES) counted(`front.story.${type}`, `story.${type}`, 0, ['.head', '.body']);
  for (const m of WEATHER_METERS) for (const l of WEATHER_LEVELS) keys.push({ key: `front.weather.${m}.${l}`, family: 'weather', max: 30 });

  const known = new Set([...ALLOWED_PLACEHOLDERS, ...DAILY_PLACEHOLDERS]);
  for (const [locale, table] of Object.entries(pack.strings)) {
    for (const { key, family, max } of keys) {
      const text = table[key];
      if (text === undefined) {
        if (locale === baseLocale) err(`strings.${locale}: missing daily key "${key}"`);
        continue;
      }
      const allowed = FAMILY_PLACEHOLDERS[family] ?? [];
      for (const p of placeholders(text)) {
        if (!known.has(p) || !allowed.includes(p)) err(`strings.${locale}: "${key}" may not use {${p}} (allowed: ${allowed.join(', ') || 'none'})`);
      }
      if (max && text.length > max) err(`strings.${locale}: "${key}" is ${text.length} chars (max ${max})`);
      if (locale === 'tr' && /\}['’]/.test(text)) err(`strings.tr: "${key}" glues a suffix to a placeholder (docs/GLOSSARY.tr.md)`);
      // English possessives break on names ending in s ("Hopefuls's"): write around them.
      if (locale === 'en' && /\}['’]s\b/.test(text)) err(`strings.en: "${key}" puts 's after a placeholder`);
    }
  }
  return problems;
}
