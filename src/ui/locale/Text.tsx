import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text as NativeText, type TextStyle } from 'react-native';

import { applyTransform } from './casing';
import { getCurrentLocale } from './current';

/**
 * The UI's Text: use it instead of React Native's `Text` wherever a style can change the
 * case (the theme's voice presets calmLabel, calmHeading, loudKicker, loudHeadline,
 * loudBody, or any `textTransform`).
 *
 * Why: iOS applies `textTransform: 'uppercase'` without the locale ("bilgi" -> "BILGI", not
 * "BİLGİ") and Android uses the device locale, not the app's. In Turkish this component
 * cases the string children in JS with the Turkish rules (./casing) and sets the style's
 * textTransform to 'none', so the platform never cases them again. Nested Texts from this
 * module inherit the parent's transform, as native text styles would.
 *
 * In English it renders React Native's Text unchanged (no flatten, no extra work).
 * `src/ui/locale/__tests__/textCasing.test.tsx` fails when a file with a case-changing style
 * renders React Native's Text directly.
 */

type Transform = TextStyle['textTransform'];

const Inherited = createContext<Transform>(undefined);
const NO_TRANSFORM: TextStyle = { textTransform: 'none' };

function caseChildren(children: ReactNode, transform: Transform): ReactNode {
  if (typeof children === 'string') return applyTransform(children, transform, 'tr');
  if (Array.isArray(children)) return children.map((c: ReactNode) => caseChildren(c, transform));
  return children;
}

/** React Native's Text props, ref included (React 19 passes ref as a prop). */
export type CasedTextProps = ComponentProps<typeof NativeText>;

export function Text(props: CasedTextProps) {
  const inherited = useContext(Inherited);
  if (getCurrentLocale() !== 'tr') return <NativeText {...props} />;
  const own = (StyleSheet.flatten(props.style) as TextStyle | undefined)?.textTransform;
  const transform = own ?? inherited;
  if (!transform || transform === 'none') {
    // An explicit 'none' under a casing parent stops the inheritance for its own children.
    if (own === 'none' && inherited && inherited !== 'none') {
      return (
        <Inherited.Provider value="none">
          <NativeText {...props} />
        </Inherited.Provider>
      );
    }
    return <NativeText {...props} />;
  }
  return (
    <Inherited.Provider value={transform}>
      <NativeText {...props} style={[props.style, NO_TRANSFORM]}>
        {caseChildren(props.children, transform)}
      </NativeText>
    </Inherited.Provider>
  );
}
