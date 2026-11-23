import { createGame, getScoreMultiplier, runHeadless, type GameState } from '@/engine';
import { deserialize, labRepTotal, type GarageContent, type LabPerkDef } from '@/idle';

import { garageContent } from '../../garage/content';
import { SAVE_KEY as GARAGE_SAVE_KEY, useGarageStore } from '../../garage/store';
import { getPackEntry } from '../../packs';
import { useGameStore } from '../../store/game';
import { makeRunSave, parseRunSave, restartSetup, restoreRun } from '../../store/runSave';
import { readValue, setStorageBackend } from '../../tutorial/storage';
import { bonusForSetup, cosmeticsAt, labRepLevel, perkTotals, raceRewardInputOf, racePerks, startBonusOf, withSetupBonus } from '../logic';
import { useMetaStore, withPerks } from '../store';

const { pack } = getPackEntry();
const content: GarageContent = garageContent();
const SETUP = { playerName: 'Meta Lab', founderId: 'researcher', homeRegion: 'canada', seed: 5, runLength: 'sprint' };

const perk = (kind: LabPerkDef['effect']['kind'], amount: number): LabPerkDef => ({ id: `${kind}-${amount}`, rep: 1, textKey: 'x', effect: { kind, amount } });

describe('Lab Rep perks -> race start bonus', () => {
  it('maps start resources to the start bonus and income perks to additive modifiers', () => {
    expect(startBonusOf([perk('startCash', 10), perk('startCash', 5), perk('startHype', 4), perk('hypeIncome', 0.03), perk('cashIncome', 0.02)])).toEqual({
      startCash: 15,
      startHype: 4,
      modifiers: [
        { stat: 'hypeIncome', op: 'add', value: 0.03 },
        { stat: 'cashIncome', op: 'add', value: 0.02 },
      ],
    });
  });

  it('momentRate (no engine equivalent) and cosmetic perks add nothing', () => {
    expect(startBonusOf([perk('momentRate', 0.1), perk('title', 1), perk('frame', 1)])).toBeUndefined();
    expect(startBonusOf([])).toBeUndefined();
  });

  it('bonusForSetup: perks off or no Lab Rep = no bonus; on = the active race perks', () => {
    expect(bonusForSetup({ perksOn: false }, 60, content)).toEqual({ perkIds: [] });
    expect(bonusForSetup({ perksOn: true }, 0, content)).toEqual({ perkIds: [] });
    const all = bonusForSetup({ perksOn: true }, 100, content);
    expect(all.perkIds).toEqual(racePerks(content, 100).map((p) => p.id));
    expect(all.bonus).toEqual(startBonusOf(racePerks(content, 100)));
    // Cosmetic perks never reach the race.
    expect(all.perkIds.every((id) => !/title|frame/.test(id))).toBe(true);
  });

  it('withSetupBonus replaces any earlier bonus and records the switch and perks', () => {
    const on = withSetupBonus({ ...SETUP, bonus: { startCash: 999 } }, { perksOn: true }, 3, content);
    expect(on.bonus?.startCash).toBe(perkTotals(racePerks(content, 3)).cash);
    expect(on.perksOn).toBe(true);
    expect(on.perkIds).toEqual(['seed-round', 'press-list']);
    const off = withSetupBonus({ ...SETUP, bonus: { startCash: 999 } }, { perksOn: false }, 3, content);
    expect(off.bonus).toBeUndefined();
    expect(off).toMatchObject({ perksOn: false, perkIds: [] });
  });

  it('the newest title and frame are the ones shown', () => {
    expect(cosmeticsAt(content, 0)).toEqual({});
    const late = cosmeticsAt(content, 100);
    expect(late.title?.id).toBe('title-visionary');
    expect(late.frame?.id).toBe('frame-holo');
    expect(cosmeticsAt(content, 13).title?.id).toBe('title-garage');
  });

  it('Lab Rep level and progress to the next perk', () => {
    expect(labRepLevel(content, 0)).toMatchObject({ level: 0, progress: 0 });
    expect(labRepLevel(content, 0).next?.rep).toBe(1);
    const mid = labRepLevel(content, 2); // between 1 and 3
    expect(mid.level).toBe(2);
    expect(mid.next?.rep).toBe(3);
    expect(mid.progress).toBeCloseTo(0.5, 9);
    expect(labRepLevel(content, 999)).toEqual({ level: 999, progress: 1 });
    expect(labRepLevel(content, Number.NaN).level).toBe(0);
  });
});

describe('race -> Garage reward input', () => {
  it('nothing for a run in progress (an abandoned run grants nothing)', () => {
    expect(raceRewardInputOf(createGame(pack, SETUP), pack)).toBeNull();
    expect(raceRewardInputOf(null, pack)).toBeNull();
  });

  it('a finished run: result, level, length, seed and the score before the race multipliers', () => {
    const end = runHeadless(pack, { ...SETUP, difficulty: 'arms-race' }, { policy: 'sensible', maxTicks: 3000 });
    expect(end.status).toBe('ended');
    const input = raceRewardInputOf(end, pack)!;
    expect(input).toMatchObject({ won: end.ending!.kind === 'win', difficulty: 'arms-race', runLength: 'sprint', seed: 5 });
    expect(input.score).toBeCloseTo(end.ending!.score / getScoreMultiplier(end, pack), 6);
  });
});

describe('meta store', () => {
  let finished: GameState;
  beforeAll(() => {
    setStorageBackend(null);
    finished = runHeadless(pack, SETUP, { policy: 'sensible', maxTicks: 3000 });
  });
  beforeEach(() => {
    useGarageStore.setState({ state: null });
    useMetaStore.setState({ loaded: false, labRep: 0, perksOn: true, reward: null, toggles: 0 });
  });

  it('grants a finished race once per run into the Garage save, and a rematch of the seed at most half', async () => {
    const first = await useMetaStore.getState().grantForRace(finished, pack);
    expect(first && first.rep).toBeGreaterThan(0);
    // The same run object again: no second grant.
    expect(await useMetaStore.getState().grantForRace(finished, pack)).toEqual(expect.objectContaining({ rep: first!.rep }));
    const saved = deserialize(await readValue(GARAGE_SAVE_KEY), content, Date.now()).state;
    expect(saved.race!.races).toBe(1);
    expect(labRepTotal(saved)).toBeCloseTo(first!.rep, 6);
    expect(useMetaStore.getState().labRep).toBeCloseTo(first!.rep, 6);
    // A rematch (same seed, a new state object) grants half or less.
    const rematch = JSON.parse(JSON.stringify(finished)) as GameState;
    const second = await useMetaStore.getState().grantForRace(rematch, pack);
    expect(second!.rep).toBeLessThanOrEqual(first!.rep / 2 + 0.05);
    expect(second!.repeat).toBe(true);
  });

  it('a run in progress grants nothing', async () => {
    expect(await useMetaStore.getState().grantForRace(createGame(pack, SETUP), pack)).toBeNull();
  });

  it('writes into the open Garage when it is loaded', async () => {
    useGarageStore.setState({ state: deserialize(null, content, Date.now()).state });
    const other = JSON.parse(JSON.stringify(finished)) as GameState;
    other.seed = 123456;
    await useMetaStore.getState().grantForRace(other, pack);
    expect(useGarageStore.getState().state!.race?.last?.seen).toBe(false);
    useGarageStore.setState({ state: null });
  });

  it('the run setup keeps its bonus and perk facts through Restart and the run save', () => {
    useMetaStore.setState({ loaded: true, labRep: 10, perksOn: true });
    useGameStore.getState().newGame(withPerks({ ...SETUP, seed: 9 }));
    const state = useGameStore.getState().state!;
    const setup = restartSetup(state);
    expect(setup.bonus?.startCash).toBeGreaterThan(0);
    expect(setup.perksOn).toBe(true);
    expect(setup.perkIds?.length).toBeGreaterThan(0);
    const save = parseRunSave(JSON.stringify(makeRunSave(state, pack.version)))!;
    expect(save.setup.bonus).toEqual(setup.bonus);
    expect(save.setup.perksOn).toBe(true);
    useGameStore.getState().reset();
    useGameStore.setState({ setup: null });
    restoreRun(save);
    expect(restartSetup(useGameStore.getState().state!).bonus).toEqual(setup.bonus);
    // Restart replays the same start: same bonus applied.
    useGameStore.getState().newGame(restartSetup(useGameStore.getState().state!));
    expect(useGameStore.getState().state!.labs.player.cash).toBe(state.labs.player.cash);
  });

  it('perks off: the setup records it and gets no bonus', () => {
    useMetaStore.setState({ loaded: true, labRep: 10 });
    useGameStore.getState().newGame(withPerks({ ...SETUP, seed: 10 }, false));
    expect(useGameStore.getState().setup).toMatchObject({ perksOn: false, perkIds: [] });
    expect(useGameStore.getState().setup?.bonus).toBeUndefined();
  });
});
