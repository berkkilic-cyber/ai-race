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

  it('the long game: at least 24 named models, a Paradigm tree of 12 to 16 nodes after the last original one, the race-start perks untouched', () => {
    expect(garage.generations.length).toBeGreaterThanOrEqual(24);
    const p = garage.paradigm!;
    expect(p.minGeneration).toBe(11);
    expect(p.nodes.length).toBeGreaterThanOrEqual(12);
    expect(p.nodes.length).toBeLessThanOrEqual(16);
    // Mostly mechanics, not plain multipliers.
    expect(p.nodes.filter((n) => n.effect.kind === 'globalMult' || n.effect.kind === 'tapMult').length).toBeLessThanOrEqual(3);
    const race = garage.labRep.perks.filter((x) => ['startCash', 'startHype', 'hypeIncome', 'cashIncome'].includes(x.effect.kind)).map((x) => [x.id, x.rep, x.effect.kind, x.effect.amount]);
    expect(race).toEqual([
      ['seed-round', 1, 'startCash', 1],
      ['press-list', 3, 'startHype', 3],
      ['fan-club', 9, 'hypeIncome', 0.005],
      ['old-friends', 16, 'cashIncome', 0.005],
      ['lucky-breaks', 20, 'startCash', 1],
      ['insider-list', 38, 'startHype', 2],
    ]);
    expect(garage.labRep.perks.some((x) => x.effect.kind === 'awayHours')).toBe(true);
  });

  it('away storage: 2 h at the start, about 8 h from upgrades, models and perks, a 12 h paid field', () => {
    expect(garage.offline.capHours).toBe(2);
    expect(garage.offline.paidCapHours).toBe(12);
    const ups = garage.upgrades.flatMap((u) => u.effects).filter((e) => e.kind === 'offlineCap').reduce((s, e) => s + (e.kind === 'offlineCap' ? e.hours : 0), 0);
    const gens = garage.generations.flatMap((g) => g.perks).reduce((s, e) => s + (e.kind === 'offlineCap' ? e.hours : 0), 0);
    const perks = garage.labRep.perks.reduce((s, x) => s + (x.effect.kind === 'awayHours' ? x.effect.amount : 0), 0);
    expect(garage.offline.capHours + ups + gens + perks).toBe(8);
  });

  it('the first generator is affordable within about ten seconds of casual tapping', () => {
    expect(garage.generators[0].baseCost / garage.tap.base).toBeLessThanOrEqual(30);
  });

  it('has a Lab Rep ladder of about twelve perks up to roughly Rep 60, power and cosmetic mixed, each named with a quip', () => {
    const perks = garage.labRep.perks;
    expect(perks.length).toBeGreaterThanOrEqual(10);
    expect(perks.length).toBeLessThanOrEqual(14);
    expect(perks[0].rep).toBe(1);
    expect(perks[perks.length - 1].rep).toBeGreaterThanOrEqual(50);
    expect(perks[perks.length - 1].rep).toBeLessThanOrEqual(70);
    const cosmetic = perks.filter((p) => p.effect.kind === 'title' || p.effect.kind === 'frame');
    expect(cosmetic.length).toBeGreaterThanOrEqual(4);
    expect(perks.length - cosmetic.length).toBeGreaterThanOrEqual(4);
    for (const p of perks) {
      expect({ id: p.id, name: !!p.nameKey && p.nameKey in strings, quip: !!p.quipKey && p.quipKey in strings }).toEqual({ id: p.id, name: true, quip: true });
    }
    // Every power perk maps to a race start bonus (momentRate has no race equivalent, so none uses it).
    expect(perks.some((p) => p.effect.kind === 'momentRate')).toBe(false);
  });

  it('race rewards: a loss pays less than a win, a sprint less than a full run, harder levels more', () => {
    const r = garage.raceReward!;
    expect(r.lossFactor).toBeLessThan(1);
    expect(r.runLength.sprint).toBeLessThan(r.runLength.full);
    const ids = (aiLabPack.difficulties ?? []).map((d) => d.id);
    expect(Object.keys(r.difficulty).sort()).toEqual([...ids].sort());
    const factors = ids.map((id) => r.difficulty[id]);
    expect([...factors].sort((a, b) => a - b)).toEqual(factors);
    expect(Object.keys(r.runLength).sort()).toEqual((aiLabPack.runLengths ?? []).map((l) => l.id).sort());
    expect(r.repeatFactor).toBeLessThanOrEqual(0.5);
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
      [/^garage\.mission\./, ['a', 'b']],
      [/^garage\.paradigm\.news$/, ['n']],
    ];
    for (const [key, text] of Object.entries(strings)) {
      const found = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const ok = allowed.find(([re]) => re.test(key))?.[1] ?? [];
      for (const p of found) expect({ key, p, ok: ok.includes(p) }).toEqual({ key, p, ok: true });
    }
    for (const p of garage.labRep.perks) {
      const text = strings[p.textKey as keyof typeof strings];
      // Power perks show their amount; cosmetic ones (title, frame) have none.
      if (p.effect.kind === 'title' || p.effect.kind === 'frame') expect(text).not.toContain('{amount}');
      else expect(text).toContain('{amount}');
    }
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
