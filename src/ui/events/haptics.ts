import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { NewsTone } from '@/engine';

const FEEDBACK: Record<NewsTone, Haptics.NotificationFeedbackType> = {
  good: Haptics.NotificationFeedbackType?.Success,
  bad: Haptics.NotificationFeedbackType?.Error,
  neutral: Haptics.NotificationFeedbackType?.Warning,
};

/** A notification haptic matching the tone. No-op on web; failures are ignored. */
export function toneHaptic(tone: NewsTone): void {
  if (Platform.OS === 'web') return;
  safely(() => Haptics.notificationAsync(FEEDBACK[tone]));
}

/** A light tap, e.g. when a choice is pressed. No-op on web. */
export function tapHaptic(): void {
  if (Platform.OS === 'web') return;
  safely(() => Haptics.selectionAsync());
}

/** Runs a haptic call so that neither a synchronous throw nor a rejection can surface. */
function safely(call: () => Promise<void> | undefined): void {
  try {
    call()?.catch?.(() => undefined);
  } catch {
    // Haptics are a nicety: ignore an unavailable native module.
  }
}
