/**
 * The native ad libraries, loaded on demand. Native builds get this file; the browser gets
 * gma.web.ts, so the web bundle never contains native-only code.
 */
export type Gma = typeof import('react-native-google-mobile-ads');
export type Att = typeof import('expo-tracking-transparency');

export function loadGma(): Gma | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-google-mobile-ads') as Gma;
}

export function loadAtt(): Att | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-tracking-transparency') as Att;
}
