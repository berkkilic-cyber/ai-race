import type { NewsTone } from '@/engine';

import { haptic, type HapticKind } from '../feel/haptics';

const FEEDBACK: Record<NewsTone, HapticKind> = {
  good: 'success',
  bad: 'error',
  neutral: 'warning',
};

/** A notification haptic matching the tone. No-op on web or with haptics off; failures are ignored (src/ui/feel/haptics.ts). */
export function toneHaptic(tone: NewsTone): void {
  haptic(FEEDBACK[tone]);
}

/** A light tap, e.g. when a choice is pressed. No-op on web or with haptics off. */
export function tapHaptic(): void {
  haptic('selection');
}
