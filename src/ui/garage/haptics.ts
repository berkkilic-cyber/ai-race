import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useGarageStore } from './store';

let last = 0;

function safely(call: () => Promise<void> | undefined): void {
  if (Platform.OS === 'web' || !useGarageStore.getState().settings.haptics) return;
  try {
    call()?.catch?.(() => undefined);
  } catch {
    // Haptics are a nicety.
  }
}

/** A light tick per tap (throttled so fast multi-finger tapping does not queue buzzes). */
export function tapHaptic(): void {
  const now = Date.now();
  if (now - last < 35) return;
  last = now;
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light));
}

/** A firmer bump for purchases. */
export function buyHaptic(): void {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium));
}

/** Success: golden moments, ships, rewards. */
export function successHaptic(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success));
}
