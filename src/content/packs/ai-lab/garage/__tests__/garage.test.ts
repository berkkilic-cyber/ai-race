import { aiLabPack } from '@/content';
import { validateGarage } from '@/idle';

import { aiLabGarage as garage } from '..';
import data from '../garage.json';
import strings from '../strings.en.json';

const BRAND_NAMES = Object.entries(aiLabPack.strings.en)
  .filter(([k]) => /^brand\.[a-z0-9-]+\.name$/.test(k))
  .map(([, v]) => v);

describe('ai-lab garage content', () => {
  it('passes validation', () => {
    expect(validateGarage(garage)).toEqual([]);
  });

  it('has about ten generator tiers with rising cost and rate, a few unlocked by later models', () => {
    expect(garage.generators.length).toBeGreaterThanOrEqual(9);
    for (let i = 1; i < garage.generators.length; i++) {
      expect(garage.generators[i].baseRate).toBeGreaterThan(garage.generators[i - 1].baseRate);
      expect(garage.generators[i].unlockGeneration).toBeGreaterThanOrEqual(garage.generators[i - 1].unlockGeneration);
    }
    expect(garage.generators.filter((g) => g.unlockGeneration > 0).length).toBeGreaterThanOrEqual(4);
  });

  it('every named model after the first unlocks a tier or carries a perk', () => {
    garage.generations.slice(1).forEach((g, i) => {
      const n = i + 1;
      const tier = garage.generators.some((x) => x.unlockGeneration === n);
      expect({ model: g.id, unlocks: tier || g.perks.length > 0 }).toEqual({ model: g.id, unlocks: true });
    });
  });

  it('the first generator is affordable within about ten seconds of casual tapping', () => {
    expect(garage.generators[0].baseCost / garage.tap.base).toBeLessThanOrEqual(30);
  });

  it('every string is used and every key has a string', () => {
    const used = new Set<string>();
    JSON.stringify(data, (k, v) => {
      if (typeof v === 'string' && v.startsWith('garage.')) used.add(v);
      return v;
    });
    for (const key of used) expect({ key, has: key in strings }).toEqual({ key, has: true });
    for (const key of Object.keys(strings)) expect({ key, used: used.has(key) }).toEqual({ key, used: true });
  });

  it('uses only known placeholders, each where it is filled', () => {
    const allowed: [RegExp, string[]][] = [
      [/^garage\.incident\./, ['tier']],
      [/^garage\.model\.endless\./, ['n']],
      [/^garage\.news\.achievement$/, ['name']],
      [/^garage\.perk\./, ['amount']],
      [/^garage\.trait\./, ['value']],
      [/^garage\.stage\.[a-z]+\.unlock$/, []],
      [/^garage\.shipday\.reaction\./, ['rival']],
    ];
    for (const [key, text] of Object.entries(strings)) {
      const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const ok = allowed.find(([re]) => re.test(key))?.[1] ?? [];
      for (const p of found) expect({ key, p, ok: ok.includes(p) }).toEqual({ key, p, ok: true });
    }
    for (const p of garage.labRep.perks) expect(strings[p.textKey as keyof typeof strings]).toContain('{amount}');
  });

  it('mentions no real companies, products or people', () => {
    const banned = [
      'OpenAI', 'Anthropic', 'Claude', 'ChatGPT', 'GPT', 'Gemini', 'Bard', 'Google', 'DeepMind', 'Microsoft', 'Copilot', 'Meta', 'Llama',
      'Nvidia', 'NVIDIA', 'Mistral', 'xAI', 'Grok', 'DeepSeek', 'Qwen', 'Baidu', 'Amazon', 'AWS', 'Apple', 'Siri', 'Alexa', 'Tesla',
      'SpaceX', 'Starlink', 'Altman', 'Musk', 'Zuckerberg', 'Hassabis', 'Amodei', 'Cookie Clicker', 'AdMob',
    ];
    const text = Object.values(strings).join('\n');
    for (const word of banned) expect({ word, hit: new RegExp(`\\b${word}\\b`).test(text) }).toEqual({ word, hit: false });
  });

  it('parody brands appear only in light flavour: headlines, golden moments and hardware jokes', () => {
    const allowed = /^garage\.(headline\.|golden\.|shipday\.rival\.|shipday\.bench\.|gen\.gpu\.desc$|up\.gpu-b\.desc$|up\.global-3\.desc$)/;
    for (const [key, text] of Object.entries(strings)) {
      const brands = BRAND_NAMES.filter((name) => text.includes(name));
      if (brands.length > 0) expect({ key, brands, allowed: allowed.test(key) }).toEqual({ key, brands, allowed: true });
    }
    // Never in incidents (the mishaps belong to the player's own garage).
    for (const [key, text] of Object.entries(strings)) if (key.startsWith('garage.incident.')) expect(BRAND_NAMES.some((b) => text.includes(b))).toBe(false);
  });

  it('defines every ad-backed offer with a cooldown and a daily cap', () => {
    for (const o of garage.offers) {
      expect(o.dailyCap).toBeGreaterThanOrEqual(1);
      expect(o.cooldownMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('has five stages, each switching on something new, unlocked by progress that never resets', () => {
    const stages = garage.stages ?? [];
    expect(stages.length).toBeGreaterThanOrEqual(4);
    expect(new Set(stages.map((s) => s.mechanic)).size).toBe(stages.length);
    expect(new Set(stages.map((s) => s.scene)).size).toBe(stages.length);
    expect(stages[1].mechanic).toBe('training');
    expect(stages[2].mechanic).toBe('staff');
  });

  it('training candidates have enough variety for a real choice', () => {
    const t = garage.training!;
    expect(t.rarities.length).toBeGreaterThanOrEqual(3);
    expect(new Set(t.traits.map((x) => x.stat)).size).toBeGreaterThanOrEqual(6);
    expect(t.drawbacks.length).toBeGreaterThanOrEqual(4);
    expect(t.prefixKeys.length * t.suffixKeys.length).toBeGreaterThanOrEqual(100);
  });

  it('lab happenings come every 20 to 40 seconds, expire on their own and never cost much', () => {
    const h = garage.happenings!;
    expect(h.intervalMinMs).toBeGreaterThanOrEqual(20_000);
    expect(h.intervalMaxMs).toBeLessThanOrEqual(40_000);
    expect(h.lifetimeMs).toBeLessThan(h.intervalMinMs);
    expect(h.penaltyCapShare).toBeLessThanOrEqual(0.05);
    expect(h.defs.length).toBeGreaterThanOrEqual(8);
  });

  it('has some secret achievements', () => {
    expect(garage.achievements.filter((a) => a.secret).length).toBeGreaterThanOrEqual(3);
  });
});
