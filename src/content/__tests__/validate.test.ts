import type { ContentPack } from '@/engine/types';

import { aiLabPack, validatePack } from '..';

/** A deep copy of the real pack that a test can break. */
const clone = (): ContentPack => JSON.parse(JSON.stringify(aiLabPack)) as ContentPack;
const problemsOf = (mutate: (p: ContentPack) => void): string[] => {
  const p = clone();
  mutate(p);
  return validatePack(p);
};
const expectProblem = (problems: string[], pattern: RegExp) => {
  expect(problems.some((x) => pattern.test(x))).toBe(true);
};

describe('validatePack', () => {
  it('accepts an untouched copy of the pack', () => {
    expect(validatePack(clone())).toEqual([]);
  });

  it('rejects things that are not packs', () => {
    expect(validatePack(null).length).toBeGreaterThan(0);
    expect(validatePack({}).length).toBeGreaterThan(0);
  });

  it('catches schema problems: choice count, ranges, unknown fields', () => {
    expectProblem(problemsOf((p) => { p.events[0].choices = p.events[0].choices.slice(0, 1); }), /2 or 3 choices/);
    expectProblem(problemsOf((p) => { p.regions[0].wealth = 1.5; }), /regions\[usa\]\.wealth/);
    expectProblem(problemsOf((p) => { p.nodes[0].row = 6; }), /nodes\[cap-model-1\]\.row/);
    expectProblem(problemsOf((p) => { p.rivals[0].color = 'blue'; }), /colour/);
    expectProblem(problemsOf((p) => { (p.nodes[0] as unknown as Record<string, unknown>).price = 3; }), /price/);
  });

  it('catches duplicate ids', () => {
    expectProblem(problemsOf((p) => { p.nodes[1].id = p.nodes[0].id; }), /duplicate id "cap-model-1"/);
  });

  it('catches dangling references', () => {
    expectProblem(problemsOf((p) => { p.nodes[1].requires = ['no-such-node']; }), /unknown node "no-such-node"/);
    expectProblem(problemsOf((p) => { p.rivals[0].homeRegion = 'atlantis'; }), /unknown home region "atlantis"/);
    expectProblem(
      problemsOf((p) => { p.achievements[0].conditions = [{ type: 'founderIs', founderId: 'wizard' }]; }),
      /unknown founder "wizard"/,
    );
    expectProblem(
      problemsOf((p) => { p.achievements[0].conditions = [{ type: 'endingIs', endingId: 'nope' }]; }),
      /unknown ending "nope"/,
    );
  });

  it('catches requires cycles', () => {
    const problems = problemsOf((p) => {
      const a = p.nodes.find((n) => n.id === 'cap-model-2')!;
      const b = p.nodes.find((n) => n.id === 'cap-model-3')!;
      a.row = 3;
      a.requires = ['cap-model-3'];
      b.requires = ['cap-model-2'];
    });
    expectProblem(problems, /requires cycle/);
  });

  it('catches asymmetric neighbours and a disconnected map', () => {
    expectProblem(
      problemsOf((p) => { p.regions.find((r) => r.id === 'canada')!.neighbors.push('japan'); }),
      /neighbour "japan" does not list it back/,
    );
    const problems = problemsOf((p) => {
      for (const r of p.regions) r.neighbors = r.neighbors.filter((n) => n !== 'canada');
      p.regions.find((r) => r.id === 'canada')!.neighbors = ['usa'];
      p.regions.find((r) => r.id === 'usa')!.neighbors = ['canada'];
    });
    expectProblem(problems, /not connected/);
  });

  it('catches a country in two regions', () => {
    expectProblem(problemsOf((p) => { p.regions[1].countries.push('840'); }), /country 840 already belongs to "usa"/);
  });

  it('catches missing, unused and overlong strings and bad placeholders', () => {
    expectProblem(problemsOf((p) => { delete p.strings.en['node.cap-model-1.name']; }), /missing key "node.cap-model-1.name"/);
    expectProblem(problemsOf((p) => { p.strings.en['orphan.key'] = 'Hello'; }), /unused key "orphan.key"/);
    expectProblem(
      problemsOf((p) => { p.strings.en[p.headlines[0].textKey] = 'x'.repeat(120); }),
      /headline .* is 120 chars/,
    );
    expectProblem(problemsOf((p) => { p.strings.en[p.headlines[0].textKey] = 'Hi {player}'; }), /\{player\}/);
    expectProblem(
      problemsOf((p) => { p.strings.fr = { ...p.strings.en }; delete p.strings.fr['region.usa.name']; }),
      /strings\.fr: missing key "region\.usa\.name"/,
    );
  });

  it('catches a trigger without a default ending, and a default before its variants', () => {
    expectProblem(problemsOf((p) => { p.endings = p.endings.filter((e) => e.id !== 'revolt'); }), /"revolt" has no default/);
    expectProblem(
      problemsOf((p) => {
        const i = p.endings.findIndex((e) => e.id === 'agi');
        const [def] = p.endings.splice(i, 1);
        p.endings.unshift(def);
      }),
      /default for "agi" must come after/,
    );
  });
});
