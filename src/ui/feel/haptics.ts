import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useFeelSettings } from './settings';

export type HapticKind = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/** Strength order: within one gap the first buzz wins unless a stronger one follows. */
const STRENGTH: Record<HapticKind, number> = { selection: 0, light: 1, medium: 2, heavy: 3, success: 3, warning: 3, error: 4 };
/** Haptics closer together than this merge into one (fast taps, a press that also buys). */
export const HAPTIC_GAP_MS = 40;

let lastAt = -Infinity;
let lastStrength = -1;
let clock: () => number = () => Date.now();

function fire(kind: HapticKind): void {
  switch (kind) {
    case 'selection':
      return void Haptics.selectionAsync()?.catch?.(() => undefined);
    case 'light':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light)?.catch?.(() => undefined);
    case 'medium':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium)?.catch?.(() => undefined);
    case 'heavy':
      return void Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy)?.catch?.(() => undefined);
    case 'success':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success)?.catch?.(() => undefined);
    case 'warning':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Warning)?.catch?.(() => undefined);
    case 'error':
      return void Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Error)?.catch?.(() => undefined);
  }
}

/**
 * The one haptics entry point: respects the haptics setting, does nothing on web, never
 * throws, and merges buzzes closer than HAPTIC_GAP_MS (a stronger one still gets through).
 * Returns whether a buzz was requested.
 */
export function haptic(kind: HapticKind): boolean {
  if (!useFeelSettings.getState().haptics) return false;
  const now = clock();
  const strength = STRENGTH[kind];
  if (now - lastAt < HAPTIC_GAP_MS && strength <= lastStrength) return false;
  lastAt = now;
  lastStrength = strength;
  if (Platform.OS === 'web') return true;
  try {
    fire(kind);
  } catch {
    // Haptics are a nicety: ignore an unavailable native module or haptic engine.
  }
  return true;
}

export const lightHaptic = () => haptic('light');
export const mediumHaptic = () => haptic('medium');
export const successHaptic = () => haptic('success');
export const warningHaptic = () => haptic('warning');
export const selectionHaptic = () => haptic('selection');

/** Tests: reset the merge window and swap the clock. */
export function resetHapticsForTests(c: () => number = () => Date.now()): void {
  lastAt = -Infinity;
  lastStrength = -1;
  clock = c;
}
