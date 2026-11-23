import type { PlacementId } from './types';

/**
 * Which single rewarded-ad offer to show. At most one ad offer is on screen at a time;
 * the context decides which, in this order:
 *
 * 1. `offlineDouble` while the "While you were away" report is open (and nothing else then);
 * 2. `prestigeBonus` on ship day (and nothing else then);
 * 3. `bonusMultiply` for the few seconds after a free bonus tap that offers it;
 * 4. `incidentFix` during an incident;
 * 5. `frenzyExtend` only during a frenzy;
 * 6. `crate` when it is ready;
 * 7. `boost` when the next purchase is far away.
 *
 * The last five wait until the lab produces something (`settled`): no ad in the first
 * moments of a new save.
 *
 * Pure: the screen builds the context from the idle engine's offer status and the ad
 * provider's availability.
 */
export interface OfferContext {
  /** The engine allows the offer now and an ad can be shown (or ads are removed). */
  available: Partial<Record<PlacementId, boolean>>;
  offlineReport: boolean;
  shipDay: boolean;
  incident: boolean;
  frenzy: boolean;
  /** Seconds until the next generator or upgrade becomes affordable at the current income. */
  secondsToNextBuy: number;
  /** The lab produces something (false in a brand-new save). Defaults to true. */
  settled?: boolean;
  /** A just-tapped bonus offers to multiply its reward. */
  bonus?: boolean;
}

/** The boost is offered only when the next purchase is at least this far away. */
export const BOOST_WAIT_S = 90;

export const OFFER_PRIORITY: readonly PlacementId[] = ['offlineDouble', 'prestigeBonus', 'bonusMultiply', 'incidentFix', 'frenzyExtend', 'crate', 'boost'];

export function pickPlacement(ctx: OfferContext): PlacementId | null {
  const ok = (id: PlacementId) => ctx.available[id] === true;
  if (ctx.offlineReport) return ok('offlineDouble') ? 'offlineDouble' : null;
  if (ctx.shipDay) return ok('prestigeBonus') ? 'prestigeBonus' : null;
  if (ctx.settled === false) return null;
  if (ctx.bonus && ok('bonusMultiply')) return 'bonusMultiply';
  if (ctx.incident && ok('incidentFix')) return 'incidentFix';
  if (ctx.frenzy && ok('frenzyExtend')) return 'frenzyExtend';
  if (ok('crate')) return 'crate';
  if (ok('boost') && ctx.secondsToNextBuy >= BOOST_WAIT_S) return 'boost';
  return null;
}
