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

  it('catches unknown or invalid balance overrides', () => {
    expectProblem(problemsOf((p) => { (p.balance as Record<string, number>).warpSpeed = 3; }), /balance: unknown key "warpSpeed"/);
    expectProblem(problemsOf((p) => { (p.balance as Record<string, number>).banThresholds = 3; }), /"banThresholds" is not a number setting/);
    expectProblem(problemsOf((p) => { p.balance.baseSpread = -1; }), /"baseSpread" must be a finite number >= 0/);
  });

  it('validates difficulties: ids, strings, balance keys, multipliers, default', () => {
    const d = (p: ContentPack) => p.difficulties!;
    expect(d(clone()).length).toBe(4);
    expectProblem(problemsOf((p) => { d(p)[1].id = d(p)[0].id; }), /difficulties: duplicate id "sandbox"/);
    expectProblem(problemsOf((p) => { d(p)[0].nameKey = 'difficulty.nope.name'; }), /missing key "difficulty.nope.name"/);
    expectProblem(problemsOf((p) => { (d(p)[0].balance as Record<string, number>).warpSpeed = 2; }), /difficulties\[sandbox\]\.balance: unknown key "warpSpeed"/);
    expectProblem(problemsOf((p) => { (d(p)[0].balance as Record<string, number>).banThresholds = 2; }), /not a number setting/);
    expectProblem(problemsOf((p) => { d(p)[0].balance.aiAgiFactor = -1; }), /must be a finite number >= 0/);
    expectProblem(problemsOf((p) => { d(p)[0].balance.computePerCapabilityLevel = 5; }), /can only be set in the pack's balance/);
    expectProblem(problemsOf((p) => { d(p)[0].scoreMultiplier = 0; }), /scoreMultiplier/);
    expectProblem(problemsOf((p) => { d(p)[0].scoreMultiplier = -1; }), /scoreMultiplier/);
    expectProblem(problemsOf((p) => { p.defaultDifficulty = 'nightmare'; }), /defaultDifficulty: "nightmare" is not one of/);
    expectProblem(problemsOf((p) => { delete p.defaultDifficulty; }), /defaultDifficulty: required/);
    expectProblem(problemsOf((p) => { p.strings.en['difficulty.sandbox.desc'] = 'x'.repeat(61); }), /difficulty description/);
    // Difficulties are optional (their strings are then unused).
    expect(problemsOf((p) => { delete p.difficulties; delete p.defaultDifficulty; }).filter((x) => !/unused key "difficulty\./.test(x))).toEqual([]);
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
    // Locales after the first may lack keys (the UI falls back to the first), but not add
    // keys or change a key's placeholders.
    expect(problemsOf((p) => { p.strings.fr = { ...p.strings.en }; delete p.strings.fr['region.usa.name']; }).some((x) => /strings\.fr: missing key/.test(x))).toBe(false);
    expectProblem(problemsOf((p) => { p.strings.fr = { 'orphan.key': 'Bonjour' }; }), /strings\.fr: "orphan\.key" is not in en/);
    expectProblem(problemsOf((p) => { p.strings.fr = { [p.headlines[0].textKey]: 'Rien {tier}' }; }), /strings\.fr: .* placeholders not in en: \{tier\}/);
  });

  it('checks moments: icons, kinds, effects, conditions, strings and name length', () => {
    const moment = (p: ContentPack, id: string) => p.moments.find((m) => m.id === id)!;
    expectProblem(problemsOf((p) => { moment(p, 'viral-post').icon = 'rocket'; }), /unknown icon "rocket"/);
    expectProblem(problemsOf((p) => { moment(p, 'viral-post').onCollect = []; }), /boost needs at least one onCollect/);
    expectProblem(problemsOf((p) => { moment(p, 'leaked-memo').onExpire = []; }), /threat needs at least one onExpire/);
    expectProblem(problemsOf((p) => { delete moment(p, 'leaked-memo').expireTextKey; }), /threat needs an expireTextKey/);
    expectProblem(problemsOf((p) => { moment(p, 'viral-post').expireTextKey = 'moment.leaked-memo.expire'; }), /boosts add no news/);
    expectProblem(problemsOf((p) => { moment(p, 'viral-post').onCollect.push({ type: 'news', textKey: 'moment.viral-post.collect' }); }), /must not add news/);
    expectProblem(problemsOf((p) => { moment(p, 'viral-post').conditions.push({ type: 'hasNode', nodeId: 'ghost' }); }), /moments\[viral-post\]: unknown node "ghost"/);
    expectProblem(problemsOf((p) => { moment(p, 'viral-post').lifetimeTicks = 0; }), /lifetimeTicks/);
    expectProblem(problemsOf((p) => { p.moments.push({ ...moment(p, 'viral-post') }); }), /moments: duplicate id "viral-post"/);
    expectProblem(problemsOf((p) => { p.strings.en['moment.viral-post.name'] = 'A name that is far too long'.padEnd(30, '!'); }), /moment name "moment.viral-post.name" is 30 chars \(max 27\)/);
    expectProblem(problemsOf((p) => { delete p.strings.en['moment.leaked-memo.expire']; }), /missing key "moment.leaked-memo.expire"/);
  });

  it('allows atMoment and scaleWithIncome only where they make sense', () => {
    expectProblem(
      problemsOf((p) => { p.events[0].choices[0].effects.push({ type: 'adoption', scope: { kind: 'home' }, factor: 1.1, atMoment: true }); }),
      /atMoment only works in a moment's effects/,
    );
    expectProblem(problemsOf((p) => { p.moments[0].onCollect = [{ type: 'resource', resource: 'hype', amount: 1, scaleWithIncome: -1 }]; }), /scaleWithIncome/);
    expect(problemsOf((p) => { p.events[0].choices[0].effects.push({ type: 'resource', resource: 'hype', amount: 1, scaleWithIncome: 5 }); })).toEqual([]);
  });

  it('requires the launch news, the rival terms and allows {model} and {tier}', () => {
    expectProblem(problemsOf((p) => { delete p.strings.en['engine.news.launch.player']; }), /missing key "engine.news.launch.player"/);
    expectProblem(problemsOf((p) => { delete p.strings.en['engine.news.launch.rival']; }), /missing key "engine.news.launch.rival"/);
    expectProblem(problemsOf((p) => { delete p.strings.en['term.rivals']; }), /missing key "term.rivals"/);
    expectProblem(problemsOf((p) => { delete p.strings.en['term.rival']; }), /missing key "term.rival"/);
    expect(problemsOf((p) => { p.strings.en['engine.news.launch.rival'] = '{lab} ships {model}, tier {tier}.'; })).toEqual([]);
  });

  it('checks brand keys come in name and kind pairs', () => {
    expectProblem(problemsOf((p) => { delete p.strings.en['brand.mvidia.kind']; }), /"brand.mvidia.name" has no matching brand.mvidia.kind/);
    expectProblem(problemsOf((p) => { p.strings.en['brand.x.slogan'] = 'Hi'; }), /brand keys are brand.<id>.name or brand.<id>.kind/);
  });

  it('checks barriers, link barriers, channels and channel flags', () => {
    const usa = (p: ContentPack) => p.regions.find((r) => r.id === 'usa')!;
    expectProblem(problemsOf((p) => { usa(p).barriers = ['moat']; }), /regions\[usa\]: unknown barrier "moat"/);
    expectProblem(problemsOf((p) => { usa(p).linkBarriers = { canada: ['ocean'] }; }), /link barriers to "canada" are not listed the same way back/);
    expectProblem(problemsOf((p) => { usa(p).linkBarriers = { japan: ['ocean'] }; }), /not a neighbour/);
    expectProblem(problemsOf((p) => { p.nodes[0].channels = ['teleport']; }), /unknown channel "teleport"/);
    expectProblem(problemsOf((p) => { p.channels![0].kind = 'jump'; p.channels![0].clears = ['ocean']; }), /only 'clear' channels have clears/);
    expectProblem(problemsOf((p) => { p.channels!.find((c) => c.kind === 'clear')!.clears = ['moat']; }), /clears unknown barrier "moat"/);
    expectProblem(
      problemsOf((p) => { p.events[0].choices[0].effects.push({ type: 'setFlag', flag: 'channel:teleport', durationTicks: 10 }); }),
      /names an unknown channel/,
    );
    expectProblem(problemsOf((p) => { p.barriers![0].id = 'Ocean Wide'; }), /barriers/);
  });

  it('requires a gain and a loss phrase for every stat and allows {pct}', () => {
    expectProblem(problemsOf((p) => { delete p.strings.en['stat.spreadRate.gain']; }), /missing key "stat\.spreadRate\.gain"/);
    expectProblem(problemsOf((p) => { delete p.strings.en['stat.banDuration.loss']; }), /missing key "stat\.banDuration\.loss"/);
    expect(problemsOf((p) => { p.strings.en['stat.spreadRate.gain'] = 'Spreads {pct} faster'; })).toEqual([]);
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
