/// <reference types="node" />
/**
 * The ai-lab pack against the real engine: strings for every news key the engine
 * emits, and ids in the params of every {lab}/{rival}/{region} placeholder.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { ENGINE_NEWS_KEYS, getEndingParams, runHeadless, type BotPolicy, type ContentPack, type GameState } from '@/engine';

import { aiLabPack, REQUIRED_KEYS, validatePack } from '..';

const en = aiLabPack.strings.en;
const ENGINE_DIR = join(__dirname, '..', '..', 'engine');
const engineSources = readdirSync(ENGINE_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(join(ENGINE_DIR, f), 'utf8'));

describe('engine news keys', () => {
  it('every ENGINE_NEWS_KEYS key the engine uses exists, and has a string in the pack', () => {
    const used = new Set(engineSources.flatMap((src) => [...src.matchAll(/ENGINE_NEWS_KEYS\.(\w+)/g)].map((m) => m[1])));
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect({ name, known: name in ENGINE_NEWS_KEYS }).toEqual({ name, known: true });
      const key = ENGINE_NEWS_KEYS[name as keyof typeof ENGINE_NEWS_KEYS];
      expect({ key, text: typeof en[key] }).toEqual({ key, text: 'string' });
    }
  });

  it('the engine never emits a news key outside ENGINE_NEWS_KEYS (no literal engine.news keys)', () => {
    const literals = engineSources.flatMap((src) => [...src.matchAll(/['"`](engine\.news\.[\w.]+)['"`]/g)].map((m) => m[1]));
    for (const key of literals) expect(Object.values(ENGINE_NEWS_KEYS)).toContain(key);
  });

  it('every engine news key and UI term has a string, and validatePack requires them', () => {
    for (const key of REQUIRED_KEYS) expect({ key, text: typeof en[key] }).toEqual({ key, text: 'string' });
    const broken = JSON.parse(JSON.stringify(aiLabPack)) as ContentPack;
    delete broken.strings.en[ENGINE_NEWS_KEYS.ban];
    delete broken.strings.en['term.hype'];
    const problems = validatePack(broken);
    expect(problems).toContain(`strings.en: missing key "${ENGINE_NEWS_KEYS.ban}"`);
    expect(problems).toContain('strings.en: missing key "term.hype"');
  });
});

describe('placeholder params in real runs', () => {
  // Keep every news item so the whole run can be checked.
  const pack: ContentPack = { ...aiLabPack, balance: { ...aiLabPack.balance, newsLogSize: 100_000 } };
  const regionIds = new Set(pack.regions.map((r) => r.id));
  const POLICIES: BotPolicy[] = ['sensible', 'random', 'idle'];
  const NAMES = ['Bot Lab', 'Eliza', 'Paperclips', '42'];
  const runs: GameState[] = [];

  beforeAll(() => {
    for (let i = 0; i < 8; i++) {
      runs.push(
        runHeadless(
          pack,
          { playerName: NAMES[i % NAMES.length], founderId: pack.founders[i % 3].id, homeRegion: pack.regions[(i * 7) % 40].id, seed: 900 + i },
          { policy: POLICIES[i % POLICIES.length], maxTicks: 8000 },
        ),
      );
    }
  });

  const missing = (text: string, params: Record<string, string | number> | undefined, state: GameState): string[] =>
    [...text.matchAll(/\{(lab|rival|region)\}/g)].flatMap(([, name]) => {
      const value = params?.[name];
      const ok = typeof value === 'string' && (name === 'region' ? regionIds.has(value) : value in state.labs);
      return ok ? [] : [`{${name}}=${JSON.stringify(value)}`];
    });

  it('every news item (engine, headline, effect) fills its placeholders with lab and region ids', () => {
    const problems = new Set<string>();
    let checked = 0;
    for (const state of runs) {
      for (const item of state.news) {
        const text = en[item.textKey];
        if (text === undefined) problems.add(`${item.textKey}: no string`);
        else for (const p of missing(text, item.params, state)) problems.add(`${item.textKey}: ${p}`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect([...problems]).toEqual([]);
  });

  it('ending title and body placeholders are filled by getEndingParams', () => {
    for (const state of runs) {
      expect(state.ending).not.toBeNull();
      const def = pack.endings.find((e) => e.id === state.ending!.endingId)!;
      const params = getEndingParams(state);
      expect(missing(en[def.titleKey] + en[def.bodyKey], params, state)).toEqual([]);
    }
  });

  it('only rivalAgi endings use {rival} (only they have another winner)', () => {
    for (const def of pack.endings) {
      const usesRival = /\{rival\}/.test(en[def.titleKey] + en[def.bodyKey]);
      if (usesRival) expect(def.trigger).toBe('rivalAgi');
    }
  });

  it('player headlines carry the player id, rival headlines a rival id', () => {
    const byKey = new Map(pack.headlines.map((h) => [h.textKey, h]));
    for (const state of runs) {
      for (const item of state.news) {
        const headline = byKey.get(item.textKey);
        if (!headline) continue;
        if (headline.about === 'rival') expect(item.params?.lab).not.toBe(state.playerLabId);
        else expect(item.params?.lab).toBe(state.playerLabId);
      }
    }
  });
});
