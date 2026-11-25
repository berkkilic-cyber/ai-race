import { useEffect } from 'react';

import { track, type DemoCtaWhere } from '@/analytics';

/** Tracks ad_offer_shown once each time a rewarded-ad offer becomes visible (not on every render). */
export function useAdOfferShown(placement: string, visible: boolean): void {
  useEffect(() => {
    if (visible) track({ name: 'ad_offer_shown', params: { placement } });
  }, [placement, visible]);
}

/** The browser demo's call to action was tapped (start screen, end screen or a "full game" card). */
export function trackDemoCtaTap(where: DemoCtaWhere): void {
  track({ name: 'demo_cta_tap', params: { where } });
}

/** A browser-demo "In the full game" note was shown for `feature` (once per showing, not per render). */
export function useDemoGateSeen(feature: string, visible: boolean): void {
  useEffect(() => {
    if (visible) track({ name: 'demo_gate_seen', params: { feature } });
  }, [feature, visible]);
}

const demoGatesSeen = new Set<string>();

/**
 * demo_gate_seen for a note that sits on screen (the Garage's next stage), once per feature
 * per launch: it re-mounts with every Garage visit and would otherwise flood the log.
 */
export function trackDemoGateSeenOnce(feature: string): void {
  if (demoGatesSeen.has(feature)) return;
  demoGatesSeen.add(feature);
  track({ name: 'demo_gate_seen', params: { feature } });
}
