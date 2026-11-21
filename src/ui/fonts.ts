/* eslint-disable @typescript-eslint/no-require-imports */
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

type FontSources = Record<string, number>;

/**
 * Font loading, lazy per theme. Each theme's faces are required inside its own branch, and
 * only the active theme's branch ever runs (on first use, not at import), so a build never
 * touches another theme's font package at run time:
 * - every branch's requires sit in a `try` block, which Metro treats as optional
 *   dependencies (Expo turns `allowOptionalDependencies` on): a theme whose font package is
 *   not installed still bundles, and if that theme is the active one it falls back to the
 *   system faces instead of a red "Unable to resolve module" screen;
 * - the branch is picked by comparing the inlined EXPO_PUBLIC_THEME directly, so in
 *   production the bundler folds the other branches away and ships only this theme's files.
 * Keep the names in step with `themeFontFaces` in theme.ts (a test checks it).
 */
function missing(theme: string, e: unknown): FontSources {
  if (process.env.NODE_ENV !== 'production') console.warn(`[AI-RACE] fonts for theme "${theme}" are not installed; using the system faces`, e);
  return {};
}

/**
 * The active theme's faces by the names the theme uses (one file each, required per
 * weight). Only the active theme's branch runs. The requires stay inline in their branch
 * (not in helper functions) so production constant folding can drop the other branches
 * together with their requires.
 */
export function themeFontSources(): FontSources {
  if (process.env.EXPO_PUBLIC_THEME === 'blueprint') {
    try {
      return {
        B612_400Regular: require('@expo-google-fonts/b612/400Regular').B612_400Regular,
        B612_700Bold: require('@expo-google-fonts/b612/700Bold').B612_700Bold,
        B612Mono_400Regular: require('@expo-google-fonts/b612-mono/400Regular').B612Mono_400Regular,
        HankenGrotesk_400Regular: require('@expo-google-fonts/hanken-grotesk/400Regular').HankenGrotesk_400Regular,
        HankenGrotesk_600SemiBold: require('@expo-google-fonts/hanken-grotesk/600SemiBold').HankenGrotesk_600SemiBold,
        SofiaSansExtraCondensed_700Bold: require('@expo-google-fonts/sofia-sans-extra-condensed/700Bold').SofiaSansExtraCondensed_700Bold,
        SofiaSansExtraCondensed_800ExtraBold: require('@expo-google-fonts/sofia-sans-extra-condensed/800ExtraBold').SofiaSansExtraCondensed_800ExtraBold,
      };
    } catch (e) {
      return missing('blueprint', e);
    }
  } else if (process.env.EXPO_PUBLIC_THEME === 'hazard') {
    try {
      return {
        BigShoulders_700Bold: require('@expo-google-fonts/big-shoulders/700Bold').BigShoulders_700Bold,
        BigShoulders_900Black: require('@expo-google-fonts/big-shoulders/900Black').BigShoulders_900Black,
        BigShouldersStencil_800ExtraBold: require('@expo-google-fonts/big-shoulders-stencil/800ExtraBold').BigShouldersStencil_800ExtraBold,
        Barlow_500Medium: require('@expo-google-fonts/barlow/500Medium').Barlow_500Medium,
        Barlow_600SemiBold: require('@expo-google-fonts/barlow/600SemiBold').Barlow_600SemiBold,
        Barlow_700Bold: require('@expo-google-fonts/barlow/700Bold').Barlow_700Bold,
      };
    } catch (e) {
      return missing('hazard', e);
    }
  } else if (process.env.EXPO_PUBLIC_THEME === 'candy') {
    try {
      return {
        Fredoka_500Medium: require('@expo-google-fonts/fredoka/500Medium').Fredoka_500Medium,
        Fredoka_600SemiBold: require('@expo-google-fonts/fredoka/600SemiBold').Fredoka_600SemiBold,
        Fredoka_700Bold: require('@expo-google-fonts/fredoka/700Bold').Fredoka_700Bold,
        Anton_400Regular: require('@expo-google-fonts/anton/400Regular').Anton_400Regular,
      };
    } catch (e) {
      return missing('candy', e);
    }
  } else if (process.env.EXPO_PUBLIC_THEME === 'paper' || process.env.EXPO_PUBLIC_THEME === 'night') {
    // The retired pair share one pairing.
    try {
      return {
        Fraunces_500Medium: require('@expo-google-fonts/fraunces/500Medium').Fraunces_500Medium,
        Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold').Fraunces_600SemiBold,
        BarlowCondensed_700Bold: require('@expo-google-fonts/barlow-condensed/700Bold').BarlowCondensed_700Bold,
        BarlowCondensed_800ExtraBold: require('@expo-google-fonts/barlow-condensed/800ExtraBold').BarlowCondensed_800ExtraBold,
      };
    } catch (e) {
      return missing('paper', e);
    }
  } else {
    // neon: the default, also when EXPO_PUBLIC_THEME is unset or unknown (resolveThemeName).
    try {
      return {
        ChakraPetch_600SemiBold: require('@expo-google-fonts/chakra-petch/600SemiBold').ChakraPetch_600SemiBold,
        AzeretMono_500Medium: require('@expo-google-fonts/azeret-mono/500Medium').AzeretMono_500Medium,
        InstrumentSans_400Regular: require('@expo-google-fonts/instrument-sans/400Regular').InstrumentSans_400Regular,
        InstrumentSans_600SemiBold: require('@expo-google-fonts/instrument-sans/600SemiBold').InstrumentSans_600SemiBold,
        SairaExtraCondensed_700Bold: require('@expo-google-fonts/saira-extra-condensed/700Bold').SairaExtraCondensed_700Bold,
        SairaExtraCondensed_800ExtraBold: require('@expo-google-fonts/saira-extra-condensed/800ExtraBold').SairaExtraCondensed_800ExtraBold,
      };
    } catch (e) {
      return missing('neon', e);
    }
  }
}

let cached: FontSources | null = null;

/** The bundled faces of the active theme, resolved on first use (not at import). */
export function activeFontSources(): FontSources {
  if (!cached) cached = themeFontSources();
  return cached;
}

/** Give up waiting after this long and render with the system fallback. */
const FONT_TIMEOUT_MS = 3000;

/**
 * Loads the active theme's bundled fonts. Returns true once the app may render: when the
 * fonts are loaded, when loading failed (system fallback), or after a timeout. On web it is
 * true at once: text uses the CSS fallback stack until the faces arrive.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(activeFontSources());
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);
  return Platform.OS === 'web' || loaded || !!error || timedOut;
}
