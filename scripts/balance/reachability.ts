/// <reference types="node" />
/**
 * Shows that achievements and ending variants the normal bots never earn are reachable:
 * each probe plays sensible runs on a copy of the pack changed so the bot plays the
 * required way (it cannot express "never buy X" otherwise), then counts the target.
 * The changes also apply to rivals, so a probe proves possibility, not frequency.
 *
 *   npm run balance:reach -- [--runs 200]
 */
import { aiLabPack } from '@/content';
import { runHeadless, type ContentPack, type GameState } from '@/engine';

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
  {
    name: 'achievement cloud-native (AGI win, no data centre ever built)',
    pack: { ...aiLabPack, balance: { ...aiLabPack.balance, maxDataCentresPerRegion: 0 } },
    target: (s) => s.achievements.includes('cloud-native'),
  },
  { name: 'achievement monk-mode (AGI win without reach-app)', pack: withoutNode('reach-app'), target: (s) => s.achievements.includes('monk-mode') },
  { name: 'ending agi-reckless (AGI without cap-safety-team)', pack: withoutNode('cap-safety-team'), target: (s) => s.ending?.endingId === 'agi-reckless' },
  { name: 'ending agi (default: safety team, no alignment)', pack: withoutNode('cap-alignment'), target: (s) => s.ending?.endingId === 'agi' },
  {
    name: 'ending monopoly (default: without shadow-hostile)',
    pack: withoutNode('shadow-hostile'),
    target: (s) => s.ending?.endingId === 'monopoly',
  },
];

const args = process.argv.slice(2);
const runsArg = args.indexOf('--runs');
const runs = runsArg >= 0 ? Number(args[runsArg + 1]) : 200;

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
