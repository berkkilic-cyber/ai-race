import { chooseAiActions, chooseEventChoice, getNodeCost, type GameState } from '@/engine';

import { useGarageStore } from '../../garage/store';
import { useGameStore } from '../../store/game';
import { getSoundLog, resetSoundEngineForTests } from '../engine';
import { deriveGarageCues, GARAGE_TAP_MAX_RATE } from '../garageSounds';
import { resetHapticsForTests } from '../haptics';
import { installFeel, uninstallFeelForTests } from '../install';
import { createRaceMemo, deriveRaceCues, METER_WARNING_COOLDOWN_TICKS } from '../raceSounds';
import { resetFeelSettingsForTests, useFeelSettings } from '../settings';

const SETUP = { playerName: 'Test Lab', founderId: 'researcher', homeRegion: 'canada', seed: 42 };

function state(): GameState {
  const s = useGameStore.getState().state;
  if (!s) throw new Error('no run');
  return s;
}
const names = () => getSoundLog().map((e) => e.name);

let now = 0;
beforeAll(() => installFeel());
afterAll(() => uninstallFeelForTests());
beforeEach(() => {
  now = 10_000;
  resetFeelSettingsForTests();
  resetHapticsForTests(() => now);
  useGameStore.getState().reset();
  resetSoundEngineForTests({ backend: null, clock: () => now });
});

/** Ticks through the store, moving the clock half a second per tick as the game loop does at 1x. */
function tickN(n: number): void {
  for (let i = 0; i < n; i++) {
    useGameStore.getState().tick();
    now += 500;
  }
}

describe('race sounds', () => {
  it('1,000 ticks with no player action and no world events make no sound', () => {
    const { pack } = useGameStore.getState();
    // A quiet world: no rivals and no event cards, so nothing notable can happen without the player.
    useGameStore.setState({ pack: { ...pack, events: [], achievements: [] } });
    useGameStore.getState().newGame({ ...SETUP, rivalIds: [] });
    useGameStore.setState({ pack: { ...pack, events: [], achievements: [] } });
    resetSoundEngineForTests({ backend: null, clock: () => now });
    const before = state().tick;
    tickN(1000);
    expect(state().tick - before).toBeGreaterThan(900);
    expect(names()).toEqual([]);
  });

  it('a full world still never sounds per tick: 1,000 ticks give only a handful of discrete sounds', () => {
    useGameStore.getState().newGame(SETUP);
    resetSoundEngineForTests({ backend: null, clock: () => now });
    let ticks = 0;
    for (let i = 0; i < 3000 && ticks < 1000; i++) {
      const s = state();
      if (s.status === 'ended') break;
      if (s.pendingEvent) {
        // Leave event cards to the player: dismiss without a sound being per tick.
        const choice = chooseEventChoice(s, useGameStore.getState().pack, s.playerLabId)!;
        useGameStore.getState().dispatch({ type: 'resolveEvent', labId: s.playerLabId, choiceId: choice });
        now += 500;
        continue;
      }
      tickN(1);
      ticks++;
    }
    const sounds = names();
    // Event open + confirm pairs, rival launches, warnings: far fewer than one per tick.
    expect(sounds.length).toBeLessThan(ticks / 10);
    expect(sounds.every((n) => ['event-open', 'event-confirm', 'rival-launch', 'meter-warning', 'model-launch', 'achievement', 'win-sting', 'lose-sting'].includes(n))).toBe(true);
  });

  it('player actions sound: buy, data centre, region launch; an unaffordable buy denies', () => {
    useGameStore.getState().newGame(SETUP);
    const { pack } = useGameStore.getState();
    const s = state();
    const id = s.playerLabId;
    // Make the player rich so the bot's plan can afford things.
    useGameStore.setState({ state: { ...s, labs: { ...s.labs, [id]: { ...s.labs[id], hype: 1e6, cash: 1e6 } } } });
    resetSoundEngineForTests({ backend: null, clock: () => now });
    const node = pack.nodes.find((n) => !n.requires?.length)!;
    expect(useGameStore.getState().dispatch({ type: 'buyNode', labId: id, nodeId: node.id }).ok).toBe(true);
    now += 1000;
    expect(useGameStore.getState().dispatch({ type: 'buildDataCentre', labId: id, regionId: 'canada' }).ok).toBe(true);
    now += 1000;
    const region = pack.regions.find((r) => !state().labs[id].adoption[r.id])!;
    expect(useGameStore.getState().dispatch({ type: 'launchInRegion', labId: id, regionId: region.id }).ok).toBe(true);
    now += 1000;
    const broke = state();
    useGameStore.setState({ state: { ...broke, labs: { ...broke.labs, [id]: { ...broke.labs[id], hype: 0, cash: 0 } } } });
    const other = pack.nodes.find((n) => !n.requires?.length && !state().labs[id].ownedNodes.includes(n.id) && getNodeCost(state(), pack, id, n.id).hype > 0)!;
    expect(useGameStore.getState().dispatch({ type: 'buyNode', labId: id, nodeId: other.id }).ok).toBe(false);
    expect(names()).toEqual(['buy', 'datacentre-built', 'region-launch', 'deny']);
  });

  it('derives launches, events, moments, warnings and the ending from state changes', () => {
    useGameStore.getState().newGame(SETUP);
    const { pack } = useGameStore.getState();
    const memo = createRaceMemo();
    const a = state();
    const id = a.playerLabId;
    const rival = a.labOrder.find((l) => l !== id)!;
    const t1 = { ...a, tick: a.tick + 1 };
    expect(deriveRaceCues(a, t1, pack, memo)).toEqual([]);
    const launch = { ...t1, tick: t1.tick + 1, news: [...t1.news, { tick: 2, kind: 'launch' as const, textKey: 'x', tone: 'good' as const, labId: id }, { tick: 2, kind: 'launch' as const, textKey: 'y', tone: 'bad' as const, labId: rival }] };
    expect(deriveRaceCues(t1, launch, pack, memo).map((c) => c.cue)).toEqual(['modelLaunch', 'rivalLaunch']);
    const event = { ...launch, pendingEvent: { eventId: pack.events[0].id, labId: id } };
    expect(deriveRaceCues(launch, event, pack, memo).map((c) => c.cue)).toEqual(['eventOpen']);
    // Composure: regulation from calm to tense warns once, again only after the cooldown.
    const calm = { ...launch, labs: { ...launch.labs, [id]: { ...launch.labs[id], regulation: 10 } } };
    const tense = { ...calm, tick: calm.tick + 1, labs: { ...calm.labs, [id]: { ...calm.labs[id], regulation: 70 } } };
    expect(deriveRaceCues(calm, tense, pack, memo).map((c) => c.cue)).toEqual(['meterWarning']);
    const calmAgain = { ...tense, tick: tense.tick + 1, labs: calm.labs };
    const tenseAgain = { ...tense, tick: tense.tick + 2 };
    expect(deriveRaceCues(calmAgain, tenseAgain, pack, memo)).toEqual([]);
    const later = { ...tense, tick: tense.tick + METER_WARNING_COOLDOWN_TICKS };
    expect(deriveRaceCues(calmAgain, later, pack, memo).map((c) => c.cue)).toEqual(['meterWarning']);
    // Moments: a threat contained vs a boost collected.
    const threat = pack.moments.find((m) => m.kind === 'threat')!;
    const boost = pack.moments.find((m) => m.kind === 'boost')!;
    const withMoments = { ...t1, moments: [{ uid: 'm1', defId: threat.id, labId: id, regionId: 'canada', spawnTick: 0, expiresTick: 99 }, { uid: 'm2', defId: boost.id, labId: id, regionId: 'canada', spawnTick: 0, expiresTick: 99 }] };
    const collect = (uid: string) => ({ ...withMoments, moments: withMoments.moments.filter((m) => m.uid !== uid), labs: { ...withMoments.labs, [id]: { ...withMoments.labs[id], stats: { ...withMoments.labs[id].stats, momentsCollected: withMoments.labs[id].stats.momentsCollected + 1 } } } });
    expect(deriveRaceCues(withMoments, collect('m1'), pack, memo).map((c) => c.cue)).toEqual(['momentAverted']);
    expect(deriveRaceCues(withMoments, collect('m2'), pack, memo).map((c) => c.cue)).toEqual(['momentBoost']);
    // An expiry (no collection) is silent.
    expect(deriveRaceCues(withMoments, { ...withMoments, tick: withMoments.tick + 1, moments: [] }, pack, memo)).toEqual([]);
    // The ending replaces everything else.
    const won = { ...t1, tick: t1.tick + 1, status: 'ended' as const, ending: { endingId: 'e', kind: 'win' as const, trigger: 'agi' as never, tick: 3, score: 1 } };
    expect(deriveRaceCues(t1, won, pack, memo)).toEqual([{ cue: 'win' }]);
    expect(deriveRaceCues(t1, { ...won, ending: { ...won.ending, kind: 'lose' as const } }, pack, memo)).toEqual([{ cue: 'lose' }]);
    // A new run says nothing.
    expect(deriveRaceCues(won, { ...a, seed: a.seed + 1 }, pack, memo)).toEqual([]);
  });

  it('a bot-played stretch through the store produces varied, rate-limited sounds', () => {
    useGameStore.getState().newGame(SETUP);
    resetSoundEngineForTests({ backend: null, clock: () => now });
    for (let i = 0; i < 600; i++) {
      const s = state();
      if (s.status === 'ended') break;
      const { pack, dispatch } = useGameStore.getState();
      if (s.pendingEvent) {
        dispatch({ type: 'resolveEvent', labId: s.playerLabId, choiceId: chooseEventChoice(s, pack, s.playerLabId)! });
        now += 300;
        continue;
      }
      if (s.tick % 10 === 0) for (const action of chooseAiActions(s, pack, s.playerLabId)) {
        dispatch(action);
        now += 60;
      }
      tickN(1);
    }
    const kinds = new Set(names());
    expect(kinds.has('buy')).toBe(true);
    expect(kinds.has('event-open')).toBe(true);
  });
});

describe('Garage sounds', () => {
  it('maps counters to cues, with tap pitch rising with the combo', () => {
    useGarageStore.getState().reset();
    const g = useGarageStore.getState().state!;
    const tap = (count: number) => ({ ...g, combo: { count, lastAt: 0 }, stats: { ...g.stats, taps: g.stats.taps + 1 } });
    expect(deriveGarageCues(g, tap(1))).toEqual([{ cue: 'garageTap', rate: 1 }]);
    const fast = deriveGarageCues(g, tap(20))[0].rate!;
    expect(fast).toBeGreaterThan(1);
    expect(deriveGarageCues(g, tap(500))[0].rate).toBe(GARAGE_TAP_MAX_RATE);
    expect(deriveGarageCues(g, { ...g, stats: { ...g.stats, generatorsBought: g.stats.generatorsBought + 1 } })).toEqual([{ cue: 'garageBuy' }]);
    expect(deriveGarageCues(g, { ...g, stats: { ...g.stats, goldenCaught: g.stats.goldenCaught + 1 } })).toEqual([{ cue: 'garageGolden' }]);
    expect(deriveGarageCues(g, { ...g, stats: { ...g.stats, modelsShipped: g.stats.modelsShipped + 1 } })).toEqual([{ cue: 'garageShip' }]);
    // The clock moving alone is silent.
    expect(deriveGarageCues(g, { ...g, now: g.now + 1000, tokens: g.tokens + 5 })).toEqual([]);
  });

  it('taps through the store sound the Garage tap; an unaffordable buy denies', () => {
    useGarageStore.getState().reset();
    resetSoundEngineForTests({ backend: null, clock: () => now });
    for (let i = 0; i < 5; i++) {
      useGarageStore.getState().tap();
      now += 100;
    }
    const content = useGarageStore.getState().content;
    const priciest = [...content.generators].sort((a, b) => b.baseCost - a.baseCost)[0];
    expect(useGarageStore.getState().buy(priciest.id)).toBe(false);
    // The first tap may also unlock an achievement (it sounds alongside the tap).
    expect(names().filter((n) => n !== 'achievement')).toEqual(['garage-tap', 'garage-tap', 'garage-tap', 'garage-tap', 'garage-tap', 'deny']);
  });

  it('the Garage haptics switch delegates to the feel settings', () => {
    useGarageStore.getState().setHaptics(false);
    expect(useFeelSettings.getState().haptics).toBe(false);
    useFeelSettings.getState().setHaptics(true);
    expect(useGarageStore.getState().settings.haptics).toBe(true);
  });
});
