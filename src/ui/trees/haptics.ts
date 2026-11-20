import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** A light tap after a purchase. No-op on web. */
export function lightHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}
