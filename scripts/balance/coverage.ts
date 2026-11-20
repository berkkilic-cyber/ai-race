/** Content coverage: which cards, headlines, achievements and endings the bots ever see. */
import { PACK, type RunRecord } from './simulate';

function counts(lists: string[][]): Map<string, number> {
  const out = new Map<string, number>();
  for (const list of lists) for (const id of new Set(list)) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

export function coverageReport(runs: RunRecord[], sensibleRuns: RunRecord[]): string {
  const out: string[] = [];
  const errors = runs.filter((r) => r.error);
  out.push(`## Coverage (${runs.length} runs, ${sensibleRuns.length} with policy sensible)`);
  out.push('');
  out.push(`Runs that threw: ${errors.length}`);
  for (const e of errors.slice(0, 5)) out.push(`  ${JSON.stringify(e.job)}: ${e.error?.split('\n')[0]}`);
  const problems = new Set(runs.flatMap((r) => r.paramProblems));
  out.push(`News items with missing or bad {lab}/{rival}/{region} params: ${problems.size}`);
  for (const p of problems) out.push(`  ${p}`);

  const events = counts(sensibleRuns.map((r) => r.seenEvents));
  const allEvents = counts(runs.map((r) => r.seenEvents));
  const neverEvents = PACK.events.filter((e) => !events.has(e.id));
  out.push('');
  out.push(`Event cards never drawn in sensible runs: ${neverEvents.length}`);
  for (const e of neverEvents) out.push(`  ${e.id} (weight ${e.weight}; any policy: ${allEvents.get(e.id) ?? 0} runs)`);
  const rare = PACK.events
    .filter((e) => events.has(e.id))
    .map((e) => [e.id, events.get(e.id) ?? 0] as const)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10);
  out.push(`Least drawn cards (sensible runs): ${rare.map(([id, c]) => `${id} ${c}`).join(', ')}`);

  const headlines = counts(sensibleRuns.map((r) => r.headlines));
  const allHeadlines = counts(runs.map((r) => r.headlines));
  const neverHeadlines = PACK.headlines.filter((h) => !headlines.has(h.id));
  out.push('');
  out.push(`Headlines never shown in sensible runs: ${neverHeadlines.length}`);
  for (const h of neverHeadlines) out.push(`  ${h.id} (any policy: ${allHeadlines.get(h.id) ?? 0} runs)`);

  const achievements = counts(runs.map((r) => r.achievements));
  out.push('');
  out.push('Achievements (runs earned, all policies):');
  out.push(`  ${PACK.achievements.map((a) => `${a.id} ${achievements.get(a.id) ?? 0}`).join(', ')}`);
  const endings = counts(runs.map((r) => (r.endingId ? [r.endingId] : [])));
  out.push('Ending variants (runs, all policies):');
  out.push(`  ${PACK.endings.map((e) => `${e.id} ${endings.get(e.id) ?? 0}`).join(', ')}`);
  return out.join('\n');
}
