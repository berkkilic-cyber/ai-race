import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { installDebugHandle } from '@/ui/debug';
import { ErrorBoundary } from '@/ui/diagnostics/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/ui/diagnostics/log';
import { InsetsEmulator } from '@/ui/hooks/useInsets';
import { useAppFonts } from '@/ui/fonts';
import { colors, isDark } from '@/ui/theme';
import { localeScreenLayout } from '@/ui/locale';

installGlobalErrorHandlers();
installDebugHandle();
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const ready = useAppFonts();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <InsetsEmulator>
        <ErrorBoundary>{ready ? <Stack screenLayout={localeScreenLayout} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} /> : null}</ErrorBoundary>
      </InsetsEmulator>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
