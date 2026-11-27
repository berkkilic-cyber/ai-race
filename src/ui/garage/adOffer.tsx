import { memo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { availableUpgrades, crateValue, incidentFixValue, isGeneratorUnlocked, offerDef, offerStatus, totalRate, unitCost } from '@/idle';

import { AdButton, adReady, pickPlacement, useAdStore, type PlacementId } from '../ads';
import { t } from '../i18n';
import { successHaptic } from './haptics';
import { garageNow } from './clock';
import { useGarageStore, type GarageStore } from './store';
import { fmt } from './text';

/** Seconds until the next generator or upgrade is affordable on production alone (0 if one is now, or nothing is produced). */
export function secondsToNextBuy(s: GarageStore): number {
  const st = s.state;
  if (!st) return 0;
  let cheapest = Infinity;
  for (const g of s.content.generators) if (isGeneratorUnlocked(st, s.content, g.id)) cheapest = Math.min(cheapest, unitCost(g, st.generators[g.id] ?? 0));
  for (const u of availableUpgrades(st, s.content)) cheapest = Math.min(cheapest, u.cost);
  if (!(cheapest > st.tokens)) return 0;
  const rate = totalRate(st, s.content, st.now);
  if (!(rate > 0)) return 0;
  return (cheapest - st.tokens) / rate;
}

/** The one ad offer the screen may show now (see src/ui/ads/policy.ts). */
export function currentPlacement(s: GarageStore, now: number): PlacementId | null {
  const st = s.state;
  if (!st) return null;
  const offlineReport = !!st.offline && !s.launch;
  const shipDay = s.shipDay?.step === 'choose';
  const incident = !!st.incident && st.incident.until > now;
  const frenzy = !!st.frenzy && st.frenzy.until > now;
  const bonus = !!st.bonusOffer && st.bonusOffer.until > now;
  // Only ask the engine about offers whose context holds (this runs after every tap).
  const relevant: PlacementId[] = offlineReport ? ['offlineDouble'] : shipDay ? ['prestigeBonus'] : ['crate', 'boost'];
  if (!offlineReport && !shipDay) {
    if (incident) relevant.push('incidentFix');
    if (frenzy) relevant.push('frenzyExtend');
    if (bonus) relevant.push('bonusMultiply');
  }
  const available: Partial<Record<PlacementId, boolean>> = {};
  for (const id of relevant) available[id] = offerStatus(st, s.content, id, now).available && adReady(id);
  const settled = totalRate(st, s.content, now) > 0;
  const boostMatters = !!available.boost && !available.crate && !incident && !frenzy && !bonus;
  return pickPlacement({ available, offlineReport, shipDay, incident, frenzy, bonus, settled, secondsToNextBuy: boostMatters ? secondsToNextBuy(s) : 0 });
}

let placementMemo: { state: unknown; shipDay: unknown; launch: unknown; now: number; ads: string; value: PlacementId | null } | null = null;

/** `currentPlacement`, computed once per store change and clock second however many components ask. */
function cachedPlacement(s: GarageStore, now: number): PlacementId | null {
  const a = useAdStore.getState();
  const ads = `${a.adsRemoved}|${a.mock !== null}`;
  const m = placementMemo;
  if (m && m.state === s.state && m.shipDay === s.shipDay && m.launch === s.launch && m.now === now && m.ads === ads) return m.value;
  const value = currentPlacement(s, now);
  placementMemo = { state: s.state, shipDay: s.shipDay, launch: s.launch, now, ads, value };
  return value;
}

/** Store changes, ad-store changes and a one-second clock: everything the placement depends on. */
function subscribePlacement(onChange: () => void): () => void {
  const offGarage = useGarageStore.subscribe(onChange);
  const offAds = useAdStore.subscribe(onChange);
  const timer = setInterval(onChange, 1000);
  return () => {
    offGarage();
    offAds();
    clearInterval(timer);
  };
}

const placementNow = () => cachedPlacement(useGarageStore.getState(), Math.floor(garageNow() / 1000) * 1000);

/**
 * The placement on screen now; re-evaluated every second and when the context changes, but
 * a component re-renders only when the placement itself changes (not once a second).
 */
export function useAdPlacement(): PlacementId | null {
  return useSyncExternalStore(subscribePlacement, placementNow, placementNow);
}

/**
 * The single ad slot on the lab stage: the incident fix, the frenzy extension, the crate
 * or the boost, whichever the policy picks (the offline double and the launch bonus live
 * in their own panels). Renders nothing when no offer applies.
 */
export const OfferSlot = memo(function OfferSlot({ compact = true }: { compact?: boolean }) {
  const placement = useAdPlacement();
  const { state, content } = useGarageStore.getState();
  if (!state || !placement || placement === 'offlineDouble' || placement === 'prestigeBonus' || placement === 'bonusMultiply') return null;
  const status = offerStatus(state, content, placement, state.now);
  let label = '';
  let reward = '';
  let onRewarded = () => {};
  switch (placement) {
    case 'boost': {
      const def = offerDef(content, 'boost');
      label = t('ui.ads.placement.boost', { mult: def?.boostMult ?? 2 });
      reward = t('ui.ads.reward.boost', { minutes: Math.round((def?.boostMs ?? 0) / 60000), hours: Math.round((def?.boostCapMs ?? 0) / 3600000) });
      onRewarded = () => {
        useGarageStore.getState().claim('boost');
        successHaptic();
      };
      break;
    }
    case 'crate':
      label = t('ui.ads.placement.crate');
      reward = t('ui.ads.reward.crate', { amount: fmt(crateValue(state, content)) });
      onRewarded = () => {
        const r = useGarageStore.getState().claim('crate');
        if (r?.ok) {
          successHaptic();
          useGarageStore.getState().setFlash(`+${fmt(r.gained ?? 0)}`);
        }
      };
      break;
    case 'frenzyExtend': {
      const seconds = Math.round((offerDef(content, 'frenzyExtend')?.extendMs ?? 0) / 1000);
      label = t('ui.ads.placement.frenzyExtend', { seconds });
      reward = t('ui.ads.reward.frenzyExtend', { seconds });
      onRewarded = () => {
        useGarageStore.getState().claim('frenzyExtend');
        successHaptic();
      };
      break;
    }
    case 'incidentFix':
      label = t('ui.ads.placement.incidentFix');
      reward = t('ui.ads.reward.incidentFix', { amount: fmt(incidentFixValue(state, content)) });
      onRewarded = () => {
        const r = useGarageStore.getState().claim('incidentFix');
        if (r?.ok) {
          successHaptic();
          if ((r.gained ?? 0) > 0) useGarageStore.getState().setFlash(`+${fmt(r.gained ?? 0)}`);
        }
      };
      break;
  }
  return (
    <View style={styles.slot} testID="garage-offer-slot">
      <AdButton placement={placement} compact={compact} label={label} reward={reward} status={status} onRewarded={onRewarded} />
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { alignItems: 'flex-end' },
});
