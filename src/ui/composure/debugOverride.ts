import { create } from 'zustand';

import type { ComposureLevel } from './logic';

interface ComposureOverride {
  /** Forced level (debug only); null follows the meters. */
  level: ComposureLevel | null;
  setLevel(level: ComposureLevel | null): void;
}

/** Debug-only override of the composure level, set through the `?debug=1` handle for screenshots. */
export const useComposureOverride = create<ComposureOverride>()((set) => ({
  level: null,
  setLevel(level) {
    set({ level });
  },
}));
