import { Fragment, Suspense, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Screen } from 'react-native-screens';
import type { defaultTabsSlotRender } from 'expo-router/ui';

const never = { then() {} };

/** Suspends its children while `freeze` is set: the tree keeps its state but does not render. */
function Suspender({ freeze, children }: { freeze: boolean; children: ReactNode }) {
  if (freeze) throw never;
  return <Fragment>{children}</Fragment>;
}

/**
 * Freezes one render late: the tab first renders once as unfocused (useIsFocused turns
 * false, so the map stops its ambient pulses), then stops rendering. Thaws at once.
 */
function DelayedFreeze({ freeze, children }: { freeze: boolean; children: ReactNode }) {
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFrozen(freeze), 0);
    return () => clearTimeout(timer);
  }, [freeze]);
  return (
    <Suspense fallback={null}>
      <Suspender freeze={freeze && frozen}>{children}</Suspender>
    </Suspense>
  );
}

/**
 * Hidden tabs do not render. The default tab slot keeps every visited tab mounted and
 * rendering on each game tick (the map's dots, the trees, the news list) while another tab
 * shows; here an unfocused tab is frozen (a Suspense boundary that stays suspended, the
 * same technique as react-freeze, which native stacks use) and catches up in one render
 * when it is shown again. Otherwise the same as expo-router's defaultTabsSlotRender.
 */
export const renderFrozenTab: typeof defaultTabsSlotRender = (descriptor, { isFocused, loaded, detachInactiveScreens }) => {
  const { lazy = true, unmountOnBlur } = descriptor.options;
  if (unmountOnBlur && !isFocused) return null;
  if (lazy && !loaded && !isFocused) return null;
  return (
    <Screen
      key={descriptor.route.key}
      enabled={detachInactiveScreens}
      activityState={isFocused ? 2 : 0}
      freezeOnBlur={false}
      style={[styles.screen, isFocused ? styles.focused : styles.unfocused]}
    >
      <DelayedFreeze freeze={!isFocused}>{descriptor.render()}</DelayedFreeze>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, position: 'relative', height: '100%' },
  focused: { zIndex: 1, display: 'flex', flexShrink: 0, flexGrow: 1 },
  unfocused: { zIndex: -1, display: 'none', flexShrink: 1, flexGrow: 0 },
});
