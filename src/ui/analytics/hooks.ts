import { useEffect } from 'react';

import { track } from '@/analytics';

/** Tracks ad_offer_shown once each time a rewarded-ad offer becomes visible (not on every render). */
export function useAdOfferShown(placement: string, visible: boolean): void {
  useEffect(() => {
    if (visible) track({ name: 'ad_offer_shown', params: { placement } });
  }, [placement, visible]);
}
