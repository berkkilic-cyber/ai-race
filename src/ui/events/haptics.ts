import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { NewsTone } from '@/engine';

const FEEDBACK: Record<NewsTone, Haptics.NotificationFeedbackType> = {
  good: Haptics.NotificationFeedbackType.Success,
  bad: Haptics.NotificationFeedbackType.Error,
  neutral: Haptics.NotificationFeedbackType.Warning,
};

/** A notification haptic matching the tone. No-op on web; failures are ignored. */
export function toneHaptic(tone: NewsTone): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(FEEDBACK[tone]).catch(() => undefined);
}

/** A light tap, e.g. when a choice is pressed. No-op on web. */
export function tapHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => undefined);
}
