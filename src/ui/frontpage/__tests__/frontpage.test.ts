import { aiLabDaily, STORY_TYPES, variantCount } from '@/content';
import { runHeadless, type BotPolicy, type EndingTrigger, type GameState } from '@/engine';

import { addDays, dailyFor, dailyGameSetup } from '../../daily/logic';
import { setI18nContext, t } from '../../i18n';
import { setCurrentLocale } from '../../locale/current';
import { getPackEntry } from '../../packs';
import { buildFrontPage, chooseStories, frontPageTexts, headlineParams, storyParams } from '../logic';
import { createRecorder, observe, raceCells, type RunStory } from '../story';

const { pack } = getPackEntry();
const POLICIES: BotPolicy[] = ['sensible', 'shadow', 'random', 'idle', 'reach', 'capability'];
const RUNS = 240;

interface Run {
  state: GameState;
  story: RunStory;
}

function play(i: number): Run {
  const day = dailyFor(addDays('2026-11-01', i), pack, aiLabDaily);
  let rec: ReturnType<typeof createRecorder> | null = null;
  const state = runHeadless(pack, dailyGameSetup(day, `Front Page Lab ${i}`), {
    policy: POLICIES[i % POLICIES.length],
    maxTicks: 6000,
    onTick: (s) => {
      rec ??= createRecorder(s);
      observe(rec, s, pack);
    },
  });
  return { state: structuredClone(state), story: rec!.story };
}

const runs: Run[] = Array.from({ length: RUNS }, (_, i) => play(i));
const leftover = /\{[a-zA-Z]+\}/;

afterAll(() => setCurrentLocale('en'));

describe('front page from simulated runs', () => {
  it('reaches every ending family', () => {
    const triggers = new Set(runs.map((r) => r.state.ending?.trigger));
    expect([...triggers].sort()).toEqual(['agi', 'banned', 'dependence', 'monopoly', 'revolt', 'rivalAgi']);
  });

  it.each(['en', 'tr'] as const)('renders every run with no leftover placeholders (%s)', (locale) => {
    setCurrentLocale(locale);
    for (const { state, story } of runs) {
      setI18nContext(pack, state.labs);
      const page = buildFrontPage(state, pack, story, { dailyNumber: 25 })!;
      expect(page).not.toBeNull();
      for (const text of frontPageTexts(page)) {
        expect(text.trim()).not.toBe('');
        expect([text, leftover.test(text)]).toEqual([text, false]);
      }
      expect(page.stories.length).toBeGreaterThanOrEqual(2);
      expect(page.stories.length).toBeLessThanOrEqual(3);
      // The player's typed name is on the page.
      expect(page.headline + page.sub + page.stories.map((s) => s.body).join('')).toContain('Front Page Lab');
    }
  });

  it.each(['en', 'tr'] as const)('renders every template variant of every family with real run params (%s)', (locale) => {
    setCurrentLocale(locale);
    const byTrigger = new Map<EndingTrigger, Run>();
    for (const r of runs) if (r.state.ending && !byTrigger.has(r.state.ending.trigger)) byTrigger.set(r.state.ending.trigger, r);
    const base = pack.strings.en;
    for (const [trigger, { state }] of byTrigger) {
      setI18nContext(pack, state.labs);
      const params = headlineParams(state, pack);
      for (const family of ['headline', 'sub']) {
        const n = variantCount(base, `front.${family}.${trigger}`);
        for (let i = 1; i <= n; i++) {
          const text = t(`front.${family}.${trigger}.${i}`, params);
          expect([text, leftover.test(text)]).toEqual([text, false]);
        }
      }
    }
    for (const type of STORY_TYPES) {
      const found = runs.find((r) => storyParams(type, r.state, r.story, pack));
      expect([type, !!found]).toEqual([type, true]);
      setI18nContext(pack, found!.state.labs);
      const params = storyParams(type, found!.state, found!.story, pack)!;
      const n = variantCount(base, `front.story.${type}`, '.head');
      for (let i = 1; i <= n; i++) {
        for (const part of ['head', 'body']) {
          const text = t(`front.story.${type}.${i}.${part}`, params);
          expect([text, leftover.test(text)]).toEqual([text, false]);
        }
      }
    }
  });

  it('is deterministic from the seed and varies between runs', () => {
    setCurrentLocale('en');
    const { state, story } = runs[0];
    setI18nContext(pack, state.labs);
    expect(buildFrontPage(state, pack, story)).toEqual(buildFrontPage(state, pack, story));
    const headlines = new Set(runs.map((r) => {
      setI18nContext(pack, r.state.labs);
      return buildFrontPage(r.state, pack, r.story)!.picks[`front.headline.${r.state.ending!.trigger}`] + r.state.ending!.trigger;
    }));
    expect(headlines.size).toBeGreaterThan(12);
  });

  it('leads with the most newsworthy story and never repeats the headline crisis', () => {
    for (const { state, story } of runs) {
      const chosen = chooseStories(state, story, pack).map((s) => s.type);
      expect(new Set(chosen).size).toBe(chosen.length);
      if (state.ending?.trigger === 'banned') expect(chosen).not.toContain('crisisRegulation');
      if (state.ending?.trigger === 'revolt') expect(chosen).not.toContain('crisisBacklash');
      if (story.acquisition) expect(chosen[0]).toBe('acquisition');
    }
  });

  it('records the AGI race in fifths', () => {
    for (const { state, story } of runs.slice(0, 30)) {
      const cells = raceCells(story, state.ending!.tick);
      expect(cells).toHaveLength(5);
      expect(cells).not.toContain('none');
    }
  });
});
