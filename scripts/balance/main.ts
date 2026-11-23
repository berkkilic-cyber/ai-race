/// <reference types="node" />
/**
 * Balance simulation: plays N headless runs per bot policy across every founder
 * and a spread of home regions, then prints a markdown report.
 *
 *   npm run balance -- [--runs 1000] [--policies sensible,idle] [--seed 1]
 *                      [--coverage] [--workers 2] [--out report.md]
 *                      [--moment-skill 0,0.4,0.7,1]   (each policy once per skill)
 *                      [--moments file.json]          (replace the pack's moments for a sweep)
 *                      [--difficulty frontier|a,b|all] (default: the pack's default level)
 *                      [--runLength sprint|a,b|all]   (default: the pack's default run length;
 *                                                      with several, adds a table comparing them)
 *                      [--brief]                      (summary tables only, no per-policy detail)
 *                      [--routes]                     (routes and founders: per-founder win rates, top
 *                                                      nodes bought, risks fired, target checks)
 *
 * Seeds are base + run index, so a report is reproducible; tune on one --seed
 * and confirm on another.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';

import type { BotPolicy, ContentPack } from '@/engine';

import { coverageReport } from './coverage';
import { FOUNDERS, HOME_REGIONS } from './jobs';
import { difficultyTable, policyReport, routeReport, runLengthTables, summaryTable } from './report';
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
  /** Play every policy once per skill (labelled policy@skill); default: each policy's own skill. */
  momentSkills?: number[];
  /** Replacement moment list (JSON file) for sweeps. */
  moments?: ContentPack['moments'];
  /** Difficulty ids to play (each policy once per level); default: the pack's default. */
  difficulties?: string[];
  /** Run-length ids to play (each policy once per length); default: the pack's default. */
  runLengths?: string[];
  /** Only the summary tables. */
  brief: boolean;
  /** Add the routes and founders report. */
  routes: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { runs: 1000, policies: ALL_POLICIES, seed: 1, coverage: false, workers: availableParallelism(), balance: {}, brief: false, routes: false };
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
    else if (arg === '--moment-skill') options.momentSkills = next().split(',').map(Number);
    else if (arg === '--difficulty') {
      const value = next();
      options.difficulties = value === 'all' ? (PACK.difficulties ?? []).map((d) => d.id) : value.split(',');
      for (const id of options.difficulties) if (!(PACK.difficulties ?? []).some((d) => d.id === id)) throw new Error(`Unknown difficulty ${id}`);
    } else if (arg === '--runLength' || arg === '--run-length') {
      const value = next();
      options.runLengths = value === 'all' ? (PACK.runLengths ?? []).map((r) => r.id) : value.split(',');
      for (const id of options.runLengths) if (!(PACK.runLengths ?? []).some((r) => r.id === id)) throw new Error(`Unknown run length ${id}`);
    } else if (arg === '--brief') options.brief = true;
    else if (arg === '--routes') options.routes = true;
    else if (arg === '--moments') options.moments = JSON.parse(readFileSync(next(), 'utf8')) as ContentPack['moments'];
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

export function jobsFor(policy: BotPolicy, runs: number, seed: number, coverage: boolean, momentSkill?: number, difficulty?: string, runLength?: string): Job[] {
  const jobs: Job[] = [];
  for (let i = 0; i < runs; i++) {
    jobs.push({
      ...(coverage && i % 4 === 3 ? { playerName: SECRET_NAMES[Math.floor(i / 4) % SECRET_NAMES.length] } : {}),
      policy,
      founderId: FOUNDERS[i % FOUNDERS.length],
      homeRegion: HOME_REGIONS[Math.floor(i / FOUNDERS.length) % HOME_REGIONS.length],
      seed: seed * 100_003 + i,
      coverage,
      ...(momentSkill !== undefined ? { momentSkill } : {}),
      ...(difficulty !== undefined ? { difficulty } : {}),
      ...(runLength !== undefined ? { runLength } : {}),
    });
  }
  return jobs;
}

function runInWorkers(jobs: Job[], workers: number, balance: Record<string, unknown>, moments?: ContentPack['moments']): Promise<RunRecord[]> {
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
      const worker = new Worker(new URL(import.meta.url), { workerData: { worker: true, balance, moments } });
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
  const skills: (number | undefined)[] = options.momentSkills ?? [undefined];
  const levels: (string | undefined)[] = options.difficulties ?? [undefined];
  const lengths: (string | undefined)[] = options.runLengths ?? [undefined];
  const jobs = lengths.flatMap((length) =>
    levels.flatMap((level) =>
      options.policies.flatMap((p) => skills.flatMap((skill) => jobsFor(p, options.runs, options.seed, options.coverage, skill, level, length))),
    ),
  );
  setBalanceOverrides(options.balance, options.moments);
  const records = await runInWorkers(jobs, options.workers, options.balance, options.moments);
  const seconds = (performance.now() - start) / 1000;
  const byPolicy = new Map<string, RunRecord[]>();
  const multiLevel = levels.length > 1;
  const multiLength = lengths.length > 1;
  const labelOf = (job: Job): string =>
    `${multiLength ? `${job.runLength}:` : ''}${multiLevel ? `${job.difficulty}/` : ''}${job.momentSkill === undefined ? job.policy : `${job.policy}@${job.momentSkill}`}`;
  for (const record of records) byPolicy.set(labelOf(record.job), [...(byPolicy.get(labelOf(record.job)) ?? []), record]);

  const out: string[] = [];
  out.push(`# Balance report`);
  out.push('');
  out.push(
    `${records.length} runs (${options.runs} per policy, seed ${options.seed}, ${FOUNDERS.length} founders x ${HOME_REGIONS.length} home regions) in ${seconds.toFixed(1)} s with ${options.workers} worker(s); ${(records.length / seconds).toFixed(1)} runs/s.`,
  );
  if (Object.keys(options.balance).length > 0) out.push(`\nBalance overrides: \`${JSON.stringify(options.balance)}\``);
  if (options.moments) out.push(`\nMoments replaced (${options.moments.length} from --moments).`);
  out.push(`\nRun length: ${lengths.map((l) => l ?? `${PACK.defaultRunLength ?? 'none'} (pack default)`).join(', ')}.`);
  out.push(`\nDifficulty: ${levels.map((l) => l ?? `${PACK.defaultDifficulty ?? 'none'} (pack default)`).join(', ')}.`);
  out.push('');
  out.push(summaryTable(byPolicy));
  out.push('');
  if (multiLevel || options.difficulties) {
    for (const length of lengths) {
      if (multiLength) out.push(`Run length ${length}:\n`);
      const at = records.filter((r) => r.job.runLength === length);
      out.push(difficultyTable(at, levels.map((l) => l ?? PACK.defaultDifficulty ?? 'none'), PACK.defaultDifficulty ?? 'none'));
      out.push('');
    }
  }
  if (multiLength) {
    out.push(runLengthTables(records, lengths as string[], PACK.defaultDifficulty ?? 'none'));
    out.push('');
  }
  if (options.routes) {
    out.push(routeReport(records, PACK.nodes, PACK.defaultDifficulty ?? 'none', PACK.defaultRunLength ?? 'none'));
    out.push('');
  }
  if (!options.brief) {
    for (const [policy, runs] of byPolicy) {
      out.push(policyReport(policy, runs));
      out.push('');
    }
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
  setBalanceOverrides(workerData.balance as Record<string, unknown>, workerData.moments as ContentPack['moments'] | undefined);
  parentPort?.on('message', (msg: { index: number; job: Job }) => {
    parentPort?.postMessage({ index: msg.index, record: simulate(msg.job) });
  });
}
