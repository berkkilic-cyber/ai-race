/**
 * The start screen's hooks into demo mode: one call each in src/ui/start, all no-ops in the
 * full game. Locked options stay in the pickers with an "In the full game" note; picking one
 * opens the waitlist card instead of selecting it.
 */
import type { ContentPack } from '@/engine';

import { t } from '../i18n';
import { demoClamp, isLockedInDemo } from './config';
import { showDemoGate } from './gate';

type Kind = 'difficulty' | 'runLength';

/** Rewrites a locked option's description (and its minutes, for run lengths) to the note. */
export function demoOption<T extends { id: string; desc: string; minutes?: string }>(kind: Kind, pack: ContentPack, option: T, on?: boolean): T {
  if (!isLockedInDemo(kind, option.id, pack, on)) return option;
  const note = t(kind === 'difficulty' ? 'ui.demo.locked.difficulty' : 'ui.demo.locked.runLength');
  return { ...option, desc: note, ...(option.minutes !== undefined ? { minutes: t('ui.demo.locked.short') } : {}) };
}

/**
 * True (and the waitlist card opens) when `id` is outside the demo: the caller then does not
 * select it. False in the full game.
 */
export function demoBlocks(kind: Kind, pack: ContentPack, id: string, on?: boolean): boolean {
  if (!isLockedInDemo(kind, id, pack, on)) return false;
  showDemoGate(kind);
  return true;
}

export { demoClamp };
