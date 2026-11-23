/// <reference types="node" />
/**
 * What a finished race grants the Garage (Lab Rep and blueprints), per difficulty and run
 * length, from headless runs of the sensible bot. Used for the Lab Rep source arithmetic in
 * docs/GARAGE.md ("Link with the race").
 *
 *   npx esbuild scripts/balance/raceReward.ts --bundle --platform=node --format=esm --alias:@=./src \
 *     --log-level=warning --outfile=node_modules/.cache/balance/raceReward.mjs \
 *     && node node_modules/.cache/balance/raceReward.mjs [runs=200] [seed=3]
 */
import { aiLabPack } from '@/content';
import { aiLabGarage } from '@/content/packs/ai-lab/garage';
import { runHeadless } from '@/engine';
import { createGarage, raceRewardQuote } from '@/idle';
import { raceRewardInputOf } from '@/ui/meta/logic';

import { FOUNDERS, HOME_REGIONS } from './jobs';

const runs = Number(process.argv[2] ?? 200);
const seed = Number(process.argv[3] ?? 3);
const garage = createGarage(aiLabGarage, 0);

const rows: string[] = ['| Difficulty | Length | Runs | Win | Raw score p50 (win / loss) | Rep per race (mean) | Blueprints min (mean) |', '| --- | --- | --- | --- | --- | --- | --- |'];
for (const length of (aiLabPack.runLengths ?? []).map((l) => l.id)) {
  for (const level of (aiLabPack.difficulties ?? []).map((d) => d.id)) {
    let wins = 0;
    let rep = 0;
    let boost = 0;
    const winScores: number[] = [];
    const lossScores: number[] = [];
    for (let i = 0; i < runs; i++) {
      const end = runHeadless(
        aiLabPack,
        { playerName: 'Bot Lab', founderId: FOUNDERS[i % FOUNDERS.length], homeRegion: HOME_REGIONS[Math.floor(i / FOUNDERS.length) % HOME_REGIONS.length], seed: seed * 100_003 + i, difficulty: level, runLength: length },
        { policy: 'sensible', maxTicks: 6000 },
      );
      const input = raceRewardInputOf(end, aiLabPack);
      if (!input) continue;
      if (input.won) wins++;
      (input.won ? winScores : lossScores).push(input.score);
      const q = raceRewardQuote(garage, aiLabGarage, input);
      rep += q.rep;
      boost += q.boostMs / 60000;
    }
    const p50 = (a: number[]) => (a.length ? Math.round(a.sort((x, y) => x - y)[Math.floor(a.length / 2)]) : 0);
    rows.push(`| ${level} | ${length} | ${runs} | ${((wins / runs) * 100).toFixed(1)}% | ${p50(winScores)} / ${p50(lossScores)} | ${(rep / runs).toFixed(2)} | ${(boost / runs).toFixed(1)} |`);
  }
}
console.log(rows.join('\n'));
