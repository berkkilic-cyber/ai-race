/** Aggregates run records into the balance report tables. */
import type { RunRecord } from './simulate';

export function pct(part: number, whole: number): string {
  return whole === 0 ? '-' : `${((100 * part) / whole).toFixed(1)}%`;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))];
}

function fmt(value: number | null, digits = 0): string {
  return value === null ? '-' : value.toFixed(digits);
}

function median(values: number[]): number | null {
  return percentile(values, 50);
}

function present<T>(values: (T | null)[]): T[] {
  return values.filter((v): v is T => v !== null);
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;
  return [line(headers), `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`, ...rows.map(line)].join('\n');
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

const TRIGGERS = ['agi', 'dependence', 'monopoly', 'banned', 'revolt', 'rivalAgi', 'none'];

/** The full markdown report for one policy's runs. */
export function policyReport(policy: string, runs: RunRecord[]): string {
  const out: string[] = [];
  const n = runs.length;
  const wins = runs.filter((r) => r.kind === 'win');
  const ticks = runs.map((r) => r.ticks);
  out.push(`### Policy \`${policy}\` (${n} runs)`);
  out.push('');
  out.push(
    table(
      ['Win rate', 'Median ticks', 'p10', 'p90', 'Errors'],
      [[pct(wins.length, n), fmt(median(ticks)), fmt(percentile(ticks, 10)), fmt(percentile(ticks, 90)), String(runs.filter((r) => r.error).length)]],
    ),
  );
  out.push('');
  const byTrigger = countBy(runs, (r) => r.trigger ?? 'none');
  out.push('Endings by trigger:');
  out.push('');
  out.push(
    table(
      TRIGGERS,
      [TRIGGERS.map((t) => pct(byTrigger.get(t) ?? 0, n))],
    ),
  );
  out.push('');
  const byEnding = [...countBy(runs, (r) => r.endingId ?? 'none').entries()].sort((a, b) => b[1] - a[1]);
  out.push(`Ending variants: ${byEnding.map(([id, c]) => `${id} ${pct(c, n)}`).join(', ')}`);
  out.push('');

  const capRows = [0, 1, 2, 3, 4].map((i) => {
    const reached = present(runs.map((r) => r.capabilityTicks[i]));
    return [`Model tier ${i + 1}`, pct(reached.length, n), fmt(median(reached)), fmt(percentile(reached, 90))];
  });
  const firstNode = present(runs.map((r) => r.firstNodeTick));
  const firstDc = present(runs.map((r) => r.firstDataCentreTick));
  out.push('Pacing (tick reached; median over runs that reached it):');
  out.push('');
  out.push(
    table(
      ['Milestone', 'Reached', 'Median', 'p90'],
      [
        ['First node', pct(firstNode.length, n), fmt(median(firstNode)), fmt(percentile(firstNode, 90))],
        ['First data centre', pct(firstDc.length, n), fmt(median(firstDc)), fmt(percentile(firstDc, 90))],
        ...capRows,
      ],
    ),
  );
  out.push('');
  const gaps = runs.flatMap((r) => r.purchaseGaps.slice(1));
  const runMedianGaps = present(runs.map((r) => median(r.purchaseGaps.slice(1))));
  out.push(
    `Purchases: ${fmt(median(runs.map((r) => r.purchases)))} per run (median); gap between purchases median ${fmt(median(gaps))}, p75 ${fmt(percentile(gaps, 75))}, p90 ${fmt(percentile(gaps, 90))} ticks; per-run median gap p50 ${fmt(median(runMedianGaps))}.`,
  );
  out.push('');

  const endRows = (label: string, subset: RunRecord[]) => [
    label,
    String(subset.length),
    `${fmt(percentile(subset.map((r) => r.nodesOwned), 10))} / ${fmt(median(subset.map((r) => r.nodesOwned)))} / ${fmt(percentile(subset.map((r) => r.nodesOwned), 90))}`,
    `${fmt(median(subset.map((r) => r.cashEnd)))} / ${fmt(percentile(subset.map((r) => r.cashEnd), 90))}`,
    `${fmt(median(subset.map((r) => r.hypeEnd)))} / ${fmt(percentile(subset.map((r) => r.hypeEnd), 90))}`,
    fmt(median(subset.map((r) => r.dataCentresBuilt))),
    `${fmt(median(subset.map((r) => r.worldShareEnd * 100)), 1)}%`,
    `${fmt(median(subset.map((r) => r.leadRivalAgi)))}`,
    pct(subset.filter((r) => r.leadRivalAgi > 50).length, subset.length),
  ];
  out.push('End state:');
  out.push('');
  out.push(
    table(
      ['Runs', 'n', 'Nodes p10/p50/p90', 'Cash p50/p90', 'Hype p50/p90', 'DCs built', 'Share p50', 'Lead rival AGI p50', 'Lead rival AGI > 50'],
      [endRows('all', runs), endRows('wins', wins), endRows('losses', runs.filter((r) => r.kind !== 'win'))],
    ),
  );
  out.push('');
  const share = (part: number[], whole: number[]) => {
    const a = part.reduce((x, y) => x + y, 0);
    const b = whole.reduce((x, y) => x + y, 0);
    return pct(a, a + b);
  };
  out.push(
    `Moments: ${fmt(median(runs.map((r) => r.momentsCollected)))} tapped and ${fmt(median(runs.map((r) => r.momentsMissed)))} missed per run (median); moment income is ${share(
      runs.map((r) => r.momentHype),
      runs.map((r) => r.hypeEarned),
    )} of all Hype and ${share(
      runs.map((r) => r.momentCash),
      runs.map((r) => r.cashEarned),
    )} of all Cash earned (moments + income); per run median ${fmt(median(runs.map((r) => r.momentHype)))} Hype, ${fmt(median(runs.map((r) => r.momentCash)))} Cash. Launch news per run (median): player ${fmt(median(runs.map((r) => r.launches.player)))}, rivals ${fmt(median(runs.map((r) => r.launches.rivals)))}; news items without a kind: ${runs.reduce((n, r) => n + r.kindlessNews, 0)}.`,
  );
  out.push('');
  const allRivalsBought = runs.filter((r) => r.rivals.length > 0 && r.rivals.every((x) => x.eliminated === 'acquired' && x.byPlayer)).length;
  out.push(`Runs where the player bought every rival: ${pct(allRivalsBought, n)}.`);
  out.push(
    `Peak meters p50/p90: player regulation ${fmt(median(runs.map((r) => r.peakRegulation)))}/${fmt(percentile(runs.map((r) => r.peakRegulation), 90))}, backlash ${fmt(median(runs.map((r) => r.peakBacklash)))}/${fmt(percentile(runs.map((r) => r.peakBacklash), 90))}; rivals' highest regulation ${fmt(median(runs.map((r) => r.rivalPeakRegulation)))}/${fmt(percentile(runs.map((r) => r.rivalPeakRegulation), 90))}, backlash ${fmt(median(runs.map((r) => r.rivalPeakBacklash)))}/${fmt(percentile(runs.map((r) => r.rivalPeakBacklash), 90))}.`,
  );
  out.push('');

  const rivalIds = [...new Set(runs.flatMap((r) => r.rivals.map((x) => x.id)))];
  const rivalRows = rivalIds.map((id) => {
    const recs = runs.flatMap((r) => r.rivals.filter((x) => x.id === id));
    const entered = recs.filter((x) => x.entered);
    const c = (reason: string) => entered.filter((x) => x.eliminated === reason).length;
    return [
      id,
      pct(entered.length, n),
      pct(c('banned'), entered.length),
      pct(c('revolt'), entered.length),
      pct(entered.filter((x) => x.eliminated === 'acquired' && x.byPlayer).length, entered.length),
      pct(entered.filter((x) => x.eliminated === 'acquired' && !x.byPlayer).length, entered.length),
      fmt(median(entered.map((x) => x.agi))),
    ];
  });
  const appearances = runs.flatMap((r) => r.rivals.filter((x) => x.entered));
  const selfElim = appearances.filter((x) => x.eliminated === 'banned' || x.eliminated === 'revolt').length;
  rivalRows.push(['all', '-', '-', '-', '-', '-', `self-eliminated ${pct(selfElim, appearances.length)}`]);
  out.push('Rivals (share of appearances):');
  out.push('');
  out.push(table(['Rival', 'Entered', 'Banned', 'Revolt', 'Bought by player', 'Bought by rival', 'AGI at end p50'], rivalRows));
  out.push('');

  const group = (label: string, key: (r: RunRecord) => string) => {
    const groups = [...countBy(runs, key).keys()].sort();
    const rows = groups.map((g) => {
      const subset = runs.filter((r) => key(r) === g);
      const w = subset.filter((r) => r.kind === 'win').length;
      const t = countBy(subset, (r) => r.trigger ?? 'none');
      return [g, String(subset.length), pct(w, subset.length), fmt(median(subset.map((r) => r.ticks))), TRIGGERS.slice(0, 6).map((x) => `${x[0]}${x === 'rivalAgi' ? 'R' : ''}:${t.get(x) ?? 0}`).join(' ')];
    });
    out.push(`Win rate by ${label}:`);
    out.push('');
    out.push(table([label, 'n', 'Win rate', 'Median ticks', 'Triggers (a d m b r aR)'], rows));
    out.push('');
  };
  group('founder', (r) => r.job.founderId);
  group('home region', (r) => r.job.homeRegion);
  return out.join('\n');
}

/** One line per policy, for the summary at the top. */
export function summaryTable(byPolicy: Map<string, RunRecord[]>): string {
  const rows = [...byPolicy.entries()].map(([policy, runs]) => {
    const n = runs.length;
    const t = countBy(runs, (r) => r.trigger ?? 'none');
    const ticks = runs.map((r) => r.ticks);
    return [
      policy,
      String(n),
      pct(runs.filter((r) => r.kind === 'win').length, n),
      ...TRIGGERS.map((x) => pct(t.get(x) ?? 0, n)),
      `${fmt(percentile(ticks, 10))} / ${fmt(median(ticks))} / ${fmt(percentile(ticks, 90))}`,
    ];
  });
  return table(['Policy', 'Runs', 'Win', ...TRIGGERS, 'Ticks p10/p50/p90'], rows);
}
