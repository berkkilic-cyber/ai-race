import { advance, collectHappening, createGarage, keepModel, launchTraining, moveStaff, scrapCandidates, type GarageState } from '@/idle';

import { garageContent } from '../../garage/content';
import { garageMoments } from '../../garage/moments';
import { useGarageStore } from '../../garage/store';
import { CUES } from '../cues';
import { getSoundLog, resetSoundEngineForTests } from '../engine';
import { createGarageMemo, deriveGarageCues, deriveShipDayCues, HELPER_SOUND_GAP_MS } from '../garageSounds';
import { resetHapticsForTests } from '../haptics';
import { installFeel, uninstallFeelForTests } from '../install';
import { resetFeelSettingsForTests } from '../settings';
import { SOUND_FILES } from '../sounds';

const content = garageContent();
const stageIndex = (id: string) => content.stages!.findIndex((s) => s.id === id);
const T0 = 1_700_000_000_000;
const quiet = (s: GarageState): GarageState => ({ ...s, nextGoldenAt: s.now + 3_600_000, nextIncidentAt: s.now + 3_600_000, nextHappeningAt: s.now + 3_600_000 });
const cues = (a: GarageState, b: GarageState) => deriveGarageCues(a, b, content).map((c) => c.cue);

/** A lab at the given stage with some of everything, events far away. */
function lab(stage: string, extra: Partial<GarageState> = {}): GarageState {
  const base = createGarage(content, T0, 5);
  return {
    ...quiet(base),
    stage: stageIndex(stage),
    generation: stage === 'latent' ? 8 : stage === 'town' ? 5 : 2,
    tokens: 1e12,
    genLifetime: 1e12,
    generators: { intern: 24, gpu: 49, closet: 30, scraper: 10, hall: 5 },
    stats: { ...base.stats, tokensAllTime: 1e13 },
    training: { charges: 1, nextChargeAt: T0 + 60_000, candidates: null },
    achievements: content.achievements.map((x) => x.id),
    ...extra,
  };
}

describe('Garage moments to cues', () => {
  it('every cue has a sound file', () => {
    for (const spec of Object.values(CUES)) expect(SOUND_FILES[spec.sound]).toBeDefined();
  });

  it('stage, training, picks and staff each sound once; the clock alone is silent', () => {
    const a = lab('datacentre');
    expect(cues(a, { ...a, now: a.now + 250, tokens: a.tokens + 9 })).toEqual([]);
    expect(cues(a, { ...a, stage: a.stage + 1 })).toEqual(['garageStage']);
    expect(cues(a, { ...a, training: { ...a.training, charges: 2 } })).toEqual(['trainingReady']);
    const launched = launchTraining(a, content, a.now).state;
    expect(cues(a, launched)).toEqual(['trainingReveal']);
    const cand = launched.training.candidates!;
    const kept = keepModel(launched, content, cand[0].uid, launched.now).state;
    expect(cues(launched, kept)).toEqual(['modelKeep']);
    expect(garageMoments(launched, kept, content).pick).toMatchObject({ action: 'keep', rarity: cand[0].rarity });
    expect(cues(launched, scrapCandidates(launched, content, launched.now).state)).toEqual(['modelScrap']);
    expect(garageMoments(launched, scrapCandidates(launched, content, launched.now).state, content).pick?.action).toBe('scrap');
    expect(cues(a, moveStaff(a, content, 'research', 'product', a.now).state)).toEqual(['staffMove']);
  });

  it('happenings: appear softly, tapped good or averted, missed softly, helpers nearly silent', () => {
    const a = lab('datacentre');
    const spawn = (id: string, s: GarageState = a): GarageState => ({ ...s, happening: { uid: 900, id, spawnedAt: s.now, expiresAt: s.now + 9000, x: 0.5, y: 0.5 }, uidSeq: 901 });
    expect(cues(a, spawn('pizza'))).toEqual(['happeningShow']);
    expect(cues(spawn('pizza'), collectHappening(spawn('pizza'), content, a.now + 100).state)).toEqual(['happeningGood']);
    expect(cues(spawn('bug'), collectHappening(spawn('bug'), content, a.now + 100).state)).toEqual(['happeningAverted']);
    const missed = advance(spawn('bug'), content, a.now + 9500);
    expect(garageMoments(spawn('bug'), missed, content).happening).toMatchObject({ outcome: 'missed', id: 'bug' });
    expect(cues(spawn('bug'), missed)).toEqual(['happeningMiss']);
    const town = lab('town');
    const auto = advance(spawn('pizza', town), content, town.now + 9500);
    expect(garageMoments(spawn('pizza', town), auto, content).happening).toMatchObject({ outcome: 'auto' });
    const memo = createGarageMemo();
    expect(deriveGarageCues(spawn('pizza', town), auto, content, memo).map((c) => c.cue)).toEqual(['garageHelper']);
    // Inside the gap the next helper action is silent.
    const again = { ...auto, now: auto.now + 1000, stats: { ...auto.stats, autoBought: auto.stats.autoBought + 1, generatorsBought: auto.stats.generatorsBought + 1 } };
    expect(deriveGarageCues(auto, again, content, memo)).toEqual([]);
  });

  it('milestones sound on a player buy across 25/50/100, never for the auto-buy; auto-buys are not player buys', () => {
    const a = lab('latent');
    const buyTo = (s: GarageState, id: string, n: number, auto = false) => {
      const d = n - (s.generators[id] ?? 0);
      return { ...s, generators: { ...s.generators, [id]: n }, stats: { ...s.stats, generatorsBought: s.stats.generatorsBought + d, autoBought: s.stats.autoBought + (auto ? d : 0) } };
    };
    expect(cues(a, buyTo(a, 'intern', 25))).toEqual(['garageMilestone', 'garageBuy']);
    expect(garageMoments(a, buyTo(a, 'gpu', 120), content).milestones).toEqual([{ tier: 2, count: 100 }]);
    expect(cues(a, buyTo(a, 'closet', 31))).toEqual(['garageBuy']);
    const memo = createGarageMemo();
    expect(deriveGarageCues(a, buyTo(a, 'intern', 25, true), content, memo).map((c) => c.cue)).toEqual(['garageHelper']);
  });

  it('bonus multiplier claimed and ship day steps', () => {
    const a = lab('office');
    expect(cues(a, { ...a, offers: { ...a.offers, bonusMultiply: [a.now] } })).toEqual(['garageMultiply']);
    expect(deriveShipDayCues(null, { step: 'reveal' }).map((c) => c.cue)).toEqual(['shipReveal']);
    expect(deriveShipDayCues({ step: 'reveal' }, { step: 'press' }).map((c) => c.cue)).toEqual(['shipPress']);
    expect(deriveShipDayCues({ step: 'press' }, { step: 'choose' })).toEqual([]);
    expect(deriveShipDayCues({ step: 'choose' }, null)).toEqual([]);
  });
});

describe('Garage through the store', () => {
  let now = T0;
  beforeAll(() => installFeel());
  afterAll(() => {
    uninstallFeelForTests();
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    now = T0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    resetFeelSettingsForTests();
    resetHapticsForTests(() => now);
  });
  const names = () => getSoundLog().map((e) => e.name);

  it('1,000 quiet ticks in a plain Garage make no sound', () => {
    useGarageStore.getState().replace(createGarage(content, now, 3));
    const s = useGarageStore.getState().state!;
    // No events at all: what remains is production.
    useGarageStore.getState().replace({ ...s, nextGoldenAt: Infinity, nextIncidentAt: Infinity, nextHappeningAt: Infinity, nextHeadlineAt: Infinity, generators: { intern: 10 } });
    resetSoundEngineForTests({ backend: null, clock: () => now });
    for (let i = 0; i < 1000; i++) {
      now += 250;
      useGarageStore.getState().tick();
    }
    expect(useGarageStore.getState().state!.now).toBe(now);
    expect(names()).toEqual([]);
  });

  it('1,000 ticks in Latent Space with automation on stay nearly silent', () => {
    const start = lab('latent', {
      now,
      createdAt: now,
      autoBuy: true,
      tokens: 1e24,
      genLifetime: 1e24,
      nextAutoBuyAt: now + 4000,
      nextHappeningAt: now + 1000,
      nextGoldenAt: now + 3_600_000,
      nextIncidentAt: now + 3_600_000,
      training: { charges: 3, nextChargeAt: 0, candidates: null },
      generators: { intern: 260, gpu: 230, closet: 210, scraper: 190, hall: 170, chips: 150, power: 120, robotics: 90, orbital: 50, universe: 4 },
    });
    useGarageStore.getState().replace(start);
    resetSoundEngineForTests({ backend: null, clock: () => now });
    for (let i = 0; i < 1000; i++) {
      now += 250;
      useGarageStore.getState().tick();
    }
    const end = useGarageStore.getState().state!;
    // The helpers really worked: auto-buys and auto-collected happenings.
    expect(end.stats.autoBought).toBeGreaterThan(10);
    expect(end.stats.happeningsCaught).toBeGreaterThan(2);
    const sounds = names();
    expect(sounds.every((n) => n === 'helper-tick' || n === 'happening-pop')).toBe(true);
    expect(sounds.filter((n) => n === 'helper-tick').length).toBeLessThanOrEqual(Math.ceil((1000 * 250) / HELPER_SOUND_GAP_MS) + 1);
    expect(sounds.length).toBeLessThan(1000 / 25);
  });
});
