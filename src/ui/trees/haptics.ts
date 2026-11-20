import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A light tap after a purchase. No-op on web; never throws or rejects (module missing, no haptic engine). */
export function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)?.catch?.(() => undefined);
  } catch {
    // Haptics are a nicety: ignore an unavailable native module.
  }
}
