import type { FounderDef, RegionDef } from '@/engine';

import { getPackEntry } from '../../packs';
import {
  defaultHomeRegion,
  founderPerkLines,
  MAX_LAB_NAME,
  missingText,
  modifierLine,
  randomLabName,
  regionRead,
  regionReadParts,
  searchRegions,
  validateLabName,
} from '../logic';

const { pack, labNames } = getPackEntry();

describe('validateLabName', () => {
  it('trims and collapses whitespace', () => {
    expect(validateLabName('  Moon   Lab ')).toEqual({ ok: true, name: 'Moon Lab' });
  });
  it('requires a name', () => {
    expect(validateLabName('')).toEqual({ ok: false, problem: 'empty' });
    expect(validateLabName('    ')).toEqual({ ok: false, problem: 'empty' });
  });
  it('caps the length after trimming', () => {
    expect(validateLabName(` ${'x'.repeat(MAX_LAB_NAME)} `).ok).toBe(true);
    expect(validateLabName('x'.repeat(MAX_LAB_NAME + 1))).toEqual({ ok: false, problem: 'tooLong' });
  });
});

describe('missingText', () => {
  const full = { name: 'Moon Lab', founderId: 'researcher', homeRegion: 'canada' };
  it('is null when everything is chosen', () => {
    expect(missingText(full)).toBeNull();
  });
  it('names the first missing thing', () => {
    expect(missingText({ ...full, name: ' ' })).toBe('Name your lab first');
    expect(missingText({ ...full, name: 'y'.repeat(40) })).toContain(String(MAX_LAB_NAME));
    expect(missingText({ ...full, founderId: null })).toBe('Pick a founder');
    expect(missingText({ ...full, homeRegion: null })).toBe('Pick a home region');
  });
});

describe('lab names', () => {
  it('has about 40 unique names that all pass validation', () => {
    expect(labNames.length).toBeGreaterThanOrEqual(36);
    expect(new Set(labNames).size).toBe(labNames.length);
    for (const n of labNames) expect({ n, ok: validateLabName(n).ok && n === n.trim() }).toEqual({ n, ok: true });
  });
  it('never gives away an easter-egg name or names a real company', () => {
    const eggs = new Set(
      [...pack.events.flatMap((e) => e.conditions), ...pack.headlines.flatMap((h) => h.conditions), ...pack.endings.flatMap((e) => e.conditions ?? [])]
        .flatMap((c) => (c.type === 'labNameIs' ? c.names : []))
        .map((n) => n.toLowerCase()),
    );
    const banned = /\b(OpenAI|Anthropic|Claude|GPT|Gemini|Google|DeepMind|Microsoft|Meta|Nvidia|Mistral|xAI|Grok|DeepSeek|Amazon|Apple|Tesla|Skynet|HAL)\b/i;
    for (const n of labNames) {
      expect(eggs.has(n.toLowerCase())).toBe(false);
      expect(banned.test(n)).toBe(false);
    }
  });
  it('randomLabName picks from the list and avoids the current name', () => {
    expect(randomLabName(['A', 'B'], 'A', () => 0)).toBe('B');
    expect(randomLabName(['A', 'B', 'C'], '', () => 0.99)).toBe('C');
    expect(randomLabName(['Only'], 'Only', () => 0.5)).toBe('Only');
    expect(randomLabName([], 'Keep', () => 0.5)).toBe('Keep');
  });
});

function region(wealth: number, openness: number, strictness: number, powerCost: number): Pick<RegionDef, 'wealth' | 'openness' | 'strictness' | 'powerCost'> {
  return { wealth, openness, strictness, powerCost };
}

describe('regionRead', () => {
  it('reads rich, open, strict as a contrast', () => {
    expect(regionReadParts(region(0.9, 0.8, 0.7, 0.5))).toEqual({ lead: 'rich-open', tail: 'strict', joiner: 'but' });
    expect(regionRead(region(0.9, 0.8, 0.7, 0.5))).toBe('Rich and open, but regulators are strict.');
  });
  it('joins agreeing traits with "and"', () => {
    expect(regionRead(region(0.9, 0.8, 0.2, 0.5))).toBe('Rich and open, and regulators are relaxed.');
    expect(regionRead(region(0.2, 0.3, 0.7, 0.5))).toBe('Not rich and wary of new tech, and regulators are strict.');
  });
  it('falls back to power cost when strictness is middling', () => {
    expect(regionRead(region(0.2, 0.8, 0.45, 0.2))).toBe('Not rich, but keen, and power is cheap.');
    expect(regionRead(region(0.5, 0.5, 0.45, 0.8))).toBe('Middle of the road, but power is expensive.');
  });
  it('stops after the lead when nothing else stands out', () => {
    expect(regionRead(region(0.95, 0.85, 0.35, 0.45))).toBe('Rich and open.');
  });
  it('has a string for every region in the pack', () => {
    for (const r of pack.regions) expect(regionRead(r)).toMatch(/^[A-Z].+\.$/);
  });
});

describe('founder perks', () => {
  it('lists starting Hype, Cash and each modifier', () => {
    const founder: FounderDef = {
      id: 'x',
      nameKey: 'x',
      descKey: 'x',
      startHype: 22,
      startCash: 1200,
      modifiers: [
        { stat: 'agiRate', op: 'mul', value: 1.2 },
        { stat: 'regulationGain', op: 'mul', value: 0.75 },
      ],
    };
    expect(founderPerkLines(founder)).toEqual([
      { text: 'Starts with 22 Hype', tone: 'neutral' },
      { text: 'Starts with $1.2B Cash', tone: 'neutral' },
      { text: '+20% AGI progress', tone: 'good' },
      { text: '−25% Regulation build-up', tone: 'good' },
    ]);
  });
  it('marks harmful modifiers and handles add and region tags', () => {
    expect(modifierLine({ stat: 'dataCentreCost', op: 'mul', value: 1.1 })).toEqual({ text: '+10% data centre cost', tone: 'bad' });
    expect(modifierLine({ stat: 'computeCapacity', op: 'add', value: 5, regionTag: 'eu' })).toEqual({ text: '+5 compute (eu regions)', tone: 'good' });
  });
  it('describes every founder in the pack with good perks', () => {
    for (const f of pack.founders) {
      const lines = founderPerkLines(f);
      expect(lines).toHaveLength(2 + f.modifiers.length);
      for (const line of lines.slice(2)) expect(line.tone).toBe('good');
    }
  });
});

describe('region helpers', () => {
  it('searches by name, ignoring case and accents, sorted', () => {
    const all = searchRegions(pack.regions, '');
    expect(all).toHaveLength(pack.regions.length);
    const first = all[0];
    const hits = searchRegions(pack.regions, 'CAN');
    expect(hits.map((r) => r.id)).toContain('canada');
    expect(searchRegions(pack.regions, 'zzzz')).toEqual([]);
    expect(first).toBeDefined();
  });
  it('autostart home is not a rival home', () => {
    const home = defaultHomeRegion(pack);
    expect(pack.rivals.some((r) => r.homeRegion === home)).toBe(false);
  });
});

describe('isWide', () => {
  it('is wide only in landscape windows at least 600 wide', () => {
    const { isWide } = jest.requireActual<typeof import('../useWide')>('../useWide');
    expect(isWide(844, 390)).toBe(true);
    expect(isWide(390, 844)).toBe(false);
    expect(isWide(590, 400)).toBe(false);
    expect(isWide(600, 600)).toBe(false);
  });
});
