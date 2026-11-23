import { memo } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Text that changes without React: a read-only TextInput whose `text` is driven from a
 * shared value on the UI thread (reanimated sets the native prop; on web it writes the
 * input's value). The token counter, the pop-out numbers and the combo meter change many
 * times a second and use it, so a tap or a counter step commits nothing in React.
 * `initial` is the text for the first frame (a shared value is not read during render).
 */
export const LiveText = memo(function LiveText({ text, initial, style, testID, accessibilityLabel }: { text: SharedValue<string>; initial: string; style?: StyleProp<TextStyle>; testID?: string; accessibilityLabel?: string }) {
  const animatedProps = useAnimatedProps(() => ({ text: text.get(), defaultValue: text.get() }) as unknown as TextInputProps);
  return (
    <AnimatedTextInput
      editable={false}
      caretHidden
      contextMenuHidden
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      defaultValue={initial}
      animatedProps={animatedProps}
      pointerEvents="none"
      accessibilityLabel={accessibilityLabel}
      style={[styles.reset, style]}
      testID={testID}
    />
  );
});

const styles = StyleSheet.create({
  reset: { padding: 0, margin: 0, borderWidth: 0, backgroundColor: 'transparent', includeFontPadding: false },
});
