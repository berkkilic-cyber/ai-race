/**
 * Demo mode for the Garage: stages past the demo's limit get one requirement nobody can meet
 * (an upgrade that does not exist), so the idle rules never move the lab there. The stages stay
 * in the content, so "unlocks at <stage>" notes still name them. The full game gets the content
 * unchanged (same object).
 */
import type { GarageContent } from '@/idle';

import { isDemo, isStageLockedInDemo } from './config';

/** The id of the upgrade that does not exist. */
export const DEMO_LOCK_UPGRADE = '__demo-full-game__';

const cache = new WeakMap<GarageContent, GarageContent>();

export function demoGarage(content: GarageContent, on: boolean = isDemo()): GarageContent {
  if (!on || !content.stages) return content;
  let out = cache.get(content);
  if (!out) {
    out = {
      ...content,
      stages: content.stages.map((st, i) => (isStageLockedInDemo(i, true) ? { ...st, requires: [...st.requires, { type: 'upgrade' as const, id: DEMO_LOCK_UPGRADE }] } : st)),
    };
    cache.set(content, out);
  }
  return out;
}
