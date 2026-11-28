import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnalyticsRoot } from '@/ui/analytics/AnalyticsRoot';
import { DemoRoot } from '@/ui/demo/DemoRoot';
import { installAds } from '@/ui/ads/installAds';
import { installDebugHandle } from '@/ui/debug';
import { installFeel, useFeelRoutes } from '@/ui/feel';
import { ErrorBoundary } from '@/ui/diagnostics/ErrorBoundary';
import { installGlobalErrorHandlers } from '@/ui/diagnostics/log';
import { InsetsEmulator } from '@/ui/hooks/useInsets';
import { useAppFonts } from '@/ui/fonts';
import { colors, isDark } from '@/ui/theme';
import { localeScreenLayout } from '@/ui/locale';

installGlobalErrorHandlers();
installDebugHandle();
installFeel();
installAds();
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const ready = useAppFonts();
  useFeelRoutes();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <InsetsEmulator>
        <ErrorBoundary>{ready ? <Stack screenLayout={localeScreenLayout} screenOptions={{ headerShown: false, gestureEnabled: false, contentStyle: { backgroundColor: colors.bg } }} /> : null}</ErrorBoundary>
        <AnalyticsRoot />
        <DemoRoot />
      </InsetsEmulator>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
