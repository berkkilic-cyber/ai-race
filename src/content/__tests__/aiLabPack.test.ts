import type { Condition, Effect, EventDef, TreeId } from '@/engine/types';

import { aiLabPack, validatePack } from '..';

const pack = aiLabPack;
const RARE = (e: EventDef) => e.weight >= 0.01 && e.weight <= 0.05;
const allConditions = (): Condition[] => [
  ...pack.events.flatMap((e) => e.conditions),
  ...pack.headlines.flatMap((h) => h.conditions),
  ...pack.endings.flatMap((e) => e.conditions ?? []),
];
const choiceEffects = (e: EventDef): Effect[] =>
  e.choices.flatMap((c) => [...c.effects, ...(c.risk?.effects ?? [])]);

describe('ai-lab content pack', () => {
  it('passes validation', () => {
    expect(validatePack(pack)).toEqual([]);
  });

  it('has the right identity', () => {
    expect(pack.id).toBe('ai-lab');
    expect(pack.version).toBe(1);
    expect(pack.balance).toEqual({});
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
        [...pack.events.flatMap(choiceEffects)].flatMap((e) => (e.type === 'setFlag' ? [e.flag] : [])),
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
  });
});
