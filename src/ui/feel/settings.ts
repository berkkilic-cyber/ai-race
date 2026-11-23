import { create } from 'zustand';

import { readValue, writeValue } from '../tutorial/storage';

/** Storage key of the feel settings (AsyncStorage on devices and web, memory in tests). */
export const FEEL_SETTINGS_KEY = 'feel.settings';
/** The Garage's old settings key: its `haptics` flag is adopted once if no feel settings were saved yet. */
export const LEGACY_GARAGE_SETTINGS_KEY = 'garage.settings';

export interface FeelSettings {
  sound: boolean;
  haptics: boolean;
  /** Reserved for a music channel; no music is produced yet. */
  music: boolean;
}

export interface FeelSettingsStore extends FeelSettings {
  /** True once `load` has read the saved settings (or found none). */
  loaded: boolean;
  load(): Promise<void>;
  setSound(on: boolean): void;
  setHaptics(on: boolean): void;
  setMusic(on: boolean): void;
}

export const DEFAULT_FEEL_SETTINGS: FeelSettings = { sound: true, haptics: true, music: true };

function pick(raw: unknown): Partial<FeelSettings> {
  const out: Partial<FeelSettings> = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const k of ['sound', 'haptics', 'music'] as const) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  return out;
}

function parse(text: string | null): Partial<FeelSettings> | null {
  if (!text) return null;
  try {
    return pick(JSON.parse(text));
  } catch {
    return null;
  }
}

let loading: Promise<void> | null = null;
/** A change made before `load` finishes wins over the saved value. */
const touched = new Set<keyof FeelSettings>();

/**
 * The one settings store for sound and haptics (the Garage's haptics switch delegates here).
 * Persisted as JSON under `feel.settings`; a storage failure falls back to the defaults.
 */
export const useFeelSettings = create<FeelSettingsStore>()((set, get) => {
  const save = () => {
    const { sound, haptics, music } = get();
    writeValue(FEEL_SETTINGS_KEY, JSON.stringify({ sound, haptics, music })).catch(() => undefined);
  };
  const change = (key: keyof FeelSettings, on: boolean) => {
    touched.add(key);
    set({ [key]: on } as Partial<FeelSettings>);
    save();
  };
  return {
    ...DEFAULT_FEEL_SETTINGS,
    loaded: false,
    load() {
      if (!loading) {
        loading = (async () => {
          try {
            const [own, legacy] = await Promise.all([readValue(FEEL_SETTINGS_KEY), readValue(LEGACY_GARAGE_SETTINGS_KEY)]);
            const saved = parse(own) ?? (() => {
              const l = parse(legacy);
              return l && l.haptics !== undefined ? { haptics: l.haptics } : {};
            })();
            const next: Partial<FeelSettings> = {};
            for (const [k, v] of Object.entries(saved) as [keyof FeelSettings, boolean][]) if (!touched.has(k)) next[k] = v;
            set({ ...next, loaded: true });
          } catch {
            set({ loaded: true });
          }
        })();
      }
      return loading;
    },
    setSound: (on) => change('sound', on),
    setHaptics: (on) => change('haptics', on),
    setMusic: (on) => change('music', on),
  };
});

/** Tests: forget the load so the next `load` reads storage again. */
export function resetFeelSettingsForTests(): void {
  loading = null;
  touched.clear();
  useFeelSettings.setState({ ...DEFAULT_FEEL_SETTINGS, loaded: false });
}
