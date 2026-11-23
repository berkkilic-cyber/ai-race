/// <reference types="node" />
/**
 * Shows that achievements and ending variants the normal bots never earn are reachable:
 * each probe plays sensible runs on a copy of the pack changed so the bot plays the
 * required way (it cannot express "never buy X" otherwise), then counts the target.
 * The changes also apply to rivals, so a probe proves possibility, not frequency.
 *
 *   npm run balance:reach -- [--runs 200] [--cloud-native [--max-built 0|1]]
 */
import { aiLabPack } from '@/content';
import {
  applyAction,
  chooseAiActions,
  chooseEventChoice,
  createGame,
  getCompute,
  getCapabilityLevel,
  getMoments,
  runHeadless,
  step,
  type ContentPack,
  type GameState,
} from '@/engine';

import { FOUNDERS, HOME_REGIONS } from './jobs';

interface Probe {
  name: string;
  target: (state: GameState) => boolean;
  pack: ContentPack;
}

/** The pack with one node made unaffordable, so no lab ever buys it. */
function withoutNode(nodeId: string): ContentPack {
  return { ...aiLabPack, nodes: aiLabPack.nodes.map((n) => (n.id === nodeId ? { ...n, cost: 1000 } : n)) };
}

const PROBES: Probe[] = [
  { name: 'achievement monk-mode (AGI win without reach-app)', pack: withoutNode('reach-app'), target: (s) => s.achievements.includes('monk-mode') },
  { name: 'ending agi-reckless (AGI without cap-safety-team)', pack: withoutNode('cap-safety-team'), target: (s) => s.ending?.endingId === 'agi-reckless' },
  { name: 'ending agi (default: safety team, no alignment)', pack: withoutNode('cap-alignment'), target: (s) => s.ending?.endingId === 'agi' },
  {
    name: 'ending monopoly (default: without shadow-hostile)',
    pack: withoutNode('shadow-hostile'),
    target: (s) => s.ending?.endingId === 'monopoly',
  },
];

/**
 * Cloud Native with the real pack (rivals build as usual): the player plans like the sensible
 * bot but builds at most `maxBuilt` data centres (upgrades allowed when it may build one), takes an event choice that gives compute
 * whenever one is offered and affordable, and taps every moment. A determined human, not a bot.
 */
function cloudNativeRun(pack: ContentPack, seed: number, founderId: string, homeRegion: string, difficulty: string, runLength?: string, maxBuilt = 0): { state: GameState; peakCompute: number; peakTier: number } {
  let state = createGame(pack, { playerName: 'Probe Lab', founderId, homeRegion, seed, difficulty, ...(runLength ? { runLength } : {}) });
  const me = state.playerLabId;
  let peakCompute = 0;
  let peakTier = 0;
  const apply = (action: Parameters<typeof applyAction>[2]): void => {
    const result = applyAction(state, pack, action);
    if (result.ok) state = result.state;
  };
  while (state.status === 'running' && state.tick < 8000) {
    if (state.pendingEvent) {
      const event = pack.events.find((e) => e.id === state.pendingEvent?.eventId);
      const lab = state.labs[me];
      const computeChoice = event?.choices.find(
        (c) => c.effects.some((e) => e.type === 'compute' && e.amount > 0) && (c.cost?.cash ?? 0) <= lab.cash && (c.cost?.hype ?? 0) <= lab.hype,
      );
      const choiceId = computeChoice?.id ?? chooseEventChoice(state, pack, me);
      if (choiceId !== undefined) apply({ type: 'resolveEvent', labId: me, choiceId });
      if (state.pendingEvent) break;
    }
    for (const moment of getMoments(state, me)) apply({ type: 'collectMoment', labId: me, uid: moment.uid });
    if (state.tick % 10 === 0) {
      for (const action of chooseAiActions(state, pack, me)) {
        if (action.type === 'buildDataCentre' && state.labs[me].stats.dataCentresBuilt >= maxBuilt) continue;
        if (action.type === 'upgradeDataCentre' && maxBuilt === 0) continue;
        apply(action);
      }
    }
    state = step(state, pack);
    if (state.tick % 20 === 0) {
      peakCompute = Math.max(peakCompute, getCompute(state, pack, me));
      peakTier = Math.max(peakTier, getCapabilityLevel(state, pack, me));
    }
  }
  return { state, peakCompute, peakTier };
}

const args = process.argv.slice(2);
const runsArg = args.indexOf('--runs');
const runs = runsArg >= 0 ? Number(args[runsArg + 1]) : 200;

const only = args.includes('--cloud-native');
const maxBuiltArg = args.indexOf('--max-built');
// Cloud Native allows one data centre of your own; --max-built 0 shows that none is not enough.
const maxBuilt = maxBuiltArg >= 0 ? Number(args[maxBuiltArg + 1]) : 1;
for (const runLength of ['full', 'sprint']) {
  for (const difficulty of ['sandbox', 'frontier']) {
    const pack = aiLabPack;
    let hits = 0;
    let agiWins = 0;
    const wins = new Map<string, number>();
    const computes: number[] = [];
    const tiers: number[] = [];
    const n = Math.min(runs, 60);
    for (let i = 0; i < n; i++) {
      const { state, peakCompute, peakTier } = cloudNativeRun(pack, 70_000 + i, FOUNDERS[i % FOUNDERS.length], HOME_REGIONS[Math.floor(i / FOUNDERS.length) % HOME_REGIONS.length], difficulty, runLength, maxBuilt);
      if (state.achievements.includes('cloud-native')) hits++;
      if (state.ending?.trigger === 'agi') agiWins++;
      if (state.ending?.kind === 'win') wins.set(state.ending.trigger, (wins.get(state.ending.trigger) ?? 0) + 1);
      computes.push(peakCompute);
      tiers.push(peakTier);
    }
    computes.sort((a, b) => a - b);
    tiers.sort((a, b) => a - b);
    console.log(
      `cloud-native, real pack, at most ${maxBuilt} data centre(s) built (${runLength}, ${difficulty}): ${hits} of ${n} runs earned it; AGI wins ${agiWins}; all wins ${[...wins].map(([t, c]) => `${t} ${c}`).join(', ') || 'none'}; peak compute p50 ${computes[n >> 1].toFixed(0)} max ${computes[n - 1].toFixed(0)}; peak tier p50 ${tiers[n >> 1]} max ${tiers[n - 1]}`,
    );
  }
}
if (only) process.exit(0);

for (const probe of PROBES) {
  let hits = 0;
  for (let i = 0; i < runs; i++) {
    const state = runHeadless(
      probe.pack,
      {
        playerName: 'Probe Lab',
        founderId: FOUNDERS[i % FOUNDERS.length],
        homeRegion: HOME_REGIONS[Math.floor(i / FOUNDERS.length) % HOME_REGIONS.length],
        seed: 50_000 + i,
      },
      { policy: i % 2 === 0 ? 'capability' : 'shadow', maxTicks: 8000 },
    );
    if (probe.target(state)) hits++;
  }
  console.log(`${probe.name}: ${hits} of ${runs} runs`);
}
