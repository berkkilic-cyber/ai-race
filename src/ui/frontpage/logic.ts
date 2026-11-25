/**
 * The end-of-run front page as data: masthead, one huge headline for the ending, a
 * subheadline, two or three side stories drawn from what actually happened (./story.ts), a
 * "weather" box with the final meters and a footer. All text comes from the pack's
 * `front.*` templates (src/content/daily.ts); each choice of template is deterministic from
 * the run's seed, so the same run always prints the same page. No React.
 */
import { getMeters, getWorldShare, type ContentPack, type GameState } from '@/engine';
import { STORY_TYPES, variantCount, WEATHER_METERS, type StoryType } from '@/content';

import { hashString, seededRandom } from '../daily/logic';
import { fmtInt, fmtPct } from '../format';
import { t, type Params } from '../i18n';
import { SHARE_LINK_SHORT } from '../share/link';
import type { RunStory } from './story';

/** A meter peak at or above this makes a crisis story. */
export const CRISIS_AT = 50;
/** Side stories on the page. */
export const MAX_STORIES = 3;

export interface FrontStory {
  type: StoryType;
  head: string;
  body: string;
}

export interface WeatherLine {
  meter: (typeof WEATHER_METERS)[number];
  label: string;
  value: string;
  forecast: string;
}

export interface FrontPage {
  paper: string;
  motto: string;
  price: string;
  /** "Daily edition No. 25" or "Late edition". */
  edition: string;
  /** "Day 212". */
  day: string;
  headline: string;
  sub: string;
  /** 0 (short headline, biggest type) to 2 (long, smallest). */
  headlineScale: 0 | 1 | 2;
  stories: FrontStory[];
  /** Under the map "photo". */
  caption: string;
  weatherTitle: string;
  weather: WeatherLine[];
  footer: string;
  /** Which template variants were used (tests, and keeping pages apart). */
  picks: Record<string, number>;
}

/** Variant `n` (1-based) of a numbered template family, chosen from the seed and a salt. */
function pickVariant(pack: ContentPack, prefix: string, seed: number, salt: string, suffix = ''): number {
  const n = variantCount(pack.strings.en ?? {}, prefix, suffix);
  if (n <= 0) return 1;
  return (hashString(`${seed}:${salt}`) % n) + 1;
}

const pct = (v: number) => fmtPct(Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)) / 100);

function level(v: number): 'low' | 'mid' | 'high' {
  return v >= 70 ? 'high' : v >= 35 ? 'mid' : 'low';
}

/** The strongest rival at the end: the winner if a rival won, else the one with the most AGI progress. */
function topRival(state: GameState): string | undefined {
  if (state.ending?.winnerLabId && state.ending.winnerLabId !== state.playerLabId) return state.ending.winnerLabId;
  let best: string | undefined;
  let value = -1;
  for (const id of state.labOrder) {
    if (id === state.playerLabId) continue;
    const lab = state.labs[id];
    if (lab.agiProgress > value) {
      value = lab.agiProgress;
      best = id;
    }
  }
  return best;
}

function eventTexts(pack: ContentPack, eventId: string, choiceId: string): { event: string; choice: string } | null {
  const def = pack.events.find((e) => e.id === eventId);
  const choice = def?.choices.find((c) => c.id === choiceId);
  if (!def || !choice) return null;
  return { event: t(def.titleKey), choice: t(choice.labelKey) };
}

/** Params for each side-story type that the run can fill, or null when it has nothing to tell. */
export function storyParams(type: StoryType, state: GameState, story: RunStory | null, pack: ContentPack): Params | null {
  const lab = state.playerLabId;
  const me = state.labs[lab];
  const trigger = state.ending?.trigger;
  const reg = story?.peak.regulation;
  const back = story?.peak.backlash;
  switch (type) {
    case 'acquisition':
      return story?.acquisition ? { lab, rival: story.acquisition.rival, amount: fmtInt(story.acquisition.tick + 1) } : null;
    case 'rivalLaunch':
      return story?.rivalLaunch ? { lab, rival: story.rivalLaunch.rival, model: story.rivalLaunch.model, tier: story.rivalLaunch.tier, amount: fmtInt(story.rivalLaunch.tick + 1) } : null;
    case 'crisisRegulation':
      // The worst crisis only, and not the one the headline is already about.
      if (!reg || !back || reg.value < CRISIS_AT || reg.value < back.value || trigger === 'banned') return null;
      return { lab, pct: pct(reg.value), amount: fmtInt(reg.tick + 1) };
    case 'crisisBacklash':
      if (!reg || !back || back.value < CRISIS_AT || back.value <= reg.value || trigger === 'revolt') return null;
      return { lab, pct: pct(back.value), amount: fmtInt(back.tick + 1) };
    case 'launch':
      return story?.firstLaunch ? { lab, model: story.firstLaunch.model, tier: story.firstLaunch.tier, amount: fmtInt(story.firstLaunch.tick + 1) } : null;
    case 'event': {
      const texts = story?.event ? eventTexts(pack, story.event.eventId, story.event.choiceId) : null;
      return texts && story?.event ? { lab, event: texts.event, choice: texts.choice, amount: fmtInt(story.event.tick + 1) } : null;
    }
    case 'ban':
      return story?.firstBan ? { lab, region: story.firstBan.region, amount: fmtInt(story.bans) } : null;
    case 'home':
      return { lab, region: me.homeRegion };
  }
}

/** The headline's family params: {pct} is the number that matters for that ending. */
export function headlineParams(state: GameState, pack: ContentPack): Params {
  const e = state.ending!;
  const me = state.labs[state.playerLabId];
  const rival = topRival(state);
  let value: number;
  switch (e.trigger) {
    case 'banned':
      value = me.regulation;
      break;
    case 'revolt':
      value = me.backlash;
      break;
    case 'rivalAgi':
      value = me.agiProgress;
      break;
    default:
      value = getWorldShare(state, pack, state.playerLabId) * 100;
  }
  return { lab: state.playerLabId, ...(rival ? { rival } : {}), region: me.homeRegion, amount: fmtInt(e.tick + 1), pct: pct(value) };
}

/**
 * Picks the side stories: the most newsworthy one the run has (a rival bought, a rival launch
 * that beat the player, a meter crisis) first, then the rest in a seeded shuffle.
 */
export function chooseStories(state: GameState, story: RunStory | null, pack: ContentPack, max = MAX_STORIES): { type: StoryType; params: Params }[] {
  const available = STORY_TYPES.map((type) => ({ type, params: storyParams(type, state, story, pack) })).filter((s): s is { type: StoryType; params: Params } => s.params !== null);
  const lead = available.find((s) => s.type === 'acquisition' || s.type === 'rivalLaunch' || s.type === 'crisisRegulation' || s.type === 'crisisBacklash');
  const rest = available.filter((s) => s !== lead);
  const random = seededRandom(hashString(`${state.seed}:stories`));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...(lead ? [lead] : []), ...rest].slice(0, max);
}

export interface FrontPageOptions {
  /** The daily's number when this run was the scored daily (else a regular edition). */
  dailyNumber?: number;
}

/** The whole front page for a finished run (null when the run has no ending). */
export function buildFrontPage(state: GameState, pack: ContentPack, story: RunStory | null, opts: FrontPageOptions = {}): FrontPage | null {
  const e = state.ending;
  if (!e) return null;
  const seed = state.seed;
  const picks: Record<string, number> = {};
  const pick = (prefix: string, salt: string, suffix = '') => (picks[prefix] = pickVariant(pack, prefix, seed, salt, suffix));

  const paper = t(`front.paper.${pick('front.paper', 'paper')}`);
  const hp = headlineParams(state, pack);
  const headline = t(`front.headline.${e.trigger}.${pick(`front.headline.${e.trigger}`, 'headline')}`, hp);
  const sub = t(`front.sub.${e.trigger}.${pick(`front.sub.${e.trigger}`, 'sub')}`, hp);
  const stories = chooseStories(state, story, pack).map(({ type, params }) => {
    const n = pick(`front.story.${type}`, `story:${type}`, '.head');
    return { type, head: t(`front.story.${type}.${n}.head`, params), body: t(`front.story.${type}.${n}.body`, params) };
  });
  const meters = getMeters(state, state.playerLabId);
  const weather: WeatherLine[] = WEATHER_METERS.map((meter) => {
    const v = meters[meter];
    return { meter, label: t(`term.${meter}`), value: pct(v), forecast: t(`front.weather.${meter}.${level(v)}`) };
  });
  const length = headline.length;
  return {
    paper,
    motto: t('front.motto'),
    price: t('front.price'),
    edition: opts.dailyNumber !== undefined ? t('ui.front.editionDaily', { number: opts.dailyNumber }) : t('ui.front.editionLate'),
    day: t('ui.front.day', { day: fmtInt(e.tick + 1) }),
    headline,
    sub,
    headlineScale: length <= 44 ? 0 : length <= 64 ? 1 : 2,
    stories,
    caption: t(`front.caption.${pick('front.caption', 'caption')}`, { lab: state.playerLabId, amount: fmtInt(e.tick + 1) }),
    weatherTitle: t('front.weather.title'),
    weather,
    footer: t('ui.front.footer', { title: t('pack.title'), link: SHARE_LINK_SHORT }),
    picks,
  };
}

/** Every text on the page, for checks (no leftover placeholders, no empty lines). */
export function frontPageTexts(page: FrontPage): string[] {
  return [page.paper, page.motto, page.price, page.edition, page.day, page.headline, page.sub, ...page.stories.flatMap((s) => [s.head, s.body]), page.caption, page.weatherTitle, ...page.weather.flatMap((w) => [w.label, w.value, w.forecast]), page.footer];
}
