/**
 * Render counters for performance checks (read through the `?debug=1` handle).
 * Counting is off unless enabled, so production renders pay one boolean check.
 */
const counts: Record<string, number> = {};
let enabled = false;

export function enableRenderStats(on = true): void {
  enabled = on;
}

export function countRender(name: string): void {
  if (enabled) counts[name] = (counts[name] ?? 0) + 1;
}

export function renderStats(): Record<string, number> {
  return { ...counts };
}

export function resetRenderStats(): void {
  for (const key of Object.keys(counts)) delete counts[key];
}
