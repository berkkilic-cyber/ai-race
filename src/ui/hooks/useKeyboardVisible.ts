import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * True while the software keyboard is up (native only; always false on web, where there
 * is no keyboard event). iOS reports the change before the animation ("will"), Android
 * only after it ("did").
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setVisible(true));
    const b = Keyboard.addListener(hide, () => setVisible(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return visible;
}

/**
 * Props for a full-screen background view: a tap that no button, field or list claims
 * dismisses the keyboard. Claims the touch only while the keyboard is up, so it never
 * competes with the map's gestures or web pointer handling otherwise.
 */
export const dismissKeyboardOnTap = {
  onStartShouldSetResponder: () => Platform.OS !== 'web' && Keyboard.isVisible(),
  onResponderRelease: () => Keyboard.dismiss(),
} as const;
