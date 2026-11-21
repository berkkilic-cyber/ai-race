import Constants from 'expo-constants';

/**
 * Which build is running: short commit (with "+" for uncommitted changes) and the time the
 * Expo CLI served or exported it, injected through app.config.js (`extra.build`). Shown small
 * on the start screen and in the help panel, and in the touch debug overlay.
 */
export interface BuildInfo {
  commit: string;
  dirty: boolean;
  /** ISO time, or '' when unknown. */
  time: string;
}

const FALLBACK: BuildInfo = { commit: 'dev', dirty: false, time: '' };

/**
 * The manifest's stamp first (native: Expo Go re-reads app.config.js on every reload), then
 * the inlined EXPO_PUBLIC_BUILD_* variables (web export), then "dev".
 */
export function buildInfo(): BuildInfo {
  try {
    const raw = (Constants.expoConfig?.extra as { build?: Partial<BuildInfo> } | undefined)?.build;
    if (raw && typeof raw.commit === 'string' && raw.commit) return { commit: raw.commit, dirty: raw.dirty === true, time: typeof raw.time === 'string' ? raw.time : '' };
  } catch {
    // no manifest
  }
  const commit = process.env.EXPO_PUBLIC_BUILD_COMMIT;
  if (commit) return { commit, dirty: process.env.EXPO_PUBLIC_BUILD_DIRTY === '1', time: process.env.EXPO_PUBLIC_BUILD_TIME ?? '' };
  return FALLBACK;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "a112c70+ 11-21 08:14" (local time), or just the commit when the time is unknown. */
export function formatBuild(info: BuildInfo): string {
  const commit = `${info.commit}${info.dirty ? '+' : ''}`;
  const d = info.time ? new Date(info.time) : null;
  if (!d || Number.isNaN(d.getTime())) return commit;
  return `${commit} ${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function buildLabel(): string {
  return formatBuild(buildInfo());
}
