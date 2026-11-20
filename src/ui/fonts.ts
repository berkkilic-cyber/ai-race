import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { fontFaces } from './theme';

/** The bundled faces by the names the theme uses (one file each, imported per weight to keep the bundle small). */
export const FONT_SOURCES = {
  [fontFaces.serif]: Fraunces_600SemiBold,
  [fontFaces.serifNumber]: Fraunces_500Medium,
  [fontFaces.news]: BarlowCondensed_700Bold,
  [fontFaces.newsHeavy]: BarlowCondensed_800ExtraBold,
};

/** Give up waiting after this long and render with the system fallback. */
const FONT_TIMEOUT_MS = 3000;

/**
 * Loads the bundled fonts. Returns true once the app may render: when the fonts are
 * loaded, when loading failed (system fallback), or after a timeout. On web it is true
 * at once: text uses the CSS fallback stack until the faces arrive.
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
