/// <reference types="node" />
/**
 * Balance simulation: plays N headless runs per bot policy across every founder
 * and a spread of home regions, then prints a markdown report.
 *
 *   npm run balance -- [--runs 1000] [--policies sensible,idle] [--seed 1]
 *                      [--coverage] [--workers 2] [--out report.md]
 *
 * Seeds are base + run index, so a report is reproducible; tune on one --seed
 * and confirm on another.
 */
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

import type { BotPolicy } from '@/engine';

import { coverageReport } from './coverage';
import { FOUNDERS, HOME_REGIONS } from './jobs';
import { policyReport, summaryTable } from './report';
import { PACK, setBalanceOverrides, simulate, type Job, type RunRecord } from './simulate';

const ALL_POLICIES: BotPolicy[] = ['sensible', 'capability', 'reach', 'shadow', 'random', 'idle'];

interface Options {
  runs: number;
  policies: BotPolicy[];
  seed: number;
  coverage: boolean;
  workers: number;
  out?: string;
  balance: Record<string, unknown>;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { runs: 1000, policies: ALL_POLICIES, seed: 1, coverage: false, workers: availableParallelism(), balance: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--runs') options.runs = Number(next());
    else if (arg === '--policies') options.policies = next().split(',') as BotPolicy[];
    else if (arg === '--seed') options.seed = Number(next());
    else if (arg === '--coverage') options.coverage = true;
    else if (arg === '--workers') options.workers = Math.max(1, Number(next()));
    else if (arg === '--out') options.out = next();
    else if (arg === '--balance') options.balance = JSON.parse(next()) as Record<string, unknown>;
    else throw new Error(`Unknown argument ${arg}`);
  }
  return options;
}

/** Every secret lab name in the pack (labNameIs conditions), tried by every 4th coverage run. */
const SECRET_NAMES = [
  ...new Set(
    [...PACK.events.flatMap((e) => e.conditions), ...PACK.headlines.flatMap((h) => h.conditions), ...PACK.endings.flatMap((e) => e.conditions ?? [])].flatMap((c) =>
      c.type === 'labNameIs' ? [c.names[0]] : [],
    ),
  ),
];

export function jobsFor(policy: BotPolicy, runs: number, seed: number, coverage: boolean): Job[] {
  const jobs: Job[] = [];
  for (let i = 0; i < runs; i++) {
    jobs.push({
      ...(coverage && i % 4 === 3 ? { playerName: SECRET_NAMES[Math.floor(i / 4) % SECRET_NAMES.length] } : {}),
      policy,
      founderId: FOUNDERS[i % FOUNDERS.length],
      homeRegion: HOME_REGIONS[Math.floor(i / FOUNDERS.length) % HOME_REGIONS.length],
      seed: seed * 100_003 + i,
      coverage,
    });
  }
  return jobs;
}

function runInWorkers(jobs: Job[], workers: number, balance: Record<string, unknown>): Promise<RunRecord[]> {
  const results: RunRecord[] = new Array(jobs.length);
  if (workers <= 1) {
    jobs.forEach((job, i) => (results[i] = simulate(job)));
    return Promise.resolve(results);
  }
  let nextJob = 0;
  let done = 0;
  return new Promise((resolve, reject) => {
    const feed = (worker: Worker) => {
      if (nextJob >= jobs.length) {
        void worker.terminate();
        return;
      }
      const index = nextJob++;
      worker.postMessage({ index, job: jobs[index] });
    };
    for (let w = 0; w < Math.min(workers, jobs.length); w++) {
      const worker = new Worker(new URL(import.meta.url), { workerData: { worker: true, balance } });
      worker.on('message', (msg: { index: number; record: RunRecord }) => {
        results[msg.index] = msg.record;
        done++;
        if (done === jobs.length) resolve(results);
        feed(worker);
      });
      worker.on('error', reject);
      feed(worker);
    }
  });
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const start = performance.now();
  const jobs = options.policies.flatMap((p) => jobsFor(p, options.runs, options.seed, options.coverage));
  setBalanceOverrides(options.balance);
  const records = await runInWorkers(jobs, options.workers, options.balance);
  const seconds = (performance.now() - start) / 1000;
  const byPolicy = new Map<string, RunRecord[]>();
  for (const record of records) byPolicy.set(record.job.policy, [...(byPolicy.get(record.job.policy) ?? []), record]);

  const out: string[] = [];
  out.push(`# Balance report`);
  out.push('');
  out.push(
    `${records.length} runs (${options.runs} per policy, seed ${options.seed}, ${FOUNDERS.length} founders x ${HOME_REGIONS.length} home regions) in ${seconds.toFixed(1)} s with ${options.workers} worker(s); ${(records.length / seconds).toFixed(1)} runs/s.`,
  );
  if (Object.keys(options.balance).length > 0) out.push(`\nBalance overrides: \`${JSON.stringify(options.balance)}\``);
  out.push('');
  out.push(summaryTable(byPolicy));
  out.push('');
  for (const [policy, runs] of byPolicy) {
    out.push(policyReport(policy, runs));
    out.push('');
  }
  if (options.coverage) out.push(coverageReport(records, byPolicy.get('sensible') ?? []));
  const text = out.join('\n');
  if (options.out) writeFileSync(options.out, text);
  console.log(text);
}

if (isMainThread) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
} else if (workerData?.worker) {
  setBalanceOverrides(workerData.balance as Record<string, unknown>);
  parentPort?.on('message', (msg: { index: number; job: Job }) => {
    parentPort?.postMessage({ index: msg.index, record: simulate(msg.job) });
  });
}
