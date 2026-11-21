import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Runs a haptic call so that neither a synchronous throw nor a rejection can surface. */
function safely(call: () => Promise<void> | undefined): void {
  if (Platform.OS === 'web') return;
  try {
    call()?.catch?.(() => undefined);
  } catch {
    // Haptics are a nicety: ignore an unavailable native module.
  }
}

/** A firm, satisfying tap when a moment is collected. */
export function collectHaptic(): void {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium));
}

/** An error buzz when a threat lands. */
export function landHaptic(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Error));
}

/** A success buzz for the player's own model launch. */
export function launchHaptic(): void {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success));
}
