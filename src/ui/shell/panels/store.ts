import { create } from 'zustand';

/** Explanation panels opened from the top strip (and from the Trees nudge). */
export type StripPanel = 'hype' | 'cash' | 'model';

interface StripPanelStore {
  open: StripPanel | null;
  show(panel: StripPanel): void;
  close(): void;
}

export const useStripPanel = create<StripPanelStore>()((set) => ({
  open: null,
  show: (panel) => set({ open: panel }),
  close: () => set({ open: null }),
}));
