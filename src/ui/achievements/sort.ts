import type { AchievementDef } from '@/engine';

export type AchievementRowState = 'earned' | 'locked' | 'hidden';

/** Earned first (in the order earned), then visible locked ones, then secret ones as "???". */
export function sortAchievements(defs: readonly AchievementDef[], earnedIds: readonly string[]): { def: AchievementDef; state: AchievementRowState }[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const earned = earnedIds.flatMap((id) => {
    const def = byId.get(id);
    return def ? [{ def, state: 'earned' as const }] : [];
  });
  const have = new Set(earnedIds);
  const rest = defs.filter((d) => !have.has(d.id));
  return [
    ...earned,
    ...rest.filter((d) => !d.secret).map((def) => ({ def, state: 'locked' as const })),
    ...rest.filter((d) => d.secret).map((def) => ({ def, state: 'hidden' as const })),
  ];
}
