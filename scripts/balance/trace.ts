/// <reference types="node" />
/**
 * Prints the state of every lab every N ticks for one headless run.
 *
 *   npm run balance:trace -- [--policy sensible] [--founder hustler] [--home turkiye] [--seed 1] [--every 200] [--balance '{...}']
 */
import { getAcquirePrice, getCapabilityLevel, getCompute, getIncome, getWorldShare, runHeadless, type BotPolicy, type GameState } from '@/engine';

import { PACK, setBalanceOverrides } from './simulate';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
setBalanceOverrides(JSON.parse(arg('balance', '{}')) as Record<string, unknown>);
const every = Number(arg('every', '200'));

function line(state: GameState, id: string): string {
  const lab = state.labs[id];
  const income = lab.active ? getIncome(state, PACK, id) : { cash: 0, hype: 0 };
  const f = (v: number, d = 0) => v.toFixed(d).padStart(5);
  return [
    id.padEnd(10),
    lab.active ? ' ' : lab.eliminated ? lab.eliminated.reason[0] : '-',
    `hype ${f(lab.hype)} (+${income.hype.toFixed(2)})`,
    `cash ${f(lab.cash)} (+${income.cash.toFixed(2)})`,
    `share ${f(getWorldShare(state, PACK, id) * 100, 1)}%`,
    `nodes ${String(lab.ownedNodes.length).padStart(2)}`,
    `dc ${lab.dataCentres.length}/${lab.dataCentres.reduce((s, d) => s + d.level, 0)}`,
    `comp ${f(getCompute(state, PACK, id))}`,
    `cap ${lab.active ? getCapabilityLevel(state, PACK, id) : 0}`,
    `agi ${f(lab.agiProgress, 1)}`,
    `reg ${f(lab.regulation)}`,
    `bl ${f(lab.backlash)}`,
    id !== state.playerLabId && lab.active ? `price ${f(getAcquirePrice(state, PACK, state.playerLabId, id))}` : '',
  ].join(' ');
}

const final = runHeadless(
  PACK,
  { playerName: 'Trace Lab', founderId: arg('founder', 'hustler'), homeRegion: arg('home', 'turkiye'), seed: Number(arg('seed', '1')) },
  {
    policy: arg('policy', 'sensible') as BotPolicy,
    maxTicks: 8000,
    onTick: (state) => {
      if (state.tick % every !== 0) return;
      console.log(`-- tick ${state.tick}`);
      for (const id of state.labOrder) console.log(line(state, id));
    },
  },
);
console.log(`== ended at ${final.tick}: ${final.ending?.endingId} (${final.ending?.trigger})`);
for (const id of final.labOrder) console.log(line(final, id));
