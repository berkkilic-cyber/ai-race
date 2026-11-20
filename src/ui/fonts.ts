/* eslint-disable @typescript-eslint/no-require-imports */
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type FontSources = Record<string, number>;

/**
 * The active theme's faces by the names the theme uses (one file each, required per
 * weight). Each branch compares the inlined EXPO_PUBLIC_THEME directly, so the bundler
 * folds the other branches away in production and ships only this theme's font files.
 * Keep the names in step with `themeFontFaces` in theme.ts (a test checks it).
 */
export function themeFontSources(): FontSources {
  if (process.env.EXPO_PUBLIC_THEME === 'hazard') {
    return {
      BigShoulders_700Bold: require('@expo-google-fonts/big-shoulders/700Bold').BigShoulders_700Bold,
      BigShoulders_900Black: require('@expo-google-fonts/big-shoulders/900Black').BigShoulders_900Black,
      BigShouldersStencil_800ExtraBold: require('@expo-google-fonts/big-shoulders-stencil/800ExtraBold').BigShouldersStencil_800ExtraBold,
      Barlow_500Medium: require('@expo-google-fonts/barlow/500Medium').Barlow_500Medium,
      Barlow_600SemiBold: require('@expo-google-fonts/barlow/600SemiBold').Barlow_600SemiBold,
      Barlow_700Bold: require('@expo-google-fonts/barlow/700Bold').Barlow_700Bold,
    };
  } else if (process.env.EXPO_PUBLIC_THEME === 'candy') {
    return {
      Fredoka_500Medium: require('@expo-google-fonts/fredoka/500Medium').Fredoka_500Medium,
      Fredoka_600SemiBold: require('@expo-google-fonts/fredoka/600SemiBold').Fredoka_600SemiBold,
      Fredoka_700Bold: require('@expo-google-fonts/fredoka/700Bold').Fredoka_700Bold,
      Anton_400Regular: require('@expo-google-fonts/anton/400Regular').Anton_400Regular,
    };
  } else if (process.env.EXPO_PUBLIC_THEME === 'paper' || process.env.EXPO_PUBLIC_THEME === 'night') {
    // The retired pair share one pairing.
    return {
      Fraunces_500Medium: require('@expo-google-fonts/fraunces/500Medium').Fraunces_500Medium,
      Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold').Fraunces_600SemiBold,
      BarlowCondensed_700Bold: require('@expo-google-fonts/barlow-condensed/700Bold').BarlowCondensed_700Bold,
      BarlowCondensed_800ExtraBold: require('@expo-google-fonts/barlow-condensed/800ExtraBold').BarlowCondensed_800ExtraBold,
    };
  } else {
    // blueprint: the default, also when EXPO_PUBLIC_THEME is unset or unknown (resolveThemeName).
    return {
      B612_400Regular: require('@expo-google-fonts/b612/400Regular').B612_400Regular,
      B612_700Bold: require('@expo-google-fonts/b612/700Bold').B612_700Bold,
      B612Mono_400Regular: require('@expo-google-fonts/b612-mono/400Regular').B612Mono_400Regular,
      HankenGrotesk_400Regular: require('@expo-google-fonts/hanken-grotesk/400Regular').HankenGrotesk_400Regular,
      HankenGrotesk_600SemiBold: require('@expo-google-fonts/hanken-grotesk/600SemiBold').HankenGrotesk_600SemiBold,
      SofiaSansExtraCondensed_700Bold: require('@expo-google-fonts/sofia-sans-extra-condensed/700Bold').SofiaSansExtraCondensed_700Bold,
      SofiaSansExtraCondensed_800ExtraBold: require('@expo-google-fonts/sofia-sans-extra-condensed/800ExtraBold').SofiaSansExtraCondensed_800ExtraBold,
    };
  }
}

/** The bundled faces of the active theme. */
export const FONT_SOURCES = themeFontSources();

/** Give up waiting after this long and render with the system fallback. */
const FONT_TIMEOUT_MS = 3000;

/**
 * Loads the active theme's bundled fonts. Returns true once the app may render: when the
 * fonts are loaded, when loading failed (system fallback), or after a timeout. On web it is
 * true at once: text uses the CSS fallback stack until the faces arrive.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_SOURCES);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);
  return Platform.OS === 'web' || loaded || !!error || timedOut;
}
