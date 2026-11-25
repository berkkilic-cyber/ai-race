import { track, type ShareKind } from '@/analytics';

import { onDailyEvent } from '../daily/store';

/**
 * Daily challenge and sharing events. daily_start / daily_end come from the daily store
 * (src/ui/daily) for the scored attempt only; share taps and the front page are tracked by
 * their buttons through the functions below. Never the lab name or any other typed text.
 */
export function subscribeDaily(): () => void {
  return onDailyEvent((e) => {
    if (e.type === 'start') track({ name: 'daily_start', params: { day: e.day } });
    else track({ name: 'daily_end', params: { day: e.day, ending: e.ending, score: e.score, streak: e.streak } });
  });
}

/** A share button was tapped: what it shares and which screen it is on (`start`, `end`, `frontpage`, `history`). */
export function trackShareTap(kind: ShareKind, where: string): void {
  track({ name: 'share_tap', params: { kind, where } });
}

export function trackFrontPageOpen(): void {
  track({ name: 'frontpage_open' });
}
