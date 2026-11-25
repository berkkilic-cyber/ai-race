/**
 * The "In the full game" card: which locked feature it is showing (null: hidden). Any screen
 * opens it through `showDemoGate`; DemoRoot (mounted once in app/_layout.tsx) draws it.
 */
import { Linking } from 'react-native';
import { create } from 'zustand';

import { trackDemoCtaTap } from '../analytics/hooks';
import { logError } from '../diagnostics/log';
import type { DemoCtaWhere } from '@/analytics';
import type { DemoFeature } from './config';
import { WAITLIST_URL } from './links';

export interface DemoGateState {
  feature: DemoFeature | null;
  /** Params of the card's text (the stage name for garageStage). */
  params: Record<string, string>;
  show(feature: DemoFeature, params?: Record<string, string>): void;
  hide(): void;
}

export const useDemoGate = create<DemoGateState>()((set) => ({
  feature: null,
  params: {},
  show(feature, params = {}) {
    set({ feature, params });
  },
  hide() {
    set({ feature: null, params: {} });
  },
}));

export function showDemoGate(feature: DemoFeature, params?: Record<string, string>): void {
  useDemoGate.getState().show(feature, params);
}

/** Opens the waitlist link (a new tab on web) and counts the tap. */
export function openWaitlist(where: DemoCtaWhere): void {
  trackDemoCtaTap(where);
  try {
    Promise.resolve(Linking.openURL(WAITLIST_URL)).catch((e: unknown) => logError('demo waitlist link', e));
  } catch (e) {
    logError('demo waitlist link', e);
  }
}
