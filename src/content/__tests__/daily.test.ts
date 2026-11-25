import { aiLabDaily, aiLabPack, validateDaily, validatePack } from '..';

describe('ai-lab daily content', () => {
  it('is valid (twists, references, every template family in every locale)', () => {
    expect(validateDaily(aiLabDaily, aiLabPack)).toEqual([]);
  });

  it('keeps the pack valid with its daily strings', () => {
    expect(validatePack(aiLabPack)).toEqual([]);
  });

  it('reports problems', () => {
    const bad = { ...aiLabDaily, runLength: 'nope', homeRegions: ['atlantis'], twists: [...aiLabDaily.twists, aiLabDaily.twists[0]] };
    const problems = validateDaily(bad, aiLabPack);
    expect(problems.some((p) => p.includes('nope'))).toBe(true);
    expect(problems.some((p) => p.includes('atlantis'))).toBe(true);
    expect(problems.some((p) => p.includes('duplicate'))).toBe(true);
    const tr = { ...aiLabPack.strings.tr, 'front.story.home.1.body': "{region}'da {lab}" };
    const glued = validateDaily(aiLabDaily, { ...aiLabPack, strings: { ...aiLabPack.strings, tr } });
    expect(glued.some((p) => p.includes('suffix'))).toBe(true);
    const en = { ...aiLabPack.strings.en, 'front.headline.agi.1': '{lab} {model}' };
    const wrong = validateDaily(aiLabDaily, { ...aiLabPack, strings: { ...aiLabPack.strings, en } });
    expect(wrong.some((p) => p.includes('{model}'))).toBe(true);
  });

  it('builds twists only from GameSetup levers', () => {
    for (const tw of aiLabDaily.twists) expect(Object.keys(tw).every((k) => ['id', 'nameKey', 'descKey', 'bonus', 'rivals'].includes(k))).toBe(true);
  });
});
