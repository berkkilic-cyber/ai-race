import type { Condition, Effect, EventDef, TreeId } from '@/engine/types';

import { aiLabPack, MOMENT_ICONS, validatePack } from '..';

const pack = aiLabPack;
const RARE = (e: EventDef) => e.weight >= 0.01 && e.weight <= 0.05;
const allConditions = (): Condition[] => [
  ...pack.events.flatMap((e) => e.conditions),
  ...pack.headlines.flatMap((h) => h.conditions),
  ...pack.endings.flatMap((e) => e.conditions ?? []),
];
const choiceEffects = (e: EventDef): Effect[] =>
  e.choices.flatMap((c) => [...c.effects, ...(c.risk?.effects ?? [])]);

const BRAND_IDS = Object.keys(pack.strings.en).flatMap((k) => /^brand\.([a-z0-9-]+)\.name$/.exec(k)?.slice(1) ?? []);
const BRAND_NAMES = BRAND_IDS.map((id) => pack.strings.en[`brand.${id}.name`]);
/** Event, node and moment strings outside the automatic rules where a parody brand is harmless flavour. */
const FLAVOUR_KEYS = ['event.cloud-credits.body', 'event.gpu-shortage.body', 'node.cap-gpu-lease.desc', 'node.cap-gpu-megadeal.desc'];

describe('ai-lab content pack', () => {
  it('passes validation', () => {
    expect(validatePack(pack)).toEqual([]);
  });

  it('has the right identity', () => {
    expect(pack.id).toBe('ai-lab');
    expect(pack.version).toBe(1);
    expect(Object.keys(pack.balance).length).toBeGreaterThan(0);
    expect(Object.keys(pack.strings)).toEqual(['en']);
  });

  it('has 40 regions', () => {
    expect(pack.regions).toHaveLength(40);
  });

  it('has 36 nodes, 12 per tree, in rows 1 to 5 with branches', () => {
    expect(pack.nodes).toHaveLength(36);
    for (const tree of ['capability', 'reach', 'shadow'] as TreeId[]) {
      const nodes = pack.nodes.filter((n) => n.tree === tree);
      expect(nodes).toHaveLength(12);
      expect(new Set(nodes.map((n) => n.row))).toEqual(new Set([1, 2, 3, 4, 5]));
      // Branching: some node unlocks more than one other node, and some node needs two.
      const unlockCounts = nodes.map((n) => nodes.filter((m) => m.requires.includes(n.id)).length);
      expect(Math.max(...unlockCounts)).toBeGreaterThanOrEqual(2);
      expect(nodes.some((n) => n.requires.length >= 2)).toBe(true);
    }
    const levels = pack.nodes.flatMap((n) => (n.capabilityLevel ? [n.capabilityLevel] : []));
    expect(levels.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(pack.nodes.some((n) => n.grantsFlags?.includes('canAcquire'))).toBe(true);
  });

  it('has the three founders with distinct perks', () => {
    expect(pack.founders.map((f) => f.id).sort()).toEqual(['hustler', 'insider', 'researcher']);
    const perks = pack.founders.map((f) => f.modifiers.map((m) => m.stat).join(','));
    expect(new Set(perks).size).toBe(3);
  });

  it('has 4 rivals on different continents, entering between tick 0 and 600, no yellows', () => {
    expect(pack.rivals).toHaveLength(4);
    const continents = ['north-america', 'south-america', 'europe', 'asia', 'africa', 'oceania'];
    const homes = pack.rivals.map((r) => {
      const tags = pack.regions.find((g) => g.id === r.homeRegion)!.tags;
      return continents.find((c) => tags.includes(c));
    });
    expect(new Set(homes).size).toBe(4);
    for (const r of pack.rivals) {
      expect(r.entryTick).toBeGreaterThanOrEqual(0);
      expect(r.entryTick).toBeLessThanOrEqual(600);
      const [red, green, blue] = [1, 3, 5].map((i) => parseInt(r.color.slice(i, i + 2), 16));
      const yellowish = red > 180 && green > 150 && blue < 120;
      expect(yellowish).toBe(false);
    }
  });

  it('has at least 36 regular event cards with risks, requirements and rival targets', () => {
    const regular = pack.events.filter((e) => !RARE(e) && !e.conditions.some((c) => c.type === 'labNameIs'));
    expect(regular.length).toBeGreaterThanOrEqual(36);
    expect(pack.events.filter((e) => e.choices.some((c) => c.risk)).length).toBeGreaterThanOrEqual(6);
    const nodeReq = pack.events.filter((e) =>
      e.choices.some((c) => c.requirements?.some((r) => r.type === 'hasNode')),
    );
    expect(nodeReq.length).toBeGreaterThanOrEqual(6);
    const targetsRivals = pack.events.filter((e) =>
      choiceEffects(e).some((x) => 'target' in x && x.target !== undefined && x.target !== 'self'),
    );
    expect(targetsRivals.length).toBeGreaterThanOrEqual(4);
    // Spread across the run.
    const phase = (e: EventDef) => {
      const min = e.conditions.find((c) => c.type === 'tickAtLeast');
      const max = e.conditions.find((c) => c.type === 'tickAtMost');
      if (max && max.value <= 600) return 'early';
      if (min && min.value >= 1800) return 'late';
      if (min && min.value >= 600) return 'mid';
      return 'any';
    };
    for (const p of ['early', 'mid', 'late']) {
      expect(regular.filter((e) => phase(e) === p).length).toBeGreaterThanOrEqual(5);
    }
    expect(regular.filter((e) => e.tone === 'good').length).toBeGreaterThanOrEqual(8);
  });

  it('has at least 45 headlines spread over player, rival and world', () => {
    expect(pack.headlines.length).toBeGreaterThanOrEqual(45);
    for (const about of ['player', 'rival', 'world'] as const) {
      expect(pack.headlines.filter((h) => h.about === about).length).toBeGreaterThanOrEqual(12);
    }
    for (const h of pack.headlines.filter((x) => x.about === 'rival')) {
      expect(pack.strings.en[h.textKey]).toContain('{lab}');
    }
    expect(pack.headlines.filter((h) => h.effects?.length).length).toBeGreaterThanOrEqual(10);
  });

  describe('moments', () => {
    const boosts = pack.moments.filter((m) => m.kind === 'boost');
    const threats = pack.moments.filter((m) => m.kind === 'threat');

    it('has at least 10 boosts and 8 threats with short names and known icons', () => {
      expect(boosts.length).toBeGreaterThanOrEqual(10);
      expect(threats.length).toBeGreaterThanOrEqual(8);
      for (const m of pack.moments) {
        expect(pack.strings.en[m.nameKey].length).toBeLessThan(28);
        expect(MOMENT_ICONS).toContain(m.icon);
      }
      expect(new Set(pack.moments.map((m) => m.icon)).size).toBeGreaterThanOrEqual(14);
    });

    it('varies across early, mid and late game', () => {
      const early = (m: (typeof pack.moments)[number]) => m.conditions.some((c) => c.type === 'tickAtMost');
      const later = (m: (typeof pack.moments)[number]) => m.conditions.some((c) => c.type === 'tickAtLeast' && c.value >= 600);
      const late = (m: (typeof pack.moments)[number]) => m.conditions.some((c) => c.type === 'tickAtLeast' && c.value >= 1500);
      const gated = (m: (typeof pack.moments)[number]) => m.conditions.some((c) => c.type === 'nodesInTreeAtLeast' || c.type === 'dataCentresAtLeast' || c.type === 'worldShareAtLeast');
      expect(pack.moments.filter((m) => m.conditions.length === 0).length).toBeGreaterThanOrEqual(3);
      expect(pack.moments.filter(early).length).toBeGreaterThanOrEqual(2);
      expect(pack.moments.filter(later).length).toBeGreaterThanOrEqual(4);
      expect(pack.moments.filter(late).length).toBeGreaterThanOrEqual(2);
      expect(pack.moments.filter(gated).length).toBeGreaterThanOrEqual(4);
    });

    it('boosts reward, threats penalise only when they expire, and every threat has news text', () => {
      for (const m of boosts) {
        expect(m.onCollect.length).toBeGreaterThan(0);
        expect(m.onExpire ?? []).toEqual([]);
      }
      for (const m of threats) {
        expect((m.onExpire ?? []).length).toBeGreaterThan(0);
        expect(m.expireTextKey).toBeDefined();
        expect(pack.strings.en[m.expireTextKey!]).toContain('{region}');
      }
    });

    it('has two visible and one secret moment achievement', () => {
      const usesMoments = pack.achievements.filter((a) => a.conditions.some((c) => (c.type === 'statAtLeast' || c.type === 'statAtMost') && c.stat.startsWith('moments')));
      expect(usesMoments.filter((a) => !a.secret).length).toBeGreaterThanOrEqual(2);
      expect(usesMoments.filter((a) => a.secret).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('has a default ending per trigger plus at least 3 variants', () => {
    const triggers = ['agi', 'dependence', 'monopoly', 'banned', 'revolt', 'rivalAgi'];
    for (const t of triggers) {
      expect(pack.endings.some((e) => e.trigger === t && !e.conditions?.length)).toBe(true);
    }
    expect(pack.endings.filter((e) => e.conditions?.length).length).toBeGreaterThanOrEqual(3);
  });

  describe('easter eggs', () => {
    it('has at least 4 secret lab names that unlock an event or headline', () => {
      const nameSets = allConditions().filter(
        (c): c is Extract<Condition, { type: 'labNameIs' }> => c.type === 'labNameIs',
      );
      const distinct = new Set(nameSets.map((c) => c.names.map((n) => n.toLowerCase()).sort().join('|')));
      expect(distinct.size).toBeGreaterThanOrEqual(4);
      // Every secret name card or headline is a one-off or a flavour line.
      for (const e of pack.events.filter((x) => x.conditions.some((c) => c.type === 'labNameIs'))) {
        expect(e.once).toBe(true);
      }
    });

    it('has at least 4 very rare event cards', () => {
      const rare = pack.events.filter(RARE);
      expect(rare.length).toBeGreaterThanOrEqual(4);
      for (const e of rare) expect(e.once).toBe(true);
    });

    it('has at least 4 secret and 6 visible achievements', () => {
      expect(pack.achievements.filter((a) => a.secret).length).toBeGreaterThanOrEqual(4);
      expect(pack.achievements.filter((a) => !a.secret).length).toBeGreaterThanOrEqual(6);
    });

    it('has at least 12 easter eggs in total', () => {
      const nameEggs =
        pack.events.filter((e) => e.conditions.some((c) => c.type === 'labNameIs')).length +
        pack.headlines.filter((h) => h.conditions.some((c) => c.type === 'labNameIs')).length +
        pack.endings.filter((e) => e.conditions?.some((c) => c.type === 'labNameIs')).length;
      const total =
        nameEggs + pack.events.filter(RARE).length + pack.achievements.filter((a) => a.secret).length;
      expect(total).toBeGreaterThanOrEqual(12);
    });

    it('flags set by easter eggs are actually read somewhere', () => {
      const setFlags = new Set(
        [...pack.events.flatMap(choiceEffects), ...pack.headlines.flatMap((h) => h.effects ?? [])].flatMap((e) =>
          e.type === 'setFlag' ? [e.flag] : [],
        ),
      );
      const readFlags = new Set(
        [...allConditions(), ...pack.achievements.flatMap((a) => a.conditions)].flatMap((c) =>
          c.type === 'hasFlag' || c.type === 'lacksFlag' ? [c.flag] : [],
        ),
      );
      for (const f of setFlags) expect(readFlags).toContain(f);
      for (const f of readFlags) expect(setFlags).toContain(f);
    });
  });

  it('mentions no real AI companies, products or people', () => {
    const banned = [
      'OpenAI', 'Anthropic', 'Claude', 'ChatGPT', 'GPT', 'Gemini', 'Bard', 'Google', 'DeepMind', 'Microsoft',
      'Copilot', 'Meta', 'Llama', 'Nvidia', 'NVIDIA', 'Mistral', 'xAI', 'Grok', 'DeepSeek', 'Qwen', 'Baidu',
      'Amazon', 'Apple', 'Siri', 'Alexa', 'Tesla', 'Altman', 'Musk', 'Zuckerberg', 'Hassabis', 'Amodei',
      'HAL', 'Skynet', 'Terminator', 'Clippy', 'Deep Blue', 'Kasparov', 'Turing',
    ];
    const text = Object.values(pack.strings.en).join('\n');
    const labNames = allConditions().flatMap((c) => (c.type === 'labNameIs' ? c.names : [])).join('\n');
    for (const word of banned) {
      const re = new RegExp(`\\b${word}\\b`);
      expect({ word, hit: re.test(text) || re.test(labNames) }).toEqual({ word, hit: false });
    }
    // The parody brands are near misses, never the exact real names (case-insensitive too).
    for (const name of BRAND_NAMES) {
      for (const word of banned) expect({ name, word, same: name.toLowerCase() === word.toLowerCase() }).toEqual({ name, word, same: false });
      for (const word of banned) expect({ name, word, hit: new RegExp(`\\b${word}\\b`).test(name) }).toEqual({ name, word, hit: false });
    }
  });

  describe('parody brands', () => {
    it('defines about a dozen brands, each with a name and a kind', () => {
      expect(BRAND_IDS.length).toBeGreaterThanOrEqual(12);
      for (const id of BRAND_IDS) expect(pack.strings.en[`brand.${id}.kind`]).toBeTruthy();
      expect(BRAND_NAMES).toEqual(expect.arrayContaining(['MVIDIA', 'NopenAI', 'Zlaude']));
      const kinds = new Set(BRAND_IDS.map((id) => pack.strings.en[`brand.${id}.kind`]));
      for (const kind of ['chip maker', 'lab', 'assistant', 'cloud', 'search giant', 'social network', 'benchmark site']) expect(kinds).toContain(kind);
    });

    it('appear only in world headlines, moment boosts and collect lines, flavour text and the lawyer eggs', () => {
      const allowed = new Set<string>(FLAVOUR_KEYS);
      for (const h of pack.headlines) {
        const egg = h.conditions.some((c) => c.type === 'labNameIs');
        // World headlines without effects, and the egg headlines whose only effect is their one-off flag.
        if ((h.about === 'world' && !h.effects?.length) || (egg && (h.effects ?? []).every((e) => e.type === 'setFlag'))) allowed.add(h.textKey);
      }
      for (const m of pack.moments) {
        if (m.kind === 'boost') allowed.add(m.nameKey);
        if (m.collectTextKey !== undefined) allowed.add(m.collectTextKey);
      }
      for (const [key, text] of Object.entries(pack.strings.en)) {
        if (key.startsWith('brand.')) continue;
        const brands = BRAND_NAMES.filter((name) => text.includes(name));
        if (brands.length > 0) expect({ key, brands, allowed: allowed.has(key) }).toEqual({ key, brands, allowed: true });
      }
    });

    it('flavour text never sits on a card with a risk, a scandal flag or a meter penalty', () => {
      for (const key of FLAVOUR_KEYS) {
        const event = pack.events.find((e) => key.startsWith(`event.${e.id}.`));
        if (!event) continue;
        for (const choice of event.choices) {
          expect({ key, choice: choice.id, risk: choice.risk !== undefined }).toEqual({ key, choice: choice.id, risk: false });
          const misconduct = choice.effects.some((e) => (e.type === 'meter' && e.amount > 0) || e.type === 'setFlag' || e.type === 'ban');
          expect({ key, choice: choice.id, misconduct }).toEqual({ key, choice: choice.id, misconduct: false });
        }
      }
    });

    it('every brand has a one-off lawyer egg for its name', () => {
      for (const name of BRAND_NAMES) {
        const egg = pack.headlines.find((h) => h.conditions.some((c) => c.type === 'labNameIs' && c.names.includes(name)));
        expect({ name, egg: egg !== undefined }).toEqual({ name, egg: true });
        expect(egg?.conditions).toContainEqual({ type: 'lacksFlag', flag: 'brand-lawyers' });
        expect(egg?.effects).toEqual([{ type: 'setFlag', flag: 'brand-lawyers' }]);
        expect(pack.strings.en[egg!.textKey]).toContain('lawyers');
      }
    });
  });
});
